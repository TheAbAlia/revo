import 'dotenv/config';

import { buildApi } from './app';

async function main() {
  const api = buildApi();

  const port = Number(process.env.API_PORT ?? 4000);
  const host = process.env.API_HOST ?? '127.0.0.1';

  await api.listen({
    port,
    host
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
