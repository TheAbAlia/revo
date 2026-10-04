import { eq } from 'drizzle-orm';

import {
  organizationBilling
} from '@/lib/db/schema';
import type {
  TenantDb
} from '@/server/api/db';

export async function getOrganizationBilling(
  db: TenantDb,
  organizationId: number
) {
  const [billing] = await db
    .select()
    .from(organizationBilling)
    .where(
      eq(
        organizationBilling.organizationId,
        organizationId
      )
    )
    .limit(1);

  return billing ?? null;
}
