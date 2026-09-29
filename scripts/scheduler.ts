import dotenv from 'dotenv';

dotenv.config({
  path: '.env.local',
  override: true
});

async function main() {
  const { runScheduler } = await import(
    './scheduler-runtime'
  );

  await runScheduler();
}

main().catch((error) => {
  console.error('[scheduler] fatal bootstrap error', error);
  process.exit(1);
});
