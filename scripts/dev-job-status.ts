import dotenv from 'dotenv';
import { and, eq } from 'drizzle-orm';
import { jobs } from '@/lib/db/schema';

dotenv.config({
  path: '.env.local',
  override: true
});

async function main() {
  const jobId = Number(process.argv[2]);
  const organizationId = Number(process.argv[3]);

  if (
    !Number.isInteger(jobId) ||
    jobId <= 0 ||
    !Number.isInteger(organizationId) ||
    organizationId <= 0
  ) {
    console.error(
      'Usage: pnpm exec tsx scripts/dev-job-status.ts <job-id> <organization-id>'
    );
    process.exit(1);
  }

  const { createWorkerDb } = await import(
    '@/lib/db/worker'
  );
  const { client, db } = createWorkerDb();

  try {
    const [job] = await db
      .select({
        id: jobs.id,
        organizationId: jobs.organizationId,
        type: jobs.type,
        payload: jobs.payload,
        status: jobs.status,
        attempts: jobs.attempts,
        maxAttempts: jobs.maxAttempts,
        availableAt: jobs.availableAt,
        lockedAt: jobs.lockedAt,
        lockedBy: jobs.lockedBy,
        lastError: jobs.lastError,
        createdAt: jobs.createdAt,
        updatedAt: jobs.updatedAt
      })
      .from(jobs)
      .where(
        and(
          eq(jobs.id, jobId),
          eq(jobs.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!job) {
      console.log(`Job ${jobId} not found for organization ${organizationId}`);
      return;
    }

    console.log({
      id: job.id,
      type: job.type,
      status: job.status,
      attempts: `${job.attempts}/${job.maxAttempts}`,
      availableAt: job.availableAt.toISOString(),
      lockedAt: job.lockedAt?.toISOString() ?? null,
      lockedBy: job.lockedBy,
      lastError: job.lastError,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString()
    });
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
