import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { BrandVoiceForm } from '@/components/revo/brand-voice-form';
import { db } from '@/lib/db/drizzle';
import { getOrganizationForUser } from '@/lib/db/queries';
import { brandVoices } from '@/lib/db/schema';

export default async function BrandVoicePage() {
  const membership = await getOrganizationForUser();

  if (!membership) {
    redirect('/sign-in');
  }

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
          membership.organization.id
        ),
        eq(brandVoices.isDefault, true)
      )
    )
    .limit(1);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-10">
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold tracking-[-0.02em]">
          Brand Voice
        </h1>

        <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
          Define how Revo should respond to customer reviews for
          {` ${membership.organization.name}`}.
        </p>
      </div>

      <div className="mt-8 border-t pt-2">
        <BrandVoiceForm
          name={brandVoice?.name ?? 'Default voice'}
          instructions={brandVoice?.instructions ?? ''}
        />
      </div>
    </div>
  );
}
