import dotenv from 'dotenv';

dotenv.config({
  path: '.env.local',
  override: true
});

async function main() {
  const jobId = Number(process.argv[2]);

  if (!Number.isInteger(jobId) || jobId <= 0) {
    console.error('Usage: pnpm exec tsx scripts/dev-job-status.ts <job-id>');
    process.exit(1);
  }

  const { client } = await import('@/lib/db/drizzle');
  const { getJob } = await import('@/lib/jobs/queries');

  try {
    const job = await getJob(2, jobId);

    if (!job) {
      console.log(`Job ${jobId} not found for organization 2`);
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
