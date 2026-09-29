'use server';

import { revalidatePath } from 'next/cache';

import { saveBrandVoice } from '@/lib/api/server';

export type BrandVoiceActionState = {
  error?: string;
  success?: string;
};

export async function saveDefaultBrandVoice(
  _previousState: BrandVoiceActionState,
  formData: FormData
): Promise<BrandVoiceActionState> {
  const name = formData.get('name');
  const instructions = formData.get('instructions');

  if (typeof name !== 'string' || !name.trim()) {
    return { error: 'Voice name is required.' };
  }

  if (
    typeof instructions !== 'string' ||
    !instructions.trim()
  ) {
    return {
      error:
        'Brand voice instructions are required.'
    };
  }

  const normalizedName = name.trim();
  const normalizedInstructions =
    instructions.trim();

  if (normalizedName.length > 100) {
    return {
      error:
        'Voice name must be 100 characters or fewer.'
    };
  }

  if (normalizedInstructions.length > 4000) {
    return {
      error:
        'Brand voice instructions must be 4,000 characters or fewer.'
    };
  }

  const result = await saveBrandVoice(
    normalizedName,
    normalizedInstructions
  );

  if (!result.success) {
    return {
      error: result.error
    };
  }

  revalidatePath('/brand-voice');
  revalidatePath('/');

  return {
    success: 'Brand voice saved.'
  };
}
