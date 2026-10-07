ALTER TABLE exercise_muscles
ADD COLUMN load_factor REAL NOT NULL DEFAULT 1.0
CHECK (load_factor >= 0.1 AND load_factor <= 2.0);