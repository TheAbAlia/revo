export type Review = {
  id: string;
  author: string;
  initials: string;
  rating: number;
  content: string;
  platform: 'Google';
  location: string;
  createdAt: string;
  status: 'needs-response' | 'draft' | 'published';
};

export const reviews: Review[] = [
  {
    id: 'review_1',
    author: 'Sarah Mitchell',
    initials: 'SM',
    rating: 5,
    content:
      'Fantastic experience from start to finish. The team was incredibly helpful and everything was handled quickly. Would absolutely recommend them.',
    platform: 'Google',
    location: 'Darmstadt',
    createdAt: '2h',
    status: 'needs-response'
  },
  {
    id: 'review_2',
    author: 'Daniel Weber',
    initials: 'DW',
    rating: 4,
    content:
      'Really good service and friendly staff. There was a short wait when I arrived, but otherwise everything went smoothly.',
    platform: 'Google',
    location: 'Darmstadt',
    createdAt: '5h',
    status: 'needs-response'
  },
  {
    id: 'review_3',
    author: 'Laura Klein',
    initials: 'LK',
    rating: 2,
    content:
      'Unfortunately my appointment started much later than expected. The staff were friendly, but communication about the delay could have been better.',
    platform: 'Google',
    location: 'Frankfurt',
    createdAt: 'Yesterday',
    status: 'draft'
  },
  {
    id: 'review_4',
    author: 'Michael Hartmann',
    initials: 'MH',
    rating: 5,
    content:
      'Excellent. Professional, friendly and very easy to deal with.',
    platform: 'Google',
    location: 'Frankfurt',
    createdAt: 'Yesterday',
    status: 'published'
  }
];
