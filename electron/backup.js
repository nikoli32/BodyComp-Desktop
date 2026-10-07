const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { migrateDatabase, openRawDatabase } = require("./database");

const backupFormat = "bodycomp-backup";
const backupVersion = 1;
const databaseVersion = 3;
const maximumBackupBytes = 512 * 1024 * 1024;
const tableNames = [
  "profiles",
  "app_state",
  "muscle_groups",
  "exercises",
  "exercise_muscles",
  "workouts",
  "workout_exercises",
  "workout_sets",
  "bodyweight_measurements",
  "profile_settings",
];

function fail(message) {
  throw new Error(message);
}

function requirePassphrase(value) {
  if (typeof value !== "string" || value.length < 12 || value.length > 256) {
    fail("Use a backup passphrase between 12 and 256 characters.");
  }
  return value;
}

function deriveKey(passphrase, salt) {
  return crypto.scryptSync(passphrase, salt, 32, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
}

function temporaryPath() {
  return path.join(os.tmpdir(), `bodycomp-${crypto.randomUUID()}.sqlite`);
}

function removeDatabaseFiles(filePath) {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.rmSync(`${filePath}${suffix}`, { force: true });
    } catch {}
  }
}

async function writeSnapshot(database, filePath, clearSession = false) {
  await database.backup(filePath);
  const snapshot = openRawDatabase(filePath);
  try {
    if (clearSession)
      snapshot
        .prepare("UPDATE app_state SET active_profile_id = NULL WHERE id = 1")
        .run();
    snapshot.pragma("wal_checkpoint(TRUNCATE)");
  } finally {
    snapshot.close();
  }
}

function encodeBackup(databaseBytes, passphrase) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    deriveKey(passphrase, salt),
    iv,
  );
  const ciphertext = Buffer.concat([
    cipher.update(databaseBytes),
    cipher.final(),
  ]);
  return {
    format: backupFormat,
    version: backupVersion,
    createdAt: new Date().toISOString(),
    databaseSha256: crypto
      .createHash("sha256")
      .update(databaseBytes)
      .digest("hex"),
    encryption: {
      algorithm: "aes-256-gcm",
      kdf: "scrypt",
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
    },
    database: ciphertext.toString("base64"),
  };
}

function decodeBackup(contents, passphrase) {
  let backup;
  try {
    backup = JSON.parse(contents);
  } catch {
    fail("This file is not a valid BodyComp backup.");
  }
  if (backup?.format !== backupFormat || backup.version !== backupVersion) {
    fail("This backup format is not supported.");
  }
  if (
    backup.encryption?.algorithm !== "aes-256-gcm" ||
    backup.encryption.kdf !== "scrypt"
  ) {
    fail("This backup encryption format is not supported.");
  }
  if (
    ![
      backup.encryption.salt,
      backup.encryption.iv,
      backup.encryption.tag,
      backup.database,
    ].every(
      (value) => typeof value === "string" && /^[A-Za-z0-9+/]+=*$/.test(value),
    )
  ) {
    fail("This backup is incomplete or damaged.");
  }
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      deriveKey(passphrase, Buffer.from(backup.encryption.salt, "base64")),
      Buffer.from(backup.encryption.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(backup.encryption.tag, "base64"));
    const databaseBytes = Buffer.concat([
      decipher.update(Buffer.from(backup.database, "base64")),
      decipher.final(),
    ]);
    const digest = crypto
      .createHash("sha256")
      .update(databaseBytes)
      .digest("hex");
    if (digest !== backup.databaseSha256)
      fail("Backup integrity check failed.");
    return databaseBytes;
  } catch (error) {
    if (error.message === "Backup integrity check failed.") throw error;
    fail("Unable to decrypt this backup. Check the passphrase and file.");
  }
}

function validateDatabase(filePath) {
  const snapshot = openRawDatabase(filePath, { readonly: true });
  try {
    const integrity = snapshot.pragma("integrity_check", { simple: true });
    if (integrity !== "ok")
      fail("The backup database failed its integrity check.");
    if (snapshot.pragma("user_version", { simple: true }) !== databaseVersion) {
      fail("This backup uses a database version that this app cannot restore.");
    }
    const existingTables = new Set(
      snapshot
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => row.name),
    );
    if (tableNames.some((table) => !existingTables.has(table)))
      fail("The backup is missing required data.");
    if (
      snapshot.prepare("SELECT count(*) AS count FROM profiles").get().count < 1
    )
      fail("The backup contains no profiles.");
    if (snapshot.pragma("foreign_key_check").length)
      fail("The backup contains invalid references.");
  } finally {
    snapshot.close();
  }
}

function copyDatabaseContents(database, sourcePath) {
  database.prepare("ATTACH DATABASE ? AS restore_source").run(sourcePath);
  try {
    database.transaction(() => {
      database
        .prepare("UPDATE app_state SET active_profile_id = NULL WHERE id = 1")
        .run();
      for (const table of [
        "workout_sets",
        "workout_exercises",
        "workouts",
        "bodyweight_measurements",
        "exercise_muscles",
        "exercises",
        "profile_settings",
        "profiles",
      ]) {
        database.exec(`DELETE FROM ${table}`);
      }
      for (const table of [
        "profiles",
        "exercises",
        "exercise_muscles",
        "workouts",
        "workout_exercises",
        "workout_sets",
        "bodyweight_measurements",
        "profile_settings",
      ]) {
        database.exec(
          `INSERT INTO main.${table} SELECT * FROM restore_source.${table}`,
        );
      }
    })();
  } finally {
    database.prepare("DETACH DATABASE restore_source").run();
  }
}

function createBackupService({ database, dialog, databasePath }) {
  const safetyDirectory = path.join(
    path.dirname(databasePath),
    "restore-safety",
  );

  async function exportBackup(payload = {}) {
    const passphrase = requirePassphrase(payload.passphrase);
    const choice = await dialog.showSaveDialog({
      title: "Save encrypted BodyComp backup",
      defaultPath: `BodyComp-backup-${new Date().toISOString().slice(0, 10)}.bodycomp`,
      filters: [
        { name: "BodyComp encrypted backup", extensions: ["bodycomp"] },
      ],
    });
    if (choice.canceled || !choice.filePath) return { canceled: true };

    const snapshotPath = temporaryPath();
    let temporaryFile;
    try {
      await writeSnapshot(database, snapshotPath, true);
      const databaseBytes = fs.readFileSync(snapshotPath);
      const contents = JSON.stringify(encodeBackup(databaseBytes, passphrase));
      if (Buffer.byteLength(contents) > maximumBackupBytes)
        fail("The database is too large for a portable backup file.");
      temporaryFile = `${choice.filePath}.${crypto.randomUUID()}.tmp`;
      fs.writeFileSync(temporaryFile, contents, { flag: "wx" });
      fs.renameSync(temporaryFile, choice.filePath);
      temporaryFile = null;
      return { canceled: false, filePath: choice.filePath };
    } finally {
      if (temporaryFile) fs.rmSync(temporaryFile, { force: true });
      removeDatabaseFiles(snapshotPath);
    }
  }

  async function restoreBackup(payload = {}) {
    const passphrase = requirePassphrase(payload.passphrase);
    const choice = await dialog.showOpenDialog({
      title: "Choose a BodyComp backup",
      properties: ["openFile"],
      filters: [
        { name: "BodyComp encrypted backup", extensions: ["bodycomp"] },
      ],
    });
    if (choice.canceled || !choice.filePaths?.[0]) return { canceled: true };
    const backupPath = choice.filePaths[0];
    const stats = fs.statSync(backupPath);
    if (stats.size < 1 || stats.size > maximumBackupBytes)
      fail("Backup file size is invalid.");

    const sourcePath = temporaryPath();
    try {
      const databaseBytes = decodeBackup(
        fs.readFileSync(backupPath, "utf8"),
        passphrase,
      );
      fs.writeFileSync(sourcePath, databaseBytes, { flag: "wx" });
      const importedDatabase = openRawDatabase(sourcePath);
      try {
        migrateDatabase(importedDatabase);
      } finally {
        importedDatabase.close();
      }
      validateDatabase(sourcePath);

      const confirmation = await dialog.showMessageBox({
        type: "warning",
        title: "Replace local BodyComp data?",
        message: "Restoring will replace all profiles and data on this device.",
        detail:
          "A local safety snapshot will be created before replacement. You will need to sign in again after restore.",
        buttons: ["Restore and replace", "Cancel"],
        defaultId: 1,
        cancelId: 1,
      });
      if (confirmation.response !== 0) return { canceled: true };

      fs.mkdirSync(safetyDirectory, { recursive: true });
      const safetyPath = path.join(
        safetyDirectory,
        `before-restore-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
      );
      await database.backup(safetyPath);
      const safetyFiles = fs
        .readdirSync(safetyDirectory)
        .filter(
          (name) =>
            name.startsWith("before-restore-") && name.endsWith(".sqlite"),
        )
        .sort()
        .reverse();
      for (const name of safetyFiles.slice(3))
        fs.rmSync(path.join(safetyDirectory, name), { force: true });
      copyDatabaseContents(database, sourcePath);
      return { canceled: false, restored: true };
    } finally {
      removeDatabaseFiles(sourcePath);
    }
  }

  return { exportBackup, restoreBackup };
}

module.exports = {
  createBackupService,
  decodeBackup,
  encodeBackup,
  validateDatabase,
};
