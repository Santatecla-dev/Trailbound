import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg
export const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      display_name VARCHAR(80) NOT NULL,
      username VARCHAR(32) UNIQUE NOT NULL,
      email VARCHAR(160) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS trips (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(120) NOT NULL,
      location VARCHAR(160) NOT NULL,
      starts_on DATE NOT NULL,
      ends_on DATE NOT NULL,
      difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('gentle', 'moderate', 'challenging')),
      distance_km NUMERIC(7,2),
      notes VARCHAR(1200),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (ends_on >= starts_on),
      CHECK (distance_km IS NULL OR distance_km >= 0)
    );
    CREATE INDEX IF NOT EXISTS trips_user_date_idx ON trips(user_id, starts_on, id);
  `)
}
