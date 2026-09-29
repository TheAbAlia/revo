import assert from 'node:assert/strict';
import test from 'node:test';

import { eq } from 'drizzle-orm';

import { createWorkerDb } from '@/lib/db/worker';
import {
  locations,
  organizations,
  providerConnections
} from '@/lib/db/schema';
import { encryptCredential } from '@/lib/integrations/crypto';
import { syncProviderReviews } from '@/lib/integrations/providers/sync-reviews';

test(
  'provider sync records attempt and successful synchronization state',
  async () => {
    const workerDb = createWorkerDb();
    let organizationId: number | null = null;

    const originalFetch = globalThis.fetch;
    const suffix =
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const [organization] = await workerDb.db
        .insert(organizations)
        .values({
          name: 'Provider Sync State Success',
          slug: `provider-sync-state-success-${suffix}`
        })
        .returning({ id: organizations.id });

      assert.ok(organization);
      organizationId = organization.id;

      const [connection] = await workerDb.db
        .insert(providerConnections)
        .values({
          organizationId,
          provider: 'google',
          externalAccountId: `accounts/${suffix}`,
          refreshTokenEncrypted: encryptCredential(
            `refresh-token-${suffix}`
          )
        })
        .returning({ id: providerConnections.id });

      assert.ok(connection);

      const [location] = await workerDb.db
        .insert(locations)
        .values({
          organizationId,
          name: 'Successful Sync Location',
          provider: 'google',
          externalId: `locations/${suffix}`,
          providerConnectionId: connection.id,
          lastSyncError: 'Old sync error'
        })
        .returning({ id: locations.id });

      assert.ok(location);

      globalThis.fetch = async (input) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (url.includes('oauth2.googleapis.com/token')) {
          return new Response(
            JSON.stringify({
              access_token: 'test-access-token',
              expires_in: 3600,
              token_type: 'Bearer'
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' }
            }
          );
        }

        if (url.includes('mybusiness.googleapis.com')) {
          return new Response(
            JSON.stringify({ reviews: [] }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' }
            }
          );
        }

        throw new Error(`Unexpected fetch: ${url}`);
      };

      await syncProviderReviews(
        workerDb.db,
        organizationId,
        location.id
      );

      const [stored] = await workerDb.db
        .select({
          lastSyncAttemptAt: locations.lastSyncAttemptAt,
          lastSyncedAt: locations.lastSyncedAt,
          lastSyncError: locations.lastSyncError
        })
        .from(locations)
        .where(eq(locations.id, location.id))
        .limit(1);

      assert.ok(stored);
      assert.ok(stored.lastSyncAttemptAt instanceof Date);
      assert.ok(stored.lastSyncedAt instanceof Date);
      assert.equal(stored.lastSyncError, null);
      assert.ok(
        stored.lastSyncedAt.getTime() >=
          stored.lastSyncAttemptAt.getTime()
      );
    } finally {
      globalThis.fetch = originalFetch;

      if (organizationId !== null) {
        await workerDb.db
          .delete(organizations)
          .where(eq(organizations.id, organizationId));
      }

      await workerDb.client.end();
    }
  }
);

test(
  'provider sync records failure while preserving last successful sync',
  async () => {
    const workerDb = createWorkerDb();
    let organizationId: number | null = null;

    const originalFetch = globalThis.fetch;
    const suffix =
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const previousSuccess = new Date('2026-09-01T12:00:00Z');

    try {
      const [organization] = await workerDb.db
        .insert(organizations)
        .values({
          name: 'Provider Sync State Failure',
          slug: `provider-sync-state-failure-${suffix}`
        })
        .returning({ id: organizations.id });

      assert.ok(organization);
      organizationId = organization.id;

      const [connection] = await workerDb.db
        .insert(providerConnections)
        .values({
          organizationId,
          provider: 'google',
          externalAccountId: `accounts/${suffix}`,
          refreshTokenEncrypted: encryptCredential(
            `refresh-token-${suffix}`
          )
        })
        .returning({ id: providerConnections.id });

      assert.ok(connection);

      const [location] = await workerDb.db
        .insert(locations)
        .values({
          organizationId,
          name: 'Failed Sync Location',
          provider: 'google',
          externalId: `locations/${suffix}`,
          providerConnectionId: connection.id,
          lastSyncedAt: previousSuccess
        })
        .returning({ id: locations.id });

      assert.ok(location);

      globalThis.fetch = async (input) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (url.includes('oauth2.googleapis.com/token')) {
          return new Response(
            JSON.stringify({
              access_token: 'test-access-token',
              expires_in: 3600,
              token_type: 'Bearer'
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' }
            }
          );
        }

        if (url.includes('mybusiness.googleapis.com')) {
          return new Response(
            JSON.stringify({
              error: {
                message: 'Temporary Google failure'
              }
            }),
            {
              status: 503,
              headers: { 'content-type': 'application/json' }
            }
          );
        }

        throw new Error(`Unexpected fetch: ${url}`);
      };

      await assert.rejects(
        () =>
          syncProviderReviews(
            workerDb.db,
            organizationId!,
            location.id
          ),
        /Google reviews request failed with status 503/
      );

      const [stored] = await workerDb.db
        .select({
          lastSyncAttemptAt: locations.lastSyncAttemptAt,
          lastSyncedAt: locations.lastSyncedAt,
          lastSyncError: locations.lastSyncError
        })
        .from(locations)
        .where(eq(locations.id, location.id))
        .limit(1);

      assert.ok(stored);
      assert.ok(stored.lastSyncAttemptAt instanceof Date);
      assert.equal(
        stored.lastSyncedAt?.getTime(),
        previousSuccess.getTime()
      );
      assert.match(
        stored.lastSyncError ?? '',
        /Google reviews request failed with status 503/
      );
    } finally {
      globalThis.fetch = originalFetch;

      if (organizationId !== null) {
        await workerDb.db
          .delete(organizations)
          .where(eq(organizations.id, organizationId));
      }

      await workerDb.client.end();
    }
  }
);
