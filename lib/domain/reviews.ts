import type { Provider } from '@/lib/integrations/providers/types';

export type ReviewProvider = Provider;

export type Review = {
  id: string;

  organizationId: string;
  locationId: string;

  provider: ReviewProvider;
  externalId: string;

  authorName: string;
  authorInitials: string;

  rating: number;
  content: string;

  receivedAt: string;
};

export type ResponseStatus =
  | 'draft'
  | 'approved'
  | 'published';

export type ReviewResponse = {
  id: string;

  reviewId: string;
  organizationId: string;

  content: string;
  status: ResponseStatus;

  generatedByAI: boolean;

  createdAt: string;
  updatedAt: string;

  approvedAt: string | null;
  publishedAt: string | null;
};

export type AIResponseGeneration = {
  id: string;

  reviewId: string;
  organizationId: string;

  content: string;

  provider: string;
  model: string;

  createdAt: string;
};

export type ReviewWithResponse = {
  review: Review;
  response: ReviewResponse | null;
  locationName: string;
  canPublish: boolean;
  responsePublishingStatus:
    | 'queued'
    | 'publishing'
    | 'failed'
    | null;
  responsePublishingError: string | null;
  responseGenerationStatus:
    | 'queued'
    | 'generating'
    | 'failed'
    | null;
  responseGenerationError: string | null;
};
