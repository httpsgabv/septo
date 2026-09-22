import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseEnv } from '../../../shared/env.js';
import type { DispatchSummary } from '../application/dispatch-due-reminders.use-case.js';
import { ReminderSchedulerService } from './reminder-scheduler.service.js';

const summary: DispatchSummary = {
  candidates: 1,
  ready: 1,
  sent: 1,
  retried: 0,
  failed: 0,
  canceled: 0,
  subscriptionsRemoved: 0,
};

const flush = () => vi.advanceTimersByTimeAsync(0);

describe('ReminderSchedulerService', () => {
  const execute = vi.fn<() => Promise<DispatchSummary>>();
  const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  let scheduler: ReminderSchedulerService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    execute.mockResolvedValue(summary);
    scheduler = new ReminderSchedulerService(
      { execute } as never,
      parseEnv({ NODE_ENV: 'development' }),
    );
  });

  afterEach(async () => {
    await scheduler.onApplicationShutdown();
    vi.useRealTimers();
  });

  it('ticks immediately, then every 60 seconds, and logs the summary', async () => {
    scheduler.onApplicationBootstrap();
    await flush();

    expect(execute).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({ event: 'reminder_scheduler_tick', ...summary });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('skips an interval while the previous tick is still running', async () => {
    let finish: ((value: DispatchSummary) => void) | undefined;
    execute.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    scheduler.onApplicationBootstrap();
    await flush();

    await vi.advanceTimersByTimeAsync(120_000);
    expect(execute).toHaveBeenCalledTimes(1);

    finish?.(summary);
    await flush();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('logs a failed tick and keeps scheduling', async () => {
    execute.mockRejectedValueOnce(new Error('database unavailable'));
    scheduler.onApplicationBootstrap();
    await flush();

    expect(error).toHaveBeenCalledWith(
      'Reminder scheduler tick failed',
      expect.stringContaining('database unavailable'),
    );

    await vi.advanceTimersByTimeAsync(60_000);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('clears its interval on shutdown', async () => {
    scheduler.onApplicationBootstrap();
    await flush();
    expect(vi.getTimerCount()).toBe(1);

    await scheduler.onApplicationShutdown();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(vi.getTimerCount()).toBe(0);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('does not start automatically under NODE_ENV=test', async () => {
    scheduler = new ReminderSchedulerService({ execute } as never, parseEnv({ NODE_ENV: 'test' }));

    scheduler.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(execute).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
