export type AutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

/** `skipped` means there was nothing worth saving yet (an empty draft): the status goes to idle. */
export type SaveResult = 'saved' | 'skipped';

const DEFAULT_DELAY_MS = 800;

/**
 * Debounced, one-at-a-time autosave of a patch that grows by merging: a change waits for a pause,
 * a change during a save is saved right after it (never two saves at once), and a failed save keeps
 * its patch for a retry. Pure state, no React: timers are the only side effect.
 */
export class Autosave<Patch extends object> {
  status: AutosaveStatus = 'idle';
  private pending: Patch | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | undefined;
  private reporting = true;

  constructor(
    private readonly options: {
      save: (patch: Patch) => Promise<SaveResult>;
      onStatus: (status: AutosaveStatus) => void;
      delay?: number;
    },
  ) {}

  change(patch: Patch) {
    this.pending = { ...this.pending, ...patch };
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.run();
    }, this.options.delay ?? DEFAULT_DELAY_MS);
    // While a save runs the status stays `saving`; the loop reports `dirty` when it ends.
    if (!this.running) this.setStatus('dirty');
  }

  /** Saves what is pending now; resolves when nothing is pending or in flight. Never rejects. */
  flush(): Promise<void> {
    this.clearTimer();
    return this.run();
  }

  retry() {
    void this.run();
  }

  /** Resumes reporting the status: React can run an effect again without recreating the state. */
  attach() {
    this.reporting = true;
  }

  /** Stops reporting the status (the owner is gone). Does not cancel a flush already started. */
  detach() {
    this.clearTimer();
    this.reporting = false;
  }

  private clearTimer() {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private setStatus(status: AutosaveStatus) {
    this.status = status;
    if (this.reporting) this.options.onStatus(status);
  }

  private run(): Promise<void> {
    this.running ??= this.loop().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private async loop() {
    let last: SaveResult | undefined;
    // While the pause timer is running the change waits for it, instead of saving back to back.
    while (this.pending && !this.timer) {
      const patch = this.pending;
      this.pending = undefined;
      this.setStatus('saving');
      try {
        last = await this.options.save(patch);
      } catch {
        // Whatever arrived during the save is newer, so it wins over the patch that failed. Read
        // through a cast: TypeScript still thinks `pending` is the `undefined` set before the await.
        const newer = this.pending as Patch | undefined;
        this.pending = { ...patch, ...newer };
        this.setStatus('error');
        return;
      }
    }
    if (this.pending) this.setStatus('dirty');
    else if (last) this.setStatus(last === 'saved' ? 'saved' : 'idle');
  }
}
