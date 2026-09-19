import pg from 'pg';

const { Pool } = pg;

let pool;

export function getDb() {
  if (!process.env.TIGER_DATABASE_URL) {
    throw new Error('TIGER_DATABASE_URL is not configured');
  }

  if (!pool) {
    const url = new URL(process.env.TIGER_DATABASE_URL);

    // Keep TLS required, but let node-postgres use our explicit certificate policy.
    // Some hosted PostgreSQL providers include sslmode in the URL, which can
    // override the explicit ssl object below.
    url.searchParams.delete('sslmode');

    pool = new Pool({
      connectionString: url.toString(),
      ssl: {
        rejectUnauthorized: false,
      },
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
