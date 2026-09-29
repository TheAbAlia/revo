import 'server-only';

import { cookies } from 'next/headers';

const API_URL =
  process.env.REVO_API_URL ?? 'http://127.0.0.1:4000';

type DashboardShell = {
  organization: {
    id: number;
    name: string;
  };
  inboxCount: number;
};

export async function getDashboardShell(): Promise<
  DashboardShell | null
> {
  const session =
    (await cookies()).get('session')?.value;

  if (!session) {
    return null;
  }

  const response = await fetch(
    `${API_URL}/v1/dashboard/shell`,
    {
      headers: {
        cookie: `session=${session}`
      },
      cache: 'no-store'
    }
  );

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Revo API request failed with status ${response.status}`
    );
  }

  return response.json() as Promise<DashboardShell>;
}
