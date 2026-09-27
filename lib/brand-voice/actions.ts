'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db/drizzle';
import { brandVoices } from '@/lib/db/schema';
import { getOrganizationForUser } from '@/lib/db/queries';

export type BrandVoiceActionState = {
  error?: string;
  success?: string;
};

export async function saveDefaultBrandVoice(
  _previousState: BrandVoiceActionState,
  formData: FormData
): Promise<BrandVoiceActionState> {
  const membership = await getOrganizationForUser();

  if (!membership) {
    return { error: 'Unauthorized' };
  }

  const name = formData.get('name');
  const instructions = formData.get('instructions');

  if (typeof name !== 'string' || !name.trim()) {
    return { error: 'Voice name is required.' };
  }

  if (
    typeof instructions !== 'string' ||
    !instructions.trim()
  ) {
    return { error: 'Brand voice instructions are required.' };
  }

  const normalizedName = name.trim();
  const normalizedInstructions = instructions.trim();

  if (normalizedName.length > 100) {
    return { error: 'Voice name must be 100 characters or fewer.' };
  }

  if (normalizedInstructions.length > 4000) {
    return {
      error: 'Brand voice instructions must be 4,000 characters or fewer.'
    };
  }

  const organizationId = membership.organization.id;

  const [existingDefault] = await db
    .select({ id: brandVoices.id })
    .from(brandVoices)
    .where(
      and(
        eq(brandVoices.organizationId, organizationId),
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
          eq(brandVoices.organizationId, organizationId)
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

  revalidatePath('/brand-voice');
  revalidatePath('/');

  return { success: 'Brand voice saved.' };
}
