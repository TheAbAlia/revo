import { redirect } from 'next/navigation';
import { ReviewInbox } from '@/components/revo/review-inbox';
import { getOrganizationForUser } from '@/lib/db/queries';
import { getReviewInbox } from '@/lib/reviews/queries';

export default async function DashboardPage() {
  const membership = await getOrganizationForUser();

  if (!membership) {
    redirect('/sign-in');
  }

  const reviews = await getReviewInbox(
    membership.organization.id
  );

  return <ReviewInbox items={reviews} />;
}
