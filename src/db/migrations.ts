import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";

function candidateMigrationDirs(): string[] {
  const localSrc = path.resolve(process.cwd(), "src", "db", "migrations");
  const localDist = path.resolve(process.cwd(), "dist", "db", "migrations");
  const moduleRelative = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "migrations");
  return [moduleRelative, localDist, localSrc];
}

function findMigrationDir(): string {
  for (const dir of candidateMigrationDirs()) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }

  throw new Error("Could not locate migration directory.");
}

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);

  const dir = findMigrationDir();
  const files = fs.readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();

  const hasMigration = db.prepare("SELECT 1 FROM schema_migrations WHERE name = ?");
  const recordMigration = db.prepare("INSERT OR IGNORE INTO schema_migrations (name, applied_at) VALUES (?, ?)");

  for (const file of files) {
    const exists = hasMigration.get(file);
    if (exists) {
      continue;
    }

    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    db.exec(sql);
    recordMigration.run(file, new Date().toISOString());
  }
}
