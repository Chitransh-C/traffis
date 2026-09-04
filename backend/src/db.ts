import pg from "pg";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://traffis:traffis@127.0.0.1:5432/traffis",
});
