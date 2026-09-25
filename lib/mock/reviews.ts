import type {
  AIResponseGeneration,
  Review,
  ReviewResponse,
  ReviewWithResponse
} from '@/lib/domain/reviews';

const organizationId = 'org_alia';
const darmstadtLocationId = 'loc_darmstadt';
const frankfurtLocationId = 'loc_frankfurt';

export const reviews: Review[] = [
  {
    id: 'review_1',
    organizationId,
    locationId: darmstadtLocationId,
    provider: 'google',
    externalId: 'google_review_1',
    authorName: 'Sarah Mitchell',
    authorInitials: 'SM',
    rating: 5,
    content:
      'Fantastic experience from start to finish. The team was incredibly helpful and everything was handled quickly. Would absolutely recommend them.',
    receivedAt: '2026-09-25T10:00:00Z'
  },
  {
    id: 'review_2',
    organizationId,
    locationId: darmstadtLocationId,
    provider: 'google',
    externalId: 'google_review_2',
    authorName: 'Daniel Weber',
    authorInitials: 'DW',
    rating: 4,
    content:
      'Really good service and friendly staff. There was a short wait when I arrived, but otherwise everything went smoothly.',
    receivedAt: '2026-09-25T07:00:00Z'
  },
  {
    id: 'review_3',
    organizationId,
    locationId: frankfurtLocationId,
    provider: 'google',
    externalId: 'google_review_3',
    authorName: 'Laura Klein',
    authorInitials: 'LK',
    rating: 2,
    content:
      'Unfortunately my appointment started much later than expected. The staff were friendly, but communication about the delay could have been better.',
    receivedAt: '2026-09-24T15:00:00Z'
  },
  {
    id: 'review_4',
    organizationId,
    locationId: frankfurtLocationId,
    provider: 'google',
    externalId: 'google_review_4',
    authorName: 'Michael Hartmann',
    authorInitials: 'MH',
    rating: 5,
    content:
      'Excellent. Professional, friendly and very easy to deal with.',
    receivedAt: '2026-09-24T11:00:00Z'
  }
];

export const responses: ReviewResponse[] = [
  {
    id: 'response_3',
    reviewId: 'review_3',
    organizationId,
    content:
      'Thank you for your feedback. We are sorry about the delay and appreciate your kind words about our team. We will use your feedback to improve how we communicate waiting times.',
    status: 'draft',
    generatedByAI: true,
    createdAt: '2026-09-24T15:05:00Z',
    updatedAt: '2026-09-24T15:05:00Z',
    approvedAt: null,
    publishedAt: null
  },
  {
    id: 'response_4',
    reviewId: 'review_4',
    organizationId,
    content:
      'Thank you, Michael. We really appreciate your feedback and are glad you had such a positive experience with our team.',
    status: 'published',
    generatedByAI: true,
    createdAt: '2026-09-24T11:05:00Z',
    updatedAt: '2026-09-24T11:10:00Z',
    approvedAt: '2026-09-24T11:08:00Z',
    publishedAt: '2026-09-24T11:10:00Z'
  }
];

export const aiGenerations: AIResponseGeneration[] = [
  {
    id: 'generation_3',
    reviewId: 'review_3',
    organizationId,
    content: responses[0].content,
    provider: 'mock',
    model: 'mock-response-v1',
    createdAt: '2026-09-24T15:05:00Z'
  },
  {
    id: 'generation_4',
    reviewId: 'review_4',
    organizationId,
    content: responses[1].content,
    provider: 'mock',
    model: 'mock-response-v1',
    createdAt: '2026-09-24T11:05:00Z'
  }
];

export const reviewInbox: ReviewWithResponse[] = reviews.map((review) => ({
  review,
  response:
    responses.find((response) => response.reviewId === review.id) ?? null,
  locationName:
    review.locationId === darmstadtLocationId
      ? 'Darmstadt'
      : 'Frankfurt'
}));
