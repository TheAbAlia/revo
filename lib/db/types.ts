import type { db } from './drizzle';

export type AppDb = typeof db;

export type AppTransaction =
  Parameters<
    Parameters<AppDb['transaction']>[0]
  >[0];

export type DbExecutor =
  AppDb | AppTransaction;
