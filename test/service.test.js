const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { openDatabase, openRawDatabase } = require("../electron/database");
const { decodeBackup, encodeBackup } = require("../electron/backup");
const { createService } = require("../electron/service");

function createTestService(dialog = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bodycomp-test-"));
  const databasePath = path.join(directory, "bodycomp.sqlite");
  const database = openDatabase(databasePath);
  const service = createService({ database, databasePath, dialog });
  return {
    directory,
    database,
    service,
    close() {
      service.close();
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}

test("profiles persist data independently and validate stored operations", (t) => {
  const context = createTestService();
  t.after(() => context.close());
  const { service } = context;

  assert.equal(service.invoke("auth:current-user", []), null);
  const firstProfile = service.invoke("auth:register", [
    {
      email: "first@example.test",
      displayName: "First Profile",
      password: "local-password-1",
    },
  ]);
  assert.equal(firstProfile.email, "first@example.test");

  const exercise = service.invoke("exercises:create", [
    {
      name: "Goblet squat",
      muscles: [{ muscleGroupId: 9, role: "primary" }],
    },
  ]);
  const catalog = service.invoke("exercises:list", []);
  assert.ok(
    catalog.some((item) => item.name === "Back squat" && !item.isCustom),
  );
  assert.deepEqual(service.invoke("custom-exercises:list", []), [exercise]);
  const recordedAt = new Date().toISOString();
  const measurement = service.invoke("bodyweight:create", [
    {
      recordedAt,
      weightKg: 80,
      bodyFatPercent: 20,
    },
  ]);
  assert.equal(measurement.leanMassKg, 64);

  const workout = service.invoke("workouts:create", [
    {
      startedAt: recordedAt,
      finishedAt: recordedAt,
      notes: "Local test",
      exercises: [
        {
          exerciseId: exercise.id,
          sets: [{ weightKg: 20, reps: 8, rir: 2, completedAt: recordedAt }],
        },
      ],
    },
  ]);
  assert.equal(
    service.invoke("workouts:list", [])[0].exercises[0].sets[0].reps,
    8,
  );
  assert.ok(
    service
      .invoke("recovery:get", [])
      .find((item) => item.slug === "quadriceps").recoveryDemand > 0,
  );

  service.invoke("auth:logout", []);
  const secondProfile = service.invoke("auth:register", [
    {
      email: "second@example.test",
      displayName: "Second Profile",
      password: "local-password-2",
    },
  ]);
  assert.notEqual(firstProfile.id, secondProfile.id);
  assert.deepEqual(service.invoke("bodyweight:list", []), []);
  assert.deepEqual(service.invoke("workouts:list", []), []);
  assert.throws(
    () =>
      service.invoke("workouts:update", [
        workout.id,
        {
          startedAt: recordedAt,
          exercises: [{ exerciseId: exercise.id, sets: [{ reps: 8 }] }],
        },
      ]),
    /Workout was not found/,
  );

  service.invoke("auth:logout", []);
  service.invoke("auth:login", [
    { email: firstProfile.email, password: "local-password-1" },
  ]);
  assert.equal(service.invoke("bodyweight:list", [])[0].id, measurement.id);
  assert.equal(service.invoke("workouts:list", [])[0].id, workout.id);
  assert.throws(
    () =>
      service.invoke("bodyweight:create", [
        {
          recordedAt,
          weightKg: -1,
          bodyFatPercent: 20,
        },
      ]),
    /Weight is invalid/,
  );
});

test("migrations are idempotent when reopening the user database", (t) => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "bodycomp-migration-test-"),
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const databasePath = path.join(directory, "bodycomp.sqlite");
  const first = openDatabase(databasePath);
  first.close();
  const reopened = openDatabase(databasePath);
  assert.equal(reopened.pragma("user_version", { simple: true }), 2);
  assert.equal(
    reopened.prepare("SELECT count(*) AS count FROM muscle_groups").get().count,
    18,
  );
  reopened.close();
});

test("encrypted backups validate before replacing profiles and records", async (t) => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "bodycomp-backup-test-"),
  );
  const backupPath = path.join(directory, "test.bodycomp");
  const dialog = {
    showSaveDialog: async () => ({ canceled: false, filePath: backupPath }),
    showOpenDialog: async () => ({ canceled: false, filePaths: [backupPath] }),
    showMessageBox: async () => ({ response: 0 }),
  };
  const context = createTestService(dialog);
  t.after(() => {
    context.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const { service } = context;
  const recordedAt = new Date().toISOString();
  const first = service.invoke("auth:register", [
    {
      email: "backup@example.test",
      displayName: "Backup Profile",
      password: "backup-password-1",
    },
  ]);
  service.invoke("bodyweight:create", [
    { recordedAt, weightKg: 72, bodyFatPercent: 18 },
  ]);

  const exported = await service.invoke("backup:export", [
    { passphrase: "correct horse battery" },
  ]);
  assert.equal(exported.filePath, backupPath);
  const validBackup = fs.readFileSync(backupPath, "utf8");
  assert.match(validBackup, /aes-256-gcm/);

  service.invoke("bodyweight:create", [
    { recordedAt, weightKg: 73, bodyFatPercent: 19 },
  ]);
  await assert.rejects(
    service.invoke("backup:restore", [
      { passphrase: "incorrect horse battery" },
    ]),
    /Unable to decrypt this backup/,
  );
  assert.equal(service.invoke("bodyweight:list", []).length, 2);

  fs.writeFileSync(backupPath, "not a backup");
  await assert.rejects(
    service.invoke("backup:restore", [{ passphrase: "correct horse battery" }]),
    /not a valid BodyComp backup/,
  );
  assert.equal(service.invoke("bodyweight:list", []).length, 2);

  const futureDatabasePath = path.join(directory, "future.sqlite");
  fs.writeFileSync(
    futureDatabasePath,
    decodeBackup(validBackup, "correct horse battery"),
  );
  const futureDatabase = openRawDatabase(futureDatabasePath);
  futureDatabase.pragma("user_version = 99");
  futureDatabase.close();
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      encodeBackup(
        fs.readFileSync(futureDatabasePath),
        "correct horse battery",
      ),
    ),
  );
  await assert.rejects(
    service.invoke("backup:restore", [{ passphrase: "correct horse battery" }]),
    /database version that this app cannot restore/,
  );
  assert.equal(service.invoke("bodyweight:list", []).length, 2);

  fs.writeFileSync(backupPath, validBackup);
  const restored = await service.invoke("backup:restore", [
    { passphrase: "correct horse battery" },
  ]);
  assert.equal(restored.restored, true);
  assert.equal(service.invoke("auth:current-user", []), null);
  service.invoke("auth:login", [
    { email: first.email, password: "backup-password-1" },
  ]);
  assert.equal(service.invoke("bodyweight:list", []).length, 1);
  assert.equal(service.invoke("bodyweight:list", [])[0].weightKg, 72);
  assert.equal(
    fs.readdirSync(
      path.join(path.dirname(context.database.name), "restore-safety"),
    ).length,
    1,
  );
});
