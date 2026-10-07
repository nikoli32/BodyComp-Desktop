const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync, backup } = require("node:sqlite");

const migrationsPath = path.join(__dirname, "migrations");
const currentDatabaseFilename = "bodycomp-v2.sqlite";

function getDatabasePath(userDataPath) {
  return path.join(userDataPath, currentDatabaseFilename);
}

class SyncDatabase {
  constructor(databasePath, options = {}) {
    this.name = databasePath;
    this.database = new DatabaseSync(databasePath, {
      readOnly: options.readonly === true,
    });
  }

  exec(sql) {
    return this.database.exec(sql);
  }

  prepare(sql) {
    return this.database.prepare(sql);
  }

  pragma(statement, options = {}) {
    const value = statement.trim();
    if (/^[a-z_]+\s*=/i.test(value)) return this.exec(`PRAGMA ${value}`);
    const rows = this.prepare(`PRAGMA ${value}`).all();
    return options.simple
      ? rows[0]
        ? Object.values(rows[0])[0]
        : undefined
      : rows;
  }

  transaction(callback) {
    return (...args) => {
      this.exec("BEGIN IMMEDIATE");
      try {
        const result = callback(...args);
        this.exec("COMMIT");
        return result;
      } catch (error) {
        this.exec("ROLLBACK");
        throw error;
      }
    };
  }

  backup(destinationPath) {
    return backup(this.database, destinationPath);
  }

  close() {
    this.database.close();
  }
}

function openRawDatabase(databasePath, options = {}) {
  return new SyncDatabase(databasePath, options);
}

function migrateDatabase(database) {
  const migrations = fs
    .readdirSync(migrationsPath)
    .filter((file) => /^\d+_[a-z0-9_-]+\.sql$/i.test(file))
    .sort();

  for (const file of migrations) {
    const version = Number(file.match(/^\d+/)[0]);
    if (version <= database.pragma("user_version", { simple: true })) continue;
    const migration = fs.readFileSync(path.join(migrationsPath, file), "utf8");
    database.transaction(() => {
      database.exec(migration);
      database.pragma(`user_version = ${version}`);
    })();
  }
}

function openDatabase(databasePath) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = openRawDatabase(databasePath);
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  database.pragma("busy_timeout = 5000");
  migrateDatabase(database);

  return database;
}

module.exports = {
  getDatabasePath,
  migrateDatabase,
  openDatabase,
  openRawDatabase,
};
