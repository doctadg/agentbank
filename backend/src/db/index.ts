import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { config } from '../config';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = config.databasePath;
    mkdirSync(dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    
    const schema = readFileSync(require.resolve('./schema.sql'), 'utf-8');
    db.exec(schema);
  }
  return db;
}

export function initDb(): Database.Database {
  return getDb();
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
