export type HealthReport = {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
};
