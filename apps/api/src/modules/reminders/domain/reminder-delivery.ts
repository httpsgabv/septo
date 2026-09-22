export type ReminderDeliveryStatus = 'pending' | 'retry' | 'sent' | 'failed' | 'canceled';

export type ReminderDeliveryProps = {
  id: string;
  noteId: string;
  scheduledFor: Date;
  subscriptionId: string;
  status: ReminderDeliveryStatus;
  attempts: number;
  nextAttemptAt: Date;
  lastStatusCode: number | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ReminderDeliveryInput = Pick<
  ReminderDeliveryProps,
  'noteId' | 'scheduledFor' | 'subscriptionId'
>;

const TERMINAL_STATUSES: readonly ReminderDeliveryStatus[] = ['sent', 'failed', 'canceled'];

export class ReminderDelivery {
  private constructor(private props: ReminderDeliveryProps) {}

  static create(input: ReminderDeliveryInput, now: Date) {
    return new ReminderDelivery({
      id: crypto.randomUUID(),
      ...input,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: now,
      lastStatusCode: null,
      sentAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: ReminderDeliveryProps) {
    return new ReminderDelivery(props);
  }

  get id() {
    return this.props.id;
  }
  get noteId() {
    return this.props.noteId;
  }
  get scheduledFor() {
    return this.props.scheduledFor;
  }
  get subscriptionId() {
    return this.props.subscriptionId;
  }
  get status() {
    return this.props.status;
  }
  get attempts() {
    return this.props.attempts;
  }
  get nextAttemptAt() {
    return this.props.nextAttemptAt;
  }
  get lastStatusCode() {
    return this.props.lastStatusCode;
  }
  get sentAt() {
    return this.props.sentAt;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }

  scheduleRetry(nextAttemptAt: Date, statusCode: number | undefined, now: Date) {
    this.assertActive();
    this.props.status = 'retry';
    this.props.attempts += 1;
    this.props.nextAttemptAt = nextAttemptAt;
    this.props.lastStatusCode = statusCode ?? null;
    this.props.updatedAt = now;
  }

  recordSent(now: Date) {
    this.assertActive();
    this.props.status = 'sent';
    this.props.attempts += 1;
    this.props.lastStatusCode = null;
    this.props.sentAt = now;
    this.props.updatedAt = now;
  }

  recordFailed(statusCode: number | undefined, now: Date) {
    this.assertActive();
    this.props.status = 'failed';
    this.props.attempts += 1;
    this.props.lastStatusCode = statusCode ?? null;
    this.props.updatedAt = now;
  }

  cancel(now: Date) {
    this.assertActive();
    this.props.status = 'canceled';
    this.props.updatedAt = now;
  }

  private assertActive() {
    if (TERMINAL_STATUSES.includes(this.props.status)) {
      throw new Error(`Reminder delivery is terminal (${this.props.status})`);
    }
  }
}
