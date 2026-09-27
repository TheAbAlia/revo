import assert from 'node:assert/strict';
import test from 'node:test';

import { eq } from 'drizzle-orm';

import { createWorkerDb } from '@/lib/db/worker';
import {
  organizations,
  providerConnections
} from '@/lib/db/schema';
import { PermanentGoogleOAuthError } from '@/lib/integrations/google/errors';
import {
  markProviderConnectionHealthy
} from '@/lib/integrations/providers/connection-health';
import {
  refreshGoogleProviderAccessToken
} from '@/lib/integrations/providers/refresh-access-token';

test('invalid_grant marks provider connection as needing reauth', async () => {
  const workerDb = createWorkerDb();
  let organizationId: number | null = null;

  try {
    const [organization] = await workerDb.db
      .insert(organizations)
      .values({
        name: 'Provider health test',
        slug: 'provider-health-test'
      })
      .returning({
        id: organizations.id
      });

    assert.ok(organization);
    organizationId = organization.id;

    const [connection] = await workerDb.db
      .insert(providerConnections)
      .values({
        organizationId: organization.id,
        provider: 'google',
        externalAccountId: 'health-test-account',
        refreshTokenEncrypted: 'test-encrypted-token'
      })
      .returning({
        id: providerConnections.id
      });

    assert.ok(connection);

    const oauthError = new PermanentGoogleOAuthError(
      'Refresh token has been revoked',
      'invalid_grant'
    );

    await assert.rejects(
      () =>
        refreshGoogleProviderAccessToken(
          workerDb.db,
          organization.id,
          connection.id,
          'test-refresh-token',
          async () => {
            throw oauthError;
          }
        ),
      (error: unknown) => {
        assert.equal(error, oauthError);
        return true;
      }
    );

    const [unhealthy] = await workerDb.db
      .select({
        status: providerConnections.status,
        lastError: providerConnections.lastError,
        lastErrorAt: providerConnections.lastErrorAt
      })
      .from(providerConnections)
      .where(eq(providerConnections.id, connection.id))
      .limit(1);

    assert.ok(unhealthy);
    assert.equal(unhealthy.status, 'needs_reauth');
    assert.equal(
      unhealthy.lastError,
      'Refresh token has been revoked'
    );
    assert.ok(unhealthy.lastErrorAt instanceof Date);

    await markProviderConnectionHealthy(
      workerDb.db,
      organization.id,
      connection.id
    );

    const [healthy] = await workerDb.db
      .select({
        status: providerConnections.status,
        lastError: providerConnections.lastError,
        lastErrorAt: providerConnections.lastErrorAt
      })
      .from(providerConnections)
      .where(eq(providerConnections.id, connection.id))
      .limit(1);

    assert.ok(healthy);
    assert.equal(healthy.status, 'connected');
    assert.equal(healthy.lastError, null);
    assert.equal(healthy.lastErrorAt, null);
  } finally {
    if (organizationId !== null) {
      await workerDb.db
        .delete(organizations)
        .where(eq(organizations.id, organizationId));
    }

    await workerDb.client.end();
  }
});

test('transient OAuth failure leaves connection health unchanged', async () => {
  const workerDb = createWorkerDb();
  let organizationId: number | null = null;

  try {
    const [organization] = await workerDb.db
      .insert(organizations)
      .values({
        name: 'Provider transient health test',
        slug: 'provider-transient-health-test'
      })
      .returning({
        id: organizations.id
      });

    assert.ok(organization);
    organizationId = organization.id;

    const [connection] = await workerDb.db
      .insert(providerConnections)
      .values({
        organizationId: organization.id,
        provider: 'google',
        externalAccountId: 'transient-health-test-account',
        refreshTokenEncrypted: 'test-encrypted-token'
      })
      .returning({
        id: providerConnections.id
      });

    assert.ok(connection);

    await assert.rejects(
      () =>
        refreshGoogleProviderAccessToken(
          workerDb.db,
          organization.id,
          connection.id,
          'test-refresh-token',
          async () => {
            throw new Error('Temporary OAuth failure');
          }
        ),
      /Temporary OAuth failure/
    );

    const [stored] = await workerDb.db
      .select({
        status: providerConnections.status,
        lastError: providerConnections.lastError,
        lastErrorAt: providerConnections.lastErrorAt
      })
      .from(providerConnections)
      .where(eq(providerConnections.id, connection.id))
      .limit(1);

    assert.ok(stored);
    assert.equal(stored.status, 'connected');
    assert.equal(stored.lastError, null);
    assert.equal(stored.lastErrorAt, null);
  } finally {
    if (organizationId !== null) {
      await workerDb.db
        .delete(organizations)
        .where(eq(organizations.id, organizationId));
    }

    await workerDb.client.end();
  }
});

test('connection health updates enforce tenant boundaries', async () => {
  const workerDb = createWorkerDb();
  let ownerOrganizationId: number | null = null;
  let otherOrganizationId: number | null = null;

  try {
    const [ownerOrganization] = await workerDb.db
      .insert(organizations)
      .values({
        name: 'Provider health owner',
        slug: 'provider-health-owner'
      })
      .returning({
        id: organizations.id
      });

    const [otherOrganization] = await workerDb.db
      .insert(organizations)
      .values({
        name: 'Provider health other',
        slug: 'provider-health-other'
      })
      .returning({
        id: organizations.id
      });

    assert.ok(ownerOrganization);
    assert.ok(otherOrganization);

    ownerOrganizationId = ownerOrganization.id;
    otherOrganizationId = otherOrganization.id;

    const [connection] = await workerDb.db
      .insert(providerConnections)
      .values({
        organizationId: ownerOrganization.id,
        provider: 'google',
        externalAccountId: 'tenant-boundary-account',
        refreshTokenEncrypted: 'test-encrypted-token'
      })
      .returning({
        id: providerConnections.id
      });

    assert.ok(connection);

    await assert.rejects(
      () =>
        refreshGoogleProviderAccessToken(
          workerDb.db,
          otherOrganization.id,
          connection.id,
          'test-refresh-token',
          async () => {
            throw new PermanentGoogleOAuthError(
              'Refresh token has been revoked',
              'invalid_grant'
            );
          }
        ),
      /Provider connection not found/
    );

    const [stored] = await workerDb.db
      .select({
        status: providerConnections.status,
        lastError: providerConnections.lastError,
        lastErrorAt: providerConnections.lastErrorAt
      })
      .from(providerConnections)
      .where(eq(providerConnections.id, connection.id))
      .limit(1);

    assert.ok(stored);
    assert.equal(stored.status, 'connected');
    assert.equal(stored.lastError, null);
    assert.equal(stored.lastErrorAt, null);
  } finally {
    if (otherOrganizationId !== null) {
      await workerDb.db
        .delete(organizations)
        .where(eq(organizations.id, otherOrganizationId));
    }

    if (ownerOrganizationId !== null) {
      await workerDb.db
        .delete(organizations)
        .where(eq(organizations.id, ownerOrganizationId));
    }

    await workerDb.client.end();
  }
});

