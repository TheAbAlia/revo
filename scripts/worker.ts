import dotenv from 'dotenv';

dotenv.config({
  path: '.env.local',
  override: true
});

async function main() {
  const { runWorker } = await import('./worker-runtime');
  await runWorker();
}

main().catch((error) => {
  console.error('[worker] fatal bootstrap error', error);
  process.exit(1);
});
