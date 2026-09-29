import { redirect } from 'next/navigation';

import { ReviewInbox } from '@/components/revo/review-inbox';
import { getReviewInbox } from '@/lib/api/server';

export default async function DashboardPage() {
  const reviews = await getReviewInbox();

  if (!reviews) {
    redirect('/sign-in');
  }

  return <ReviewInbox items={reviews} />;
}
