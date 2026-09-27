import type { Provider } from '@/lib/integrations/providers/types';

export type PublishReviewResponseInput = {
  provider: Provider;
  organizationId: number;
  locationExternalId: string;
  reviewExternalId: string;
  content: string;
};

export type PublishReviewResponseResult = {
  externalResponseId?: string;
};

export type ReviewResponsePublisher = (
  input: PublishReviewResponseInput
) => Promise<PublishReviewResponseResult>;
