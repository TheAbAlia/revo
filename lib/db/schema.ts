import {
  jsonb,
  boolean,
  check,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
});

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  role: varchar('role', { length: 50 }).notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: integer('invited_by')
    .notNull()
    .references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
});

export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
}));

export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  invitationsSent: many(invitations),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, {
    fields: [activityLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
}

// -----------------------------------------------------------------------------
// Revo product domain
// -----------------------------------------------------------------------------

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const organizationBilling = pgTable(
  'organization_billing',
  {
    id: serial('id').primaryKey(),

    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, {
        onDelete: 'cascade'
      }),

    stripeCustomerId: text('stripe_customer_id').unique(),
    stripeSubscriptionId:
      text('stripe_subscription_id').unique(),
    stripeProductId: text('stripe_product_id'),
    planName: varchar('plan_name', { length: 50 }),
    subscriptionStatus: varchar(
      'subscription_status',
      { length: 20 }
    ),

    createdAt: timestamp('created_at')
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
  },
  (table) => [
    uniqueIndex(
      'organization_billing_organization_unique'
    ).on(table.organizationId)
  ]
);


export const automationSettings = pgTable(
  'automation_settings',
  {
    id: serial('id').primaryKey(),

    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    autoGenerateDrafts: boolean('auto_generate_drafts')
      .notNull()
      .default(false),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('automation_settings_organization_unique').on(
      table.organizationId
    ),
  ]
);

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: serial('id').primaryKey(),

    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    role: varchar('role', { length: 30 }).notNull().default('member'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('organization_members_org_user_unique').on(
      table.organizationId,
      table.userId
    ),
    index('organization_members_user_idx').on(table.userId),
  ]
);

export const providerConnections = pgTable(
  'provider_connections',
  {
    id: serial('id').primaryKey(),

    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    provider: varchar('provider', { length: 30 }).notNull(),
    externalAccountId: text('external_account_id').notNull(),

    refreshTokenEncrypted: text('refresh_token_encrypted').notNull(),

    status: varchar('status', { length: 30 })
      .notNull()
      .default('connected'),
    lastError: text('last_error'),
    lastErrorAt: timestamp('last_error_at'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('provider_connections_org_provider_account_unique').on(
      table.organizationId,
      table.provider,
      table.externalAccountId
    ),
    index('provider_connections_organization_idx').on(
      table.organizationId
    ),
  ]
);

export const locations = pgTable('locations', {
  id: serial('id').primaryKey(),

  organizationId: integer('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  name: varchar('name', { length: 160 }).notNull(),

  provider: varchar('provider', { length: 30 }),
  externalId: text('external_id'),

  providerConnectionId: integer('provider_connection_id')
    .references(() => providerConnections.id, {
      onDelete: 'set null'
    }),

  lastSyncAttemptAt: timestamp('last_sync_attempt_at'),
  lastSyncedAt: timestamp('last_synced_at'),
  lastSyncError: text('last_sync_error'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const brandVoices = pgTable('brand_voices', {
  id: serial('id').primaryKey(),

  organizationId: integer('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  name: varchar('name', { length: 100 }).notNull(),
  instructions: text('instructions').notNull(),

  isDefault: boolean('is_default').notNull().default(false),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const reviews = pgTable(
  'reviews',
  {
    id: serial('id').primaryKey(),

    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    locationId: integer('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),

    provider: varchar('provider', { length: 30 }).notNull(),
    externalId: text('external_id').notNull(),

    authorName: varchar('author_name', { length: 160 }).notNull(),
    authorInitials: varchar('author_initials', { length: 10 }).notNull(),

    rating: integer('rating').notNull(),
    content: text('content').notNull(),

    receivedAt: timestamp('received_at').notNull(),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('reviews_org_provider_external_id_unique').on(
      table.organizationId,
      table.provider,
      table.externalId
    ),
    index('reviews_organization_received_at_idx').on(
      table.organizationId,
      table.receivedAt
    ),
    index('reviews_location_received_at_idx').on(
      table.locationId,
      table.receivedAt
    ),
    check(
      'reviews_rating_check',
      sql`${table.rating} >= 1 AND ${table.rating} <= 5`
    ),
  ]
);

export const responses = pgTable(
  'responses',
  {
    id: serial('id').primaryKey(),

    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    reviewId: integer('review_id')
      .notNull()
      .references(() => reviews.id, { onDelete: 'cascade' }),

    content: text('content').notNull(),

    status: varchar('status', { length: 30 })
      .notNull()
      .default('draft'),

    generatedByAI: boolean('generated_by_ai')
      .notNull()
      .default(false),

    approvedAt: timestamp('approved_at'),
    publishedAt: timestamp('published_at'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('responses_organization_review_unique').on(
      table.organizationId,
      table.reviewId
    ),
  ]
);

export const aiResponseGenerations = pgTable(
  'ai_response_generations',
  {
    id: serial('id').primaryKey(),

    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    reviewId: integer('review_id')
      .notNull()
      .references(() => reviews.id, { onDelete: 'cascade' }),

    content: text('content').notNull(),

    provider: varchar('provider', { length: 50 }).notNull(),
    model: varchar('model', { length: 100 }).notNull(),
    promptVersion: varchar('prompt_version', { length: 100 })
      .notNull()
      .default('review-response-v1'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  }
);

// -----------------------------------------------------------------------------
// Background jobs
// -----------------------------------------------------------------------------

export const jobs = pgTable(
  'jobs',
  {
    id: serial('id').primaryKey(),

    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    type: varchar('type', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull(),
    dedupeKey: varchar('dedupe_key', { length: 200 }),

    status: varchar('status', { length: 30 })
      .notNull()
      .default('pending'),

    attempts: integer('attempts')
      .notNull()
      .default(0),

    maxAttempts: integer('max_attempts')
      .notNull()
      .default(3),

    availableAt: timestamp('available_at')
      .notNull()
      .defaultNow(),

    lockedAt: timestamp('locked_at'),
    lockedBy: varchar('locked_by', { length: 100 }),

    lastError: text('last_error'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('jobs_pending_idx').on(
      table.status,
      table.availableAt
    ),
    index('jobs_organization_idx').on(
      table.organizationId
    ),
    uniqueIndex('jobs_dedupe_key_unique').on(
      table.dedupeKey
    ),
  ]
);

// -----------------------------------------------------------------------------
// Revo relations
// -----------------------------------------------------------------------------

export const organizationsRelations = relations(
  organizations,
  ({ many, one }) => ({
    members: many(organizationMembers),
    automationSettings: one(automationSettings),
    billing: one(organizationBilling),
    providerConnections: many(providerConnections),
    locations: many(locations),
    brandVoices: many(brandVoices),
    reviews: many(reviews),
    responses: many(responses),
    aiResponseGenerations: many(aiResponseGenerations),
  })
);

export const organizationBillingRelations = relations(
  organizationBilling,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationBilling.organizationId],
      references: [organizations.id],
    }),
  })
);

export const automationSettingsRelations = relations(
  automationSettings,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [automationSettings.organizationId],
      references: [organizations.id],
    }),
  })
);

export const organizationMembersRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organizationId],
      references: [organizations.id],
    }),

    user: one(users, {
      fields: [organizationMembers.userId],
      references: [users.id],
    }),
  })
);

export const providerConnectionsRelations = relations(
  providerConnections,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [providerConnections.organizationId],
      references: [organizations.id],
    }),

    locations: many(locations),
  })
);

export const locationsRelations = relations(
  locations,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [locations.organizationId],
      references: [organizations.id],
    }),

    providerConnection: one(providerConnections, {
      fields: [locations.providerConnectionId],
      references: [providerConnections.id],
    }),

    reviews: many(reviews),
  })
);

export const brandVoicesRelations = relations(
  brandVoices,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [brandVoices.organizationId],
      references: [organizations.id],
    }),
  })
);

export const reviewsRelations = relations(
  reviews,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [reviews.organizationId],
      references: [organizations.id],
    }),

    location: one(locations, {
      fields: [reviews.locationId],
      references: [locations.id],
    }),

    responses: many(responses),
    aiResponseGenerations: many(aiResponseGenerations),
  })
);

export const responsesRelations = relations(
  responses,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [responses.organizationId],
      references: [organizations.id],
    }),

    review: one(reviews, {
      fields: [responses.reviewId],
      references: [reviews.id],
    }),
  })
);

export const aiResponseGenerationsRelations = relations(
  aiResponseGenerations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [aiResponseGenerations.organizationId],
      references: [organizations.id],
    }),

    review: one(reviews, {
      fields: [aiResponseGenerations.reviewId],
      references: [reviews.id],
    }),
  })
);

// -----------------------------------------------------------------------------
// Revo inferred database types
// -----------------------------------------------------------------------------

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type OrganizationBilling =
  typeof organizationBilling.$inferSelect;

export type NewOrganizationBilling =
  typeof organizationBilling.$inferInsert;

export type AutomationSettings =
  typeof automationSettings.$inferSelect;
export type NewAutomationSettings =
  typeof automationSettings.$inferInsert;

export type OrganizationMember =
  typeof organizationMembers.$inferSelect;
export type NewOrganizationMember =
  typeof organizationMembers.$inferInsert;

export type ProviderConnection = typeof providerConnections.$inferSelect;
export type NewProviderConnection = typeof providerConnections.$inferInsert;

export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;

export type BrandVoice = typeof brandVoices.$inferSelect;
export type NewBrandVoice = typeof brandVoices.$inferInsert;

export type ReviewRecord = typeof reviews.$inferSelect;
export type NewReviewRecord = typeof reviews.$inferInsert;

export type ResponseRecord = typeof responses.$inferSelect;
export type NewResponseRecord = typeof responses.$inferInsert;

export type AIResponseGenerationRecord =
  typeof aiResponseGenerations.$inferSelect;
export type NewAIResponseGenerationRecord =
  typeof aiResponseGenerations.$inferInsert;

export type JobRecord = typeof jobs.$inferSelect;
export type NewJobRecord = typeof jobs.$inferInsert;
