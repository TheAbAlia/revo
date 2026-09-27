const JOB_LEASE_TIMEOUT_MS = 10 * 60_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 2 * 60_000;
const MIN_HEARTBEAT_INTERVAL_MS = 1000;

export function getJobLeaseTimeoutMs() {
  return JOB_LEASE_TIMEOUT_MS;
}

export function getJobHeartbeatIntervalMs() {
  const configured = Number(
    process.env.WORKER_HEARTBEAT_INTERVAL_MS
  );

  const maxHeartbeatIntervalMs =
    Math.floor(JOB_LEASE_TIMEOUT_MS / 3);

  if (
    !Number.isFinite(configured) ||
    configured < MIN_HEARTBEAT_INTERVAL_MS
  ) {
    return DEFAULT_HEARTBEAT_INTERVAL_MS;
  }

  return Math.min(
    configured,
    maxHeartbeatIntervalMs
  );
}
