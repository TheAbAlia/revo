import { eq } from 'drizzle-orm';
import { db, client } from './drizzle';
import {
  aiResponseGenerations,
  brandVoices,
  locations,
  organizations,
  responses,
  reviews,
} from './schema';

async function seedRevo() {
  console.log('Seeding Revo data...');

  const [organization] = await db
    .insert(organizations)
    .values({
      name: 'Alia Lab',
      slug: 'alia-lab',
    })
    .onConflictDoUpdate({
      target: organizations.slug,
      set: {
        name: 'Alia Lab',
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!organization) {
    throw new Error('Failed to create organization');
  }

  await db
    .delete(aiResponseGenerations)
    .where(
      eq(
        aiResponseGenerations.organizationId,
        organization.id
      )
    );

  await db
    .delete(responses)
    .where(
      eq(
        responses.organizationId,
        organization.id
      )
    );

  await db
    .delete(reviews)
    .where(
      eq(
        reviews.organizationId,
        organization.id
      )
    );

  await db
    .delete(locations)
    .where(
      eq(
        locations.organizationId,
        organization.id
      )
    );

  await db
    .delete(brandVoices)
    .where(
      eq(
        brandVoices.organizationId,
        organization.id
      )
    );

  const [darmstadt, frankfurt] = await db
    .insert(locations)
    .values([
      {
        organizationId: organization.id,
        name: 'Darmstadt',
        provider: 'google',
        externalId: 'google_location_darmstadt',
      },
      {
        organizationId: organization.id,
        name: 'Frankfurt',
        provider: 'google',
        externalId: 'google_location_frankfurt',
      },
    ])
    .returning();

  if (!darmstadt || !frankfurt) {
    throw new Error('Failed to create seed locations');
  }

  await db.insert(brandVoices).values({
    organizationId: organization.id,
    name: 'Default voice',
    instructions:
      'Warm, professional, concise, and specific to the customer review.',
    isDefault: true,
  });

  const insertedReviews = await db
    .insert(reviews)
    .values([
      {
        organizationId: organization.id,
        locationId: darmstadt.id,
        provider: 'google',
        externalId: 'google_review_1',
        authorName: 'Sarah Mitchell',
        authorInitials: 'SM',
        rating: 5,
        content:
          'Fantastic experience from start to finish. The team was incredibly helpful and everything was handled quickly. Would absolutely recommend them.',
        receivedAt: new Date('2026-09-25T10:00:00Z'),
      },
      {
        organizationId: organization.id,
        locationId: darmstadt.id,
        provider: 'google',
        externalId: 'google_review_2',
        authorName: 'Daniel Weber',
        authorInitials: 'DW',
        rating: 4,
        content:
          'Really good service and friendly staff. There was a short wait when I arrived, but otherwise everything went smoothly.',
        receivedAt: new Date('2026-09-25T07:00:00Z'),
      },
      {
        organizationId: organization.id,
        locationId: frankfurt.id,
        provider: 'google',
        externalId: 'google_review_3',
        authorName: 'Laura Klein',
        authorInitials: 'LK',
        rating: 2,
        content:
          'Unfortunately my appointment started much later than expected. The staff were friendly, but communication about the delay could have been better.',
        receivedAt: new Date('2026-09-24T15:00:00Z'),
      },
      {
        organizationId: organization.id,
        locationId: frankfurt.id,
        provider: 'google',
        externalId: 'google_review_4',
        authorName: 'Michael Hartmann',
        authorInitials: 'MH',
        rating: 5,
        content:
          'Excellent. Professional, friendly and very easy to deal with.',
        receivedAt: new Date('2026-09-24T11:00:00Z'),
      },
    ])
    .returning();

  const laura = insertedReviews.find(
    (review) => review.externalId === 'google_review_3'
  );

  const michael = insertedReviews.find(
    (review) => review.externalId === 'google_review_4'
  );

  if (!laura || !michael) {
    throw new Error('Failed to create expected seed reviews');
  }

  const [lauraResponse] = await db
    .insert(responses)
    .values({
      organizationId: organization.id,
      reviewId: laura.id,
      content:
        'Thank you for your feedback. We are sorry about the delay and appreciate your kind words about our team. We will use your feedback to improve how we communicate waiting times.',
      status: 'draft',
      generatedByAI: true,
    })
    .returning();

  const [michaelResponse] = await db
    .insert(responses)
    .values({
      organizationId: organization.id,
      reviewId: michael.id,
      content:
        'Thank you, Michael. We really appreciate your feedback and are glad you had such a positive experience with our team.',
      status: 'published',
      generatedByAI: true,
      approvedAt: new Date('2026-09-24T11:08:00Z'),
      publishedAt: new Date('2026-09-24T11:10:00Z'),
    })
    .returning();

  if (!lauraResponse || !michaelResponse) {
    throw new Error('Failed to create seed responses');
  }

  await db.insert(aiResponseGenerations).values([
    {
      organizationId: organization.id,
      reviewId: laura.id,
      content: lauraResponse.content,
      provider: 'mock',
      model: 'mock-response-v1',
    },
    {
      organizationId: organization.id,
      reviewId: michael.id,
      content: michaelResponse.content,
      provider: 'mock',
      model: 'mock-response-v1',
    },
  ]);

  console.log(`Organization: ${organization.name}`);
  console.log('Locations: 2');
  console.log(`Reviews: ${insertedReviews.length}`);
  console.log('Responses: 2');
  console.log('AI generations: 2');
  console.log('Revo seed complete.');
}

seedRevo()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
