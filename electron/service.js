const crypto = require("node:crypto");
const { createBackupService } = require("./backup");
const {
  MAX_RECOVERY_HOURS,
  calculateMuscleRecovery,
  calculateSetStimulus,
  combineDemands,
  estimateOneRepMax,
  estimateRecoveryDuration,
  estimateTransitionHours,
} = require("./recovery");

const passwordBytes = 64;
const starterExercises = [
  [
    "Barbell bench press",
    [
      ["pectorals", "primary"],
      ["deltoids", "secondary"],
      ["triceps", "secondary"],
    ],
  ],
  [
    "Push-up",
    [
      ["pectorals", "primary"],
      ["triceps", "secondary"],
      ["deltoids", "secondary"],
    ],
  ],
  [
    "Dumbbell shoulder press",
    [
      ["deltoids", "primary"],
      ["triceps", "secondary"],
    ],
  ],
  ["Lateral raise", [["deltoids", "primary"]]],
  [
    "Barbell row",
    [
      ["lats", "primary"],
      ["rhomboids", "secondary"],
      ["biceps", "secondary"],
    ],
  ],
  [
    "Pull-up",
    [
      ["lats", "primary"],
      ["biceps", "secondary"],
      ["forearms", "secondary"],
    ],
  ],
  [
    "Lat pulldown",
    [
      ["lats", "primary"],
      ["biceps", "secondary"],
    ],
  ],
  [
    "Face pull",
    [
      ["rear-deltoids", "primary"],
      ["trapezius", "secondary"],
      ["rhomboids", "secondary"],
    ],
  ],
  [
    "Dumbbell curl",
    [
      ["biceps", "primary"],
      ["forearms", "secondary"],
    ],
  ],
  ["Triceps pushdown", [["triceps", "primary"]]],
  [
    "Back squat",
    [
      ["quadriceps", "primary"],
      ["glutes", "secondary"],
      ["hamstrings", "secondary"],
    ],
  ],
  [
    "Leg press",
    [
      ["quadriceps", "primary"],
      ["glutes", "secondary"],
    ],
  ],
  [
    "Romanian deadlift",
    [
      ["hamstrings", "primary"],
      ["glutes", "secondary"],
      ["lower-back", "secondary"],
    ],
  ],
  [
    "Deadlift",
    [
      ["hamstrings", "primary"],
      ["glutes", "secondary"],
      ["lower-back", "secondary"],
      ["trapezius", "secondary"],
    ],
  ],
  [
    "Hip thrust",
    [
      ["glutes", "primary"],
      ["hamstrings", "secondary"],
    ],
  ],
  [
    "Forward lunge",
    [
      ["quadriceps", "primary"],
      ["glutes", "secondary"],
      ["hamstrings", "secondary"],
    ],
  ],
  ["Standing calf raise", [["calves", "primary"]]],
  [
    "Plank",
    [
      ["rectus-abdominis", "primary"],
      ["obliques", "secondary"],
    ],
  ],
  ["Crunch", [["rectus-abdominis", "primary"]]],
  [
    "Hanging knee raise",
    [
      ["rectus-abdominis", "primary"],
      ["hip-flexors", "secondary"],
    ],
  ],
];

function fail(message) {
  throw new Error(message);
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
  return value;
}

function requireText(value, label, maximum = 200) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > maximum
  ) {
    fail(`${label} must be between 1 and ${maximum} characters.`);
  }
  return value.trim();
}

function optionalText(value, label, maximum = 2000) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string" || value.length > maximum) {
    fail(`${label} must be no longer than ${maximum} characters.`);
  }
  return value.trim();
}

function validDate(value, label, optional = false) {
  if (optional && (value === undefined || value === null || value === ""))
    return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    fail(`${label} must be a valid date.`);
  }
  return new Date(value).toISOString();
}

function validNumber(
  value,
  label,
  { optional = false, integer = false, min = 0, max = Infinity } = {},
) {
  if (optional && (value === undefined || value === null || value === ""))
    return null;
  const number = Number(value);
  if (
    !Number.isFinite(number) ||
    number < min ||
    number > max ||
    (integer && !Number.isInteger(number))
  ) {
    fail(`${label} is invalid.`);
  }
  return number;
}

function readMuscleRecovery(database, profileId, nowMilliseconds = Date.now()) {
  const muscleGroups = database
    .prepare("SELECT id, slug, name FROM muscle_groups ORDER BY id")
    .all();
  const rows = database
    .prepare(
      `SELECT w.id AS workoutId, w.started_at AS startedAt,
              ws.completed_at AS completedAt, we.exercise_id AS exerciseId,
              we.exercise_name AS exerciseName, em.muscle_group_id AS muscleGroupId,
              em.role, em.load_factor AS loadFactor, ws.weight_kg AS weightKg,
              ws.reps, ws.rir
       FROM workouts w
       JOIN workout_exercises we ON we.workout_id = w.id
       JOIN workout_sets ws ON ws.workout_exercise_id = we.id
       JOIN exercise_muscles em ON em.exercise_id = we.exercise_id
       WHERE w.profile_id = ?
       ORDER BY w.started_at, w.id, we.position, ws.position`,
    )
    .all(profileId);

  const performanceBySession = new Map();
  for (const row of rows) {
    const strength = estimateOneRepMax(row.weightKg, row.reps, row.rir);
    if (strength === null) continue;
    const key = `${row.muscleGroupId}:${row.exerciseId}:${row.workoutId}`;
    const performance = performanceBySession.get(key) || {
      muscleGroupId: row.muscleGroupId,
      exerciseId: row.exerciseId,
      startedAt: row.startedAt,
      strength: 0,
    };
    performance.strength = Math.max(performance.strength, strength);
    performanceBySession.set(key, performance);
  }

  const performancesByExercise = new Map();
  for (const performance of performanceBySession.values()) {
    const key = `${performance.muscleGroupId}:${performance.exerciseId}`;
    const history = performancesByExercise.get(key) || [];
    history.push(performance);
    performancesByExercise.set(key, history);
  }

  const transitionsByMuscle = new Map();
  for (const [key, history] of performancesByExercise) {
    history.sort(
      (left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt),
    );
    const muscleGroupId = Number(key.split(":")[0]);
    for (let index = 1; index < history.length; index += 1) {
      const previous = history[index - 1];
      const current = history[index];
      const elapsedHours =
        (Date.parse(current.startedAt) - Date.parse(previous.startedAt)) /
        3_600_000;
      const transition = estimateTransitionHours(
        previous.strength,
        current.strength,
        elapsedHours,
      );
      if (transition === null) continue;
      const estimates = transitionsByMuscle.get(muscleGroupId) || [];
      estimates.push(transition);
      transitionsByMuscle.set(muscleGroupId, estimates);
    }
  }

  const sessionsByMuscle = new Map();
  const cutoff = nowMilliseconds - MAX_RECOVERY_HOURS * 3_600_000;
  for (const row of rows) {
    if (Date.parse(row.completedAt) < cutoff) continue;
    const key = `${row.muscleGroupId}:${row.workoutId}`;
    const sessions = sessionsByMuscle.get(row.muscleGroupId) || new Map();
    const session = sessions.get(key) || {
      workoutId: row.workoutId,
      startedAt: row.startedAt,
      lastTrainedAt: row.completedAt,
      stimulusParts: [],
      totalSets: 0,
      rirTotal: 0,
      exercises: new Set(),
    };
    session.stimulusParts.push(calculateSetStimulus(row));
    session.totalSets += 1;
    session.rirTotal += row.rir === null ? 2 : Number(row.rir);
    session.exercises.add(row.exerciseName);
    if (Date.parse(row.completedAt) > Date.parse(session.lastTrainedAt)) {
      session.lastTrainedAt = row.completedAt;
    }
    sessions.set(key, session);
    sessionsByMuscle.set(row.muscleGroupId, sessions);
  }

  return muscleGroups.map((group) => {
    const learned = estimateRecoveryDuration(
      transitionsByMuscle.get(group.id) || [],
    );
    const storedSessions = [
      ...(sessionsByMuscle.get(group.id)?.values() || []),
    ];
    const sessions = storedSessions.map((session) => ({
      ...session,
      stimulus: combineDemands(session.stimulusParts),
      recoveryHours: learned.recoveryHours,
    }));
    const recovery = calculateMuscleRecovery(sessions, nowMilliseconds);
    const totalSets = storedSessions.reduce(
      (total, session) => total + session.totalSets,
      0,
    );
    const rirTotal = storedSessions.reduce(
      (total, session) => total + session.rirTotal,
      0,
    );
    const contributingExercises = [
      ...new Set(storedSessions.flatMap((session) => [...session.exercises])),
    ];
    return {
      ...group,
      ...recovery,
      totalSets,
      contributingExercises,
      averageRir: totalSets
        ? Math.round((rirTotal / totalSets) * 10) / 10
        : null,
      recoveryHours: learned.recoveryHours,
      recoveryBaselineHours: learned.recoveryHours,
      recoveryEstimateLearned: learned.recoveryEstimateLearned,
      recoveryHistorySamples: learned.recoveryHistorySamples,
    };
  });
}

function createService({ database, dialog, databasePath }) {
  let db = database;
  const backup = createBackupService({ database, dialog, databasePath });

  function activeProfileId() {
    return db
      .prepare("SELECT active_profile_id FROM app_state WHERE id = 1")
      .get().active_profile_id;
  }

  function requireProfile() {
    const profileId = activeProfileId();
    if (!profileId) fail("Sign in to use your local profile.");
    return profileId;
  }

  function publicProfile(profileId) {
    const profile = db
      .prepare(
        "SELECT id, email, display_name AS displayName, avatar_data AS avatarUrl, created_at AS createdAt FROM profiles WHERE id = ?",
      )
      .get(profileId);
    if (!profile) return null;
    return profile;
  }

  function savePassword(password) {
    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 256
    ) {
      fail("Password must be between 8 and 256 characters.");
    }
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(password, salt, passwordBytes);
    return { salt, hash };
  }

  function verifyPassword(password, salt, hash) {
    if (typeof password !== "string" || password.length > 256) return false;
    const candidate = crypto.scryptSync(password, salt, passwordBytes);
    return crypto.timingSafeEqual(candidate, hash);
  }

  function getMuscles(exerciseId) {
    return db
      .prepare(
        `SELECT mg.id AS muscleGroupId, mg.slug, mg.name, em.role,
                em.load_factor AS loadFactor
       FROM exercise_muscles em JOIN muscle_groups mg ON mg.id = em.muscle_group_id
       WHERE em.exercise_id = ? ORDER BY mg.id`,
      )
      .all(exerciseId);
  }

  function validateMuscles(muscles) {
    if (!Array.isArray(muscles) || muscles.length < 1 || muscles.length > 18) {
      fail("Choose at least one muscle group.");
    }
    const seen = new Set();
    let hasPrimary = false;
    for (const muscle of muscles) {
      requireObject(muscle, "Muscle assignment");
      const id = validNumber(muscle.muscleGroupId, "Muscle group", {
        integer: true,
        min: 1,
      });
      if (seen.has(id)) fail("Each muscle group can only be assigned once.");
      if (!db.prepare("SELECT 1 FROM muscle_groups WHERE id = ?").get(id))
        fail("Choose a valid muscle group.");
      if (muscle.role !== "primary" && muscle.role !== "secondary")
        fail("Choose a valid muscle role.");
      seen.add(id);
      hasPrimary ||= muscle.role === "primary";
    }
    if (!hasPrimary) fail("Choose at least one primary muscle target.");
    return muscles.map((muscle) => ({
      muscleGroupId: Number(muscle.muscleGroupId),
      role: muscle.role,
      loadFactor:
        validNumber(muscle.loadFactor, "Muscle load factor", {
          optional: true,
          min: 0.1,
          max: 2,
        }) ?? 1,
    }));
  }

  function insertMuscles(exerciseId, muscles) {
    const insert = db.prepare(
      "INSERT INTO exercise_muscles (exercise_id, muscle_group_id, role, load_factor) VALUES (?, ?, ?, ?)",
    );
    for (const muscle of muscles)
      insert.run(
        exerciseId,
        muscle.muscleGroupId,
        muscle.role,
        muscle.loadFactor ?? 1,
      );
  }

  function ownExercise(exerciseId, profileId = requireProfile()) {
    const id = validNumber(exerciseId, "Exercise", { integer: true, min: 1 });
    const exercise = db
      .prepare(
        "SELECT id, name FROM exercises WHERE id = ? AND profile_id = ? AND is_active = 1",
      )
      .get(id, profileId);
    if (!exercise) fail("Exercise was not found in this profile.");
    return exercise;
  }

  function availableExercise(exerciseId, profileId) {
    const id = validNumber(exerciseId, "Exercise", { integer: true, min: 1 });
    const exercise = db
      .prepare(
        "SELECT id, name FROM exercises WHERE id = ? AND profile_id = ? AND is_active = 1",
      )
      .get(id, profileId);
    if (!exercise) fail("Exercise was not found in this profile.");
    return exercise;
  }

  function seedStarterExercises(profileId) {
    if (
      db
        .prepare(
          "SELECT 1 FROM exercises WHERE profile_id = ? AND is_custom = 0 LIMIT 1",
        )
        .get(profileId)
    )
      return;
    const muscleIds = new Map(
      db
        .prepare("SELECT id, slug FROM muscle_groups")
        .all()
        .map((group) => [group.slug, group.id]),
    );
    const insertExercise = db.prepare(
      "INSERT INTO exercises (profile_id, name, is_custom, created_at) VALUES (?, ?, 0, ?)",
    );
    db.transaction(() => {
      for (const [name, assignments] of starterExercises) {
        const inserted = insertExercise.run(
          profileId,
          name,
          new Date().toISOString(),
        );
        insertMuscles(
          inserted.lastInsertRowid,
          assignments.map(([slug, role]) => ({
            muscleGroupId: muscleIds.get(slug),
            role,
          })),
        );
      }
    })();
  }

  function readWorkout(workoutId, profileId) {
    const workout = db
      .prepare(
        `SELECT id, started_at AS startedAt, finished_at AS finishedAt, notes
       FROM workouts WHERE id = ? AND profile_id = ?`,
      )
      .get(workoutId, profileId);
    if (!workout) return null;
    workout.exercises = db
      .prepare(
        `SELECT id, exercise_id AS exerciseId, exercise_name AS name, notes
       FROM workout_exercises WHERE workout_id = ? ORDER BY position`,
      )
      .all(workoutId);
    for (const exercise of workout.exercises) {
      exercise.sets = db
        .prepare(
          `SELECT weight_kg AS weightKg, reps, duration_seconds AS durationSeconds,
                rir, completed_at AS completedAt
         FROM workout_sets WHERE workout_exercise_id = ? ORDER BY position`,
        )
        .all(exercise.id);
      delete exercise.id;
    }
    return workout;
  }

  function validateWorkout(payload, profileId) {
    requireObject(payload, "Workout");
    const startedAt = validDate(payload.startedAt, "Workout start time");
    const finishedAt = validDate(
      payload.finishedAt,
      "Workout finish time",
      true,
    );
    if (finishedAt && Date.parse(finishedAt) < Date.parse(startedAt))
      fail("Workout finish time cannot be before its start time.");
    const notes = optionalText(payload.notes, "Workout notes");
    if (
      !Array.isArray(payload.exercises) ||
      payload.exercises.length < 1 ||
      payload.exercises.length > 100
    ) {
      fail("A workout must contain between 1 and 100 exercises.");
    }
    const exercises = payload.exercises.map((exercise) => {
      requireObject(exercise, "Workout exercise");
      const savedExercise = availableExercise(exercise.exerciseId, profileId);
      if (
        !Array.isArray(exercise.sets) ||
        exercise.sets.length < 1 ||
        exercise.sets.length > 200
      ) {
        fail("Each exercise must contain between 1 and 200 sets.");
      }
      return {
        exerciseId: savedExercise.id,
        name: savedExercise.name,
        notes: optionalText(exercise.notes, "Exercise notes", 1000),
        sets: exercise.sets.map((set) => {
          requireObject(set, "Set");
          const weightKg = validNumber(set.weightKg, "Set weight", {
            optional: true,
            max: 10000,
          });
          const reps = validNumber(set.reps, "Set reps", {
            optional: true,
            integer: true,
            min: 1,
            max: 10000,
          });
          const durationSeconds = validNumber(
            set.durationSeconds,
            "Set duration",
            { optional: true, integer: true, min: 1, max: 86400 },
          );
          const rir = validNumber(set.rir, "Set RIR", {
            optional: true,
            integer: true,
            max: 10,
          });
          if (reps === null && durationSeconds === null)
            fail("Each set needs reps or a duration.");
          return {
            weightKg,
            reps,
            durationSeconds,
            rir,
            completedAt:
              validDate(set.completedAt, "Set completion time", true) ||
              finishedAt ||
              startedAt,
          };
        }),
      };
    });
    return { startedAt, finishedAt, notes, exercises };
  }

  function writeWorkoutExercises(workoutId, exercises) {
    db.prepare("DELETE FROM workout_exercises WHERE workout_id = ?").run(
      workoutId,
    );
    const insertExercise = db.prepare(
      `INSERT INTO workout_exercises (workout_id, exercise_id, exercise_name, position, notes)
       VALUES (?, ?, ?, ?, ?)`,
    );
    const insertSet = db.prepare(
      `INSERT INTO workout_sets
       (workout_exercise_id, position, weight_kg, reps, duration_seconds, rir, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    exercises.forEach((exercise, index) => {
      const inserted = insertExercise.run(
        workoutId,
        exercise.exerciseId,
        exercise.name,
        index,
        exercise.notes,
      );
      exercise.sets.forEach((set, setIndex) => {
        insertSet.run(
          inserted.lastInsertRowid,
          setIndex,
          set.weightKg,
          set.reps,
          set.durationSeconds,
          set.rir,
          set.completedAt,
        );
      });
    });
  }

  const methods = {
    "auth:register(account)": (account) => {
      requireObject(account, "Account");
      const email = requireText(account.email, "Email", 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        fail("Enter a valid email address.");
      const displayName = requireText(account.displayName, "Display name", 80);
      const { salt, hash } = savePassword(account.password);
      const id = crypto.randomUUID();
      try {
        db.transaction(() => {
          db.prepare(
            "INSERT INTO profiles (id, email, display_name, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          ).run(id, email, displayName, salt, hash, new Date().toISOString());
          db.prepare(
            "INSERT INTO profile_settings (profile_id) VALUES (?)",
          ).run(id);
          db.prepare(
            "UPDATE app_state SET active_profile_id = ? WHERE id = 1",
          ).run(id);
        })();
        seedStarterExercises(id);
      } catch (error) {
        if (
          String(error.message).includes(
            "UNIQUE constraint failed: profiles.email",
          )
        )
          fail("An account with that email already exists.");
        throw error;
      }
      return publicProfile(id);
    },
    "auth:login(credentials)": (credentials) => {
      requireObject(credentials, "Credentials");
      const email = requireText(credentials.email, "Email", 254).toLowerCase();
      const profile = db
        .prepare(
          "SELECT id, password_salt, password_hash FROM profiles WHERE email = ?",
        )
        .get(email);
      if (
        !profile ||
        !verifyPassword(
          credentials.password,
          profile.password_salt,
          profile.password_hash,
        )
      ) {
        fail("Email or password is incorrect.");
      }
      db.prepare("UPDATE app_state SET active_profile_id = ? WHERE id = 1").run(
        profile.id,
      );
      return publicProfile(profile.id);
    },
    "auth:logout()": () => {
      db.prepare(
        "UPDATE app_state SET active_profile_id = NULL WHERE id = 1",
      ).run();
      return null;
    },
    "auth:current-user()": () => {
      const profileId = activeProfileId();
      return profileId ? publicProfile(profileId) : null;
    },
    "profile:update(payload)": (payload) => {
      requireObject(payload, "Profile");
      const displayName = requireText(payload.displayName, "Display name", 80);
      const profileId = requireProfile();
      db.prepare("UPDATE profiles SET display_name = ? WHERE id = ?").run(
        displayName,
        profileId,
      );
      return publicProfile(profileId);
    },
    "profile:change-password(payload)": (payload) => {
      requireObject(payload, "Password change");
      const profileId = requireProfile();
      const profile = db
        .prepare(
          "SELECT password_salt, password_hash FROM profiles WHERE id = ?",
        )
        .get(profileId);
      if (
        !verifyPassword(
          payload.currentPassword,
          profile.password_salt,
          profile.password_hash,
        )
      )
        fail("Current password is incorrect.");
      const { salt, hash } = savePassword(payload.newPassword);
      db.prepare(
        "UPDATE profiles SET password_salt = ?, password_hash = ? WHERE id = ?",
      ).run(salt, hash, profileId);
      return null;
    },
    "profile:update-avatar(payload)": (payload) => {
      requireObject(payload, "Avatar");
      if (
        typeof payload.mimeType !== "string" ||
        !/^image\/(png|jpeg|webp|gif)$/.test(payload.mimeType)
      )
        fail("Choose a PNG, JPEG, WebP, or GIF image.");
      const bytes = Buffer.from(payload.data || []);
      if (!bytes.length || bytes.length > 2 * 1024 * 1024)
        fail("Avatar images must be smaller than 2 MB.");
      const profileId = requireProfile();
      const avatarUrl = `data:${payload.mimeType};base64,${bytes.toString("base64")}`;
      db.prepare("UPDATE profiles SET avatar_data = ? WHERE id = ?").run(
        avatarUrl,
        profileId,
      );
      return { avatarUrl };
    },
    "recovery:get()": () => {
      return readMuscleRecovery(db, requireProfile());
    },
    "bodyweight:list()": () => {
      const profileId = requireProfile();
      return db
        .prepare(
          `SELECT id, recorded_at AS recordedAt, weight_kg AS weightKg, body_fat_percent AS bodyFatPercent
         FROM bodyweight_measurements WHERE profile_id = ? ORDER BY recorded_at DESC, id DESC`,
        )
        .all(profileId)
        .map((measurement) => ({
          ...measurement,
          leanMassKg:
            measurement.weightKg * (1 - measurement.bodyFatPercent / 100),
        }));
    },
    "bodyweight:create(payload)": (payload) => {
      requireObject(payload, "Measurement");
      const profileId = requireProfile();
      const recordedAt = validDate(payload.recordedAt, "Measurement date");
      const weightKg = validNumber(payload.weightKg, "Weight", {
        min: 1,
        max: 1000,
      });
      const bodyFatPercent = validNumber(payload.bodyFatPercent, "Body fat", {
        max: 100,
      });
      const result = db
        .prepare(
          "INSERT INTO bodyweight_measurements (profile_id, recorded_at, weight_kg, body_fat_percent) VALUES (?, ?, ?, ?)",
        )
        .run(profileId, recordedAt, weightKg, bodyFatPercent);
      return {
        id: result.lastInsertRowid,
        recordedAt,
        weightKg,
        bodyFatPercent,
        leanMassKg: weightKg * (1 - bodyFatPercent / 100),
      };
    },
    "bodyweight:update(id, payload)": (id, payload) => {
      requireObject(payload, "Measurement");
      const profileId = requireProfile();
      const measurementId = validNumber(id, "Measurement", {
        integer: true,
        min: 1,
      });
      const recordedAt = validDate(payload.recordedAt, "Measurement date");
      const weightKg = validNumber(payload.weightKg, "Weight", {
        min: 1,
        max: 1000,
      });
      const bodyFatPercent = validNumber(payload.bodyFatPercent, "Body fat", {
        max: 100,
      });
      const result = db
        .prepare(
          "UPDATE bodyweight_measurements SET recorded_at = ?, weight_kg = ?, body_fat_percent = ? WHERE id = ? AND profile_id = ?",
        )
        .run(recordedAt, weightKg, bodyFatPercent, measurementId, profileId);
      if (!result.changes) fail("Measurement was not found.");
      return {
        id: measurementId,
        recordedAt,
        weightKg,
        bodyFatPercent,
        leanMassKg: weightKg * (1 - bodyFatPercent / 100),
      };
    },
    "bodyweight:delete(id)": (id) => {
      const result = db
        .prepare(
          "DELETE FROM bodyweight_measurements WHERE id = ? AND profile_id = ?",
        )
        .run(
          validNumber(id, "Measurement", { integer: true, min: 1 }),
          requireProfile(),
        );
      if (!result.changes) fail("Measurement was not found.");
      return null;
    },
    "exercises:list()": () => {
      const profileId = requireProfile();
      return db
        .prepare(
          "SELECT id, name, is_custom AS isCustom FROM exercises WHERE profile_id = ? AND is_active = 1 ORDER BY name COLLATE NOCASE",
        )
        .all(profileId)
        .map((exercise) => ({
          ...exercise,
          isCustom: Boolean(exercise.isCustom),
          muscles: getMuscles(exercise.id),
        }));
    },
    "exercises:create(payload)": (payload) => {
      requireObject(payload, "Exercise");
      const profileId = requireProfile();
      const name = requireText(payload.name, "Exercise name", 80);
      const muscles = validateMuscles(payload.muscles);
      try {
        const result = db.transaction(() => {
          const inserted = db
            .prepare(
              "INSERT INTO exercises (profile_id, name, is_custom, created_at) VALUES (?, ?, 1, ?)",
            )
            .run(profileId, name, new Date().toISOString());
          insertMuscles(inserted.lastInsertRowid, muscles);
          return inserted.lastInsertRowid;
        })();
        return {
          id: result,
          name,
          muscles: getMuscles(result),
          isCustom: true,
        };
      } catch (error) {
        if (
          String(error.message).includes(
            "UNIQUE constraint failed: exercises.profile_id, exercises.name",
          )
        )
          fail("An exercise with that name already exists.");
        throw error;
      }
    },
    "custom-exercises:list()": () => {
      const profileId = requireProfile();
      return db
        .prepare(
          "SELECT id, name, is_custom AS isCustom FROM exercises WHERE profile_id = ? AND is_active = 1 AND is_custom = 1 ORDER BY name COLLATE NOCASE",
        )
        .all(profileId)
        .map((exercise) => ({
          ...exercise,
          isCustom: Boolean(exercise.isCustom),
          muscles: getMuscles(exercise.id),
        }));
    },
    "custom-exercises:update(id, muscles)": (id, muscles) => {
      const profileId = requireProfile();
      const exercise = ownExercise(id, profileId);
      const validated = validateMuscles(muscles);
      db.transaction(() => {
        db.prepare("DELETE FROM exercise_muscles WHERE exercise_id = ?").run(
          exercise.id,
        );
        insertMuscles(exercise.id, validated);
      })();
      return {
        id: exercise.id,
        name: exercise.name,
        muscles: getMuscles(exercise.id),
        isCustom: true,
      };
    },
    "custom-exercises:delete(id)": (id) => {
      const profileId = requireProfile();
      const exercise = ownExercise(id, profileId);
      db.prepare(
        "UPDATE exercises SET is_active = 0 WHERE id = ? AND profile_id = ?",
      ).run(exercise.id, profileId);
      return null;
    },
    "muscle-groups:list()": () =>
      db.prepare("SELECT id, slug, name FROM muscle_groups ORDER BY id").all(),
    "workouts:create(payload)": (payload) => {
      const profileId = requireProfile();
      const workout = validateWorkout(payload, profileId);
      const id = db.transaction(() => {
        const inserted = db
          .prepare(
            "INSERT INTO workouts (profile_id, started_at, finished_at, notes) VALUES (?, ?, ?, ?)",
          )
          .run(profileId, workout.startedAt, workout.finishedAt, workout.notes);
        writeWorkoutExercises(inserted.lastInsertRowid, workout.exercises);
        return inserted.lastInsertRowid;
      })();
      return readWorkout(id, profileId);
    },
    "workouts:list()": () => {
      const profileId = requireProfile();
      return db
        .prepare(
          "SELECT id FROM workouts WHERE profile_id = ? ORDER BY started_at DESC, id DESC",
        )
        .all(profileId)
        .map((workout) => readWorkout(workout.id, profileId));
    },
    "workouts:update(id, payload)": (id, payload) => {
      const profileId = requireProfile();
      const workoutId = validNumber(id, "Workout", { integer: true, min: 1 });
      const current = db
        .prepare("SELECT id FROM workouts WHERE id = ? AND profile_id = ?")
        .get(workoutId, profileId);
      if (!current) fail("Workout was not found.");
      const workout = validateWorkout(payload, profileId);
      db.transaction(() => {
        db.prepare(
          "UPDATE workouts SET started_at = ?, finished_at = ?, notes = ? WHERE id = ? AND profile_id = ?",
        ).run(
          workout.startedAt,
          workout.finishedAt,
          workout.notes,
          workoutId,
          profileId,
        );
        writeWorkoutExercises(workoutId, workout.exercises);
      })();
      return readWorkout(workoutId, profileId);
    },
    "workouts:delete(id)": (id) => {
      const result = db
        .prepare("DELETE FROM workouts WHERE id = ? AND profile_id = ?")
        .run(
          validNumber(id, "Workout", { integer: true, min: 1 }),
          requireProfile(),
        );
      if (!result.changes) fail("Workout was not found.");
      return null;
    },
    "settings:get()": () => {
      const profileId = requireProfile();
      return db
        .prepare(
          "SELECT weight_unit AS weightUnit FROM profile_settings WHERE profile_id = ?",
        )
        .get(profileId);
    },
    "settings:update(payload)": (payload) => {
      requireObject(payload, "Settings");
      if (payload.weightUnit !== "lb" && payload.weightUnit !== "kg")
        fail("Weight unit must be lb or kg.");
      const profileId = requireProfile();
      db.prepare(
        "UPDATE profile_settings SET weight_unit = ? WHERE profile_id = ?",
      ).run(payload.weightUnit, profileId);
      return { weightUnit: payload.weightUnit };
    },
    "backup:export(payload)": (payload) => {
      requireProfile();
      return backup.exportBackup(payload);
    },
    "backup:restore(payload)": (payload) => {
      requireProfile();
      return backup.restoreBackup(payload);
    },
  };

  for (const profile of db.prepare("SELECT id FROM profiles").all())
    seedStarterExercises(profile.id);

  return {
    invoke(method, args) {
      const matching = Object.entries(methods).find(([signature]) =>
        signature.startsWith(`${method}(`),
      );
      if (!matching) fail("This application operation is not available yet.");
      return matching[1](...args);
    },
    close() {
      db?.close();
      db = null;
    },
  };
}

module.exports = { createService };
