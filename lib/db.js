import pg from 'pg';

const { Pool } = pg;

let pool;

export function getDb() {
  if (!process.env.TIGER_DATABASE_URL) {
    throw new Error('TIGER_DATABASE_URL is not configured');
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.TIGER_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  return pool;
}

export function cleanDeviceId(value, fallback) {
  return String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, '');
}
