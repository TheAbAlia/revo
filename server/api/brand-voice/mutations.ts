import { and, eq } from 'drizzle-orm';

import { brandVoices } from '@/lib/db/schema';
import type { TenantDb } from '@/server/api/db';

export async function getDefaultBrandVoice(
  db: TenantDb,
  organizationId: number
) {
  const [brandVoice] = await db
    .select({
      name: brandVoices.name,
      instructions: brandVoices.instructions
    })
    .from(brandVoices)
    .where(
      and(
        eq(
          brandVoices.organizationId,
          organizationId
        ),
        eq(brandVoices.isDefault, true)
      )
    )
    .limit(1);

  return brandVoice ?? null;
}

export async function saveDefaultBrandVoice(
  db: TenantDb,
  organizationId: number,
  name: string,
  instructions: string
) {
  const normalizedName = name.trim();
  const normalizedInstructions =
    instructions.trim();

  const [existingDefault] = await db
    .select({
      id: brandVoices.id
    })
    .from(brandVoices)
    .where(
      and(
        eq(
          brandVoices.organizationId,
          organizationId
        ),
        eq(brandVoices.isDefault, true)
      )
    )
    .limit(1);

  if (existingDefault) {
    await db
      .update(brandVoices)
      .set({
        name: normalizedName,
        instructions: normalizedInstructions,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(brandVoices.id, existingDefault.id),
          eq(
            brandVoices.organizationId,
            organizationId
          )
        )
      );
  } else {
    await db.insert(brandVoices).values({
      organizationId,
      name: normalizedName,
      instructions: normalizedInstructions,
      isDefault: true
    });
  }

  return {
    name: normalizedName,
    instructions: normalizedInstructions
  };
}
