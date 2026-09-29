import { redirect } from 'next/navigation';

import { BrandVoiceForm } from '@/components/revo/brand-voice-form';
import { getBrandVoice } from '@/lib/api/server';

export default async function BrandVoicePage() {
  const result = await getBrandVoice();

  if (
    !result.success &&
    result.error === 'Unauthorized'
  ) {
    redirect('/sign-in');
  }

  if (!result.success) {
    throw new Error(result.error);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-10">
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold tracking-[-0.02em]">
          Brand Voice
        </h1>

        <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
          Define how Revo should respond to customer reviews for
          {` ${result.organization.name}`}.
        </p>
      </div>

      <div className="mt-8 border-t pt-2">
        <BrandVoiceForm
          name={
            result.brandVoice?.name ??
            'Default voice'
          }
          instructions={
            result.brandVoice?.instructions ?? ''
          }
        />
      </div>
    </div>
  );
}
