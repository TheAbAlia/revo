import assert from 'node:assert/strict';
import test from 'node:test';

import { eq, sql } from 'drizzle-orm';

import { createApiDb } from '@/server/api/db';
import { createTestDb } from '@/lib/db/test';
import { createWorkerDb } from '@/lib/db/worker';
import {
  organizationMembers,
  organizations,
  users
} from '@/lib/db/schema';

test(
  'auth bootstrap is narrow and deterministic',
  async () => {
    const testDb = createTestDb();
    const apiDb = createApiDb();
    const workerDb = createWorkerDb();

    let userId: number | null = null;
    let organizationAId: number | null = null;
    let organizationBId: number | null = null;

    try {
      const [user] = await testDb.db
        .insert(users)
        .values({
          email:
            `auth-bootstrap-${crypto.randomUUID()}@example.com`,
          passwordHash: 'test',
          role: 'owner'
        })
        .returning({
          id: users.id
        });

      assert.ok(user);
      userId = user.id;

      const [organizationA] = await testDb.db
        .insert(organizations)
        .values({
          name: 'Auth Bootstrap A',
          slug:
            `auth-bootstrap-a-${crypto.randomUUID()}`
        })
        .returning({
          id: organizations.id
        });

      const [organizationB] = await testDb.db
        .insert(organizations)
        .values({
          name: 'Auth Bootstrap B',
          slug:
            `auth-bootstrap-b-${crypto.randomUUID()}`
        })
        .returning({
          id: organizations.id
        });

      assert.ok(organizationA);
      assert.ok(organizationB);

      organizationAId = organizationA.id;
      organizationBId = organizationB.id;

      await testDb.db
        .insert(organizationMembers)
        .values([
          {
            organizationId: organizationA.id,
            userId: user.id,
            role: 'owner'
          },
          {
            organizationId: organizationB.id,
            userId: user.id,
            role: 'member'
          }
        ]);

      const apiContext =
        await apiDb.db.execute<{
          user_id: number;
          organization_id: number;
          membership_role: string;
        }>(sql`
          SELECT
            user_id,
            organization_id,
            membership_role
          FROM public.revo_authenticated_context(
            ${user.id}
          )
        `);

      assert.equal(apiContext.length, 1);
      assert.equal(
        apiContext[0]?.user_id,
        user.id
      );
      assert.equal(
        apiContext[0]?.organization_id,
        organizationA.id
      );
      assert.equal(
        apiContext[0]?.membership_role,
        'owner'
      );

      await assert.rejects(
        workerDb.db.execute(sql`
          SELECT *
          FROM public.revo_authenticated_context(
            ${user.id}
          )
        `)
      );

      await apiDb.db.transaction(async (tx) => {
        await tx.execute(sql`
          SELECT set_config(
            'revo.organization_id',
            ${String(organizationA.id)},
            true
          )
        `);

        const visibleMemberships =
          await tx.execute<{
            organization_id: number;
          }>(sql`
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = ${user.id}
            ORDER BY organization_id
          `);

        assert.deepEqual(
          visibleMemberships.map(
            (row) => row.organization_id
          ),
          [organizationA.id]
        );
      });

      await assert.rejects(
        apiDb.db.transaction(async (tx) => {
          await tx.execute(sql`
            SELECT set_config(
              'revo.organization_id',
              ${String(organizationA.id)},
              true
            )
          `);

          await tx.execute(sql`
            INSERT INTO public.organization_members (
              organization_id,
              user_id,
              role
            )
            VALUES (
              ${organizationB.id},
              ${user.id},
              'member'
            )
          `);
        })
      );

      await assert.rejects(
        apiDb.db.transaction(async (tx) => {
          await tx.execute(sql`
            SELECT set_config(
              'revo.organization_id',
              ${String(organizationA.id)},
              true
            )
          `);

          await tx.execute(sql`
            UPDATE public.organization_members
            SET organization_id = ${organizationB.id}
            WHERE organization_id = ${organizationA.id}
              AND user_id = ${user.id}
          `);
        })
      );
    } finally {
      if (userId !== null) {
        await testDb.db
          .delete(organizationMembers)
          .where(
            eq(
              organizationMembers.userId,
              userId
            )
          );
      }

      if (organizationAId !== null) {
        await testDb.db
          .delete(organizations)
          .where(
            eq(
              organizations.id,
              organizationAId
            )
          );
      }

      if (organizationBId !== null) {
        await testDb.db
          .delete(organizations)
          .where(
            eq(
              organizations.id,
              organizationBId
            )
          );
      }

      if (userId !== null) {
        await testDb.db
          .delete(users)
          .where(eq(users.id, userId));
      }

      await apiDb.client.end();
      await workerDb.client.end();
      await testDb.client.end();
    }
  }
);
