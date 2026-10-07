CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_salt BLOB NOT NULL,
  password_hash BLOB NOT NULL,
  avatar_data TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE app_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active_profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL
);
INSERT INTO app_state (id, active_profile_id) VALUES (1, NULL);

CREATE TABLE muscle_groups (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  UNIQUE (profile_id, name)
);

CREATE TABLE exercise_muscles (
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  muscle_group_id INTEGER NOT NULL REFERENCES muscle_groups(id),
  role TEXT NOT NULL CHECK (role IN ('primary', 'secondary')),
  PRIMARY KEY (exercise_id, muscle_group_id)
);

CREATE TABLE workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE workout_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  exercise_name TEXT NOT NULL,
  position INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE workout_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  weight_kg REAL,
  reps INTEGER,
  duration_seconds INTEGER,
  rir INTEGER,
  completed_at TEXT NOT NULL
);

CREATE TABLE bodyweight_measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recorded_at TEXT NOT NULL,
  weight_kg REAL NOT NULL,
  body_fat_percent REAL NOT NULL
);

CREATE TABLE profile_settings (
  profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  weight_unit TEXT NOT NULL DEFAULT 'lb' CHECK (weight_unit IN ('lb', 'kg'))
);

INSERT INTO muscle_groups (id, slug, name) VALUES
  (1, 'deltoids', 'Deltoids'),
  (2, 'pectorals', 'Pectorals'),
  (3, 'biceps', 'Biceps'),
  (4, 'forearms', 'Forearms'),
  (5, 'rectus-abdominis', 'Rectus Abdominis'),
  (6, 'obliques', 'Obliques'),
  (7, 'hip-flexors', 'Hip Flexors'),
  (8, 'adductors', 'Adductors'),
  (9, 'quadriceps', 'Quadriceps'),
  (10, 'trapezius', 'Trapezius'),
  (11, 'rear-deltoids', 'Rear Deltoids'),
  (12, 'triceps', 'Triceps'),
  (13, 'rhomboids', 'Rhomboids'),
  (14, 'lats', 'Lats'),
  (15, 'lower-back', 'Lower Back'),
  (16, 'glutes', 'Glutes'),
  (17, 'hamstrings', 'Hamstrings'),
  (18, 'calves', 'Calves');
