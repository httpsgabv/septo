export type ReminderCandidate = {
  id: string;
  title: string;
  remindAt: Date;
  updatedAt: Date;
};

export abstract class ReminderSource {
  abstract listDue(input: {
    after: Date;
    through: Date;
    limit: number;
  }): Promise<ReminderCandidate[]>;

  abstract findCurrent(id: string, scheduledFor: Date): Promise<ReminderCandidate | null>;
}
