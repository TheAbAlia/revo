import type { Provider } from '@/lib/integrations/providers/types';

export type PublishReviewResponseInput = {
  provider: Provider;
  organizationId: number;
  locationExternalId: string;
  reviewExternalId: string;
  content: string;
};

export type ReviewResponsePublisher = (
  input: PublishReviewResponseInput
) => Promise<void>;
