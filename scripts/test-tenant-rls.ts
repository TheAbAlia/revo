import assert from 'node:assert/strict';
import test from 'node:test';
import postgres from 'postgres';

const adminUrl = process.env.POSTGRES_URL;
const apiUrl = process.env.POSTGRES_API_URL;

if (!adminUrl) {
  throw new Error('POSTGRES_URL is not configured');
}

if (!apiUrl) {
  throw new Error(
    'POSTGRES_API_URL is not configured'
  );
}

const admin = postgres(adminUrl, { max: 1 });
const api = postgres(apiUrl, { max: 1 });

let organizationAId: number;
let organizationBId: number;
let locationAId: number;
let locationBId: number;

async function setTenant(
  sql: postgres.TransactionSql,
  organizationId: number
) {
  await sql`
    select set_config(
      'revo.organization_id',
      ${String(organizationId)},
      true
    )
  `;
}

test.before(async () => {
  const [organizationA] = await admin`
    insert into organizations (
      name,
      slug
    )
    values (
      'RLS Test Organization A',
      ${`rls-test-a-${crypto.randomUUID()}`}
    )
    returning id
  `;

  const [organizationB] = await admin`
    insert into organizations (
      name,
      slug
    )
    values (
      'RLS Test Organization B',
      ${`rls-test-b-${crypto.randomUUID()}`}
    )
    returning id
  `;

  organizationAId = organizationA.id;
  organizationBId = organizationB.id;

  const [locationA] = await admin`
    insert into locations (
      organization_id,
      name
    )
    values (
      ${organizationAId},
      'RLS Location A'
    )
    returning id
  `;

  const [locationB] = await admin`
    insert into locations (
      organization_id,
      name
    )
    values (
      ${organizationBId},
      'RLS Location B'
    )
    returning id
  `;

  locationAId = locationA.id;
  locationBId = locationB.id;
});

test.after(async () => {
  try {
    if (organizationAId) {
      await admin`
        delete from organizations
        where id = ${organizationAId}
      `;
    }

    if (organizationBId) {
      await admin`
        delete from organizations
        where id = ${organizationBId}
      `;
    }
  } finally {
    await api.end();
    await admin.end();
  }
});

test(
  'API role cannot read tenant rows without context',
  async () => {
    const rows = await api`
      select id
      from locations
      where id in (
        ${locationAId},
        ${locationBId}
      )
    `;

    assert.equal(rows.length, 0);
  }
);

test(
  'tenant context exposes only its own rows',
  async () => {
    await api.begin(async (tx) => {
      await setTenant(tx, organizationAId);

      const rows = await tx`
        select id, organization_id
        from locations
        where id in (
          ${locationAId},
          ${locationBId}
        )
        order by id
      `;

      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, locationAId);
      assert.equal(
        rows[0].organization_id,
        organizationAId
      );
    });
  }
);

test(
  'tenant cannot update another tenant row',
  async () => {
    await api.begin(async (tx) => {
      await setTenant(tx, organizationAId);

      const rows = await tx`
        update locations
        set name = 'Cross-tenant update'
        where id = ${locationBId}
        returning id
      `;

      assert.equal(rows.length, 0);
    });

    const [row] = await admin`
      select name
      from locations
      where id = ${locationBId}
    `;

    assert.equal(row.name, 'RLS Location B');
  }
);

test(
  'tenant cannot insert a row for another tenant',
  async () => {
    await assert.rejects(
      api.begin(async (tx) => {
        await setTenant(tx, organizationAId);

        await tx`
          insert into locations (
            organization_id,
            name
          )
          values (
            ${organizationBId},
            'Forbidden RLS Location'
          )
        `;
      }),
      (error: unknown) => {
        return (
          error instanceof Error &&
          error.message.includes(
            'row-level security policy'
          )
        );
      }
    );
  }
);

test(
  'tenant context does not leak after transaction',
  async () => {
    await api.begin(async (tx) => {
      await setTenant(tx, organizationAId);

      const rows = await tx`
        select id
        from locations
        where id = ${locationAId}
      `;

      assert.equal(rows.length, 1);
    });

    const rows = await api`
      select id
      from locations
      where id = ${locationAId}
    `;

    assert.equal(rows.length, 0);
  }
);
