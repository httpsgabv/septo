import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ENV, type Env } from '../../../shared/env.js';
import { DispatchDueRemindersUseCase } from '../application/dispatch-due-reminders.use-case.js';

export const REMINDER_POLL_INTERVAL_MS = 60_000;

@Injectable()
export class ReminderSchedulerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ReminderSchedulerService.name);
  private timer: NodeJS.Timeout | undefined;
  private activeTick: Promise<void> | undefined;

  constructor(
    private readonly dispatch: DispatchDueRemindersUseCase,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onApplicationBootstrap() {
    if (this.env.NODE_ENV === 'test') return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), REMINDER_POLL_INTERVAL_MS);
    this.timer.unref();
  }

  async onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.activeTick;
  }

  private tick() {
    if (this.activeTick) return this.activeTick;
    const active = this.dispatch
      .execute()
      .then((summary) => this.logger.log({ event: 'reminder_scheduler_tick', ...summary }))
      .catch((cause: unknown) => {
        const trace = cause instanceof Error ? cause.stack : undefined;
        this.logger.error('Reminder scheduler tick failed', trace);
      })
      .finally(() => {
        if (this.activeTick === active) this.activeTick = undefined;
      });
    this.activeTick = active;
    return active;
  }
}
