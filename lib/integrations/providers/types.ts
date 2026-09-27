export type Provider = 'google';

export type NormalizedProviderReview = {
  provider: Provider;
  externalId: string;
  authorName: string;
  authorInitials: string;
  rating: number;
  content: string;
  receivedAt: Date;
};
