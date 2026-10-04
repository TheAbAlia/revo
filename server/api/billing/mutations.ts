import { eq } from 'drizzle-orm';

import {
  organizationBilling
} from '@/lib/db/schema';
import type {
  TenantDb
} from '@/server/api/db';

export type OrganizationBillingUpdate = {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeProductId?: string | null;
  planName?: string | null;
  subscriptionStatus?: string | null;
};

export async function upsertOrganizationBilling(
  db: TenantDb,
  organizationId: number,
  values: OrganizationBillingUpdate
) {
  const [billing] = await db
    .insert(organizationBilling)
    .values({
      organizationId,
      ...values
    })
    .onConflictDoUpdate({
      target: organizationBilling.organizationId,
      set: {
        ...values,
        updatedAt: new Date()
      }
    })
    .returning();

  return billing;
}

export async function updateOrganizationBilling(
  db: TenantDb,
  organizationId: number,
  values: OrganizationBillingUpdate
) {
  const [billing] = await db
    .update(organizationBilling)
    .set({
      ...values,
      updatedAt: new Date()
    })
    .where(
      eq(
        organizationBilling.organizationId,
        organizationId
      )
    )
    .returning();

  return billing ?? null;
}
