import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

export function createWorkerDb() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      'POSTGRES_URL environment variable is not set'
    );
  }

  const client = postgres(process.env.POSTGRES_URL);

  return {
    client,
    db: drizzle(client, { schema })
  };
}
