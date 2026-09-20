import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Autosave, type AutosaveStatus, type SaveResult } from './autosave';

type Patch = { title?: string; body?: string };

/** A save the test resolves or rejects by hand, so overlapping saves can be staged. */
function setup(results: SaveResult[] = []) {
  const saves: { patch: Patch; done: (result?: SaveResult) => void; fail: () => void }[] = [];
  const statuses: AutosaveStatus[] = [];
  const autosave = new Autosave<Patch>({
    save: (patch) =>
      new Promise<SaveResult>((resolve, reject) => {
        saves.push({
          patch,
          done: (result) => resolve(result ?? results.shift() ?? 'saved'),
          fail: () => reject(new Error('network')),
        });
      }),
    onStatus: (status) => statuses.push(status),
  });
  return { autosave, saves, statuses };
}

/** Lets promise continuations run (the fake clock does not flush microtasks by itself). */
const settle = () => vi.advanceTimersByTimeAsync(0);

describe('Autosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts idle and does nothing until something changes', async () => {
    const { autosave, saves } = setup();

    await vi.advanceTimersByTimeAsync(5000);

    expect(autosave.status).toBe('idle');
    expect(saves).toHaveLength(0);
  });

  it('saves 800 ms after the last change: dirty → saving → saved', async () => {
    const { autosave, saves, statuses } = setup();

    autosave.change({ title: 'a' });
    expect(autosave.status).toBe('dirty');
    await vi.advanceTimersByTimeAsync(799);
    expect(saves).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(saves.map((s) => s.patch)).toEqual([{ title: 'a' }]);
    expect(autosave.status).toBe('saving');

    saves[0]?.done();
    await settle();
    expect(autosave.status).toBe('saved');
    expect(statuses).toEqual(['dirty', 'saving', 'saved']);
  });

  it('restarts the wait on every change and merges the patches, the latest field winning', async () => {
    const { autosave, saves } = setup();

    autosave.change({ title: 'a' });
    await vi.advanceTimersByTimeAsync(500);
    autosave.change({ body: 'x' });
    await vi.advanceTimersByTimeAsync(500);
    autosave.change({ title: 'b' });
    await vi.advanceTimersByTimeAsync(799);
    expect(saves).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(saves.map((s) => s.patch)).toEqual([{ title: 'b', body: 'x' }]);
  });

  describe('a change while a save is in flight', () => {
    it('is saved next, after the first one finishes: never overlapping, nothing lost', async () => {
      const { autosave, saves } = setup();
      autosave.change({ body: 'one' });
      await vi.advanceTimersByTimeAsync(800);
      expect(saves).toHaveLength(1);

      autosave.change({ body: 'two' });
      await vi.advanceTimersByTimeAsync(800); // the wait elapses while the first save is still running
      expect(saves).toHaveLength(1);
      expect(autosave.status).toBe('saving');

      saves[0]?.done();
      await settle();
      expect(saves.map((s) => s.patch)).toEqual([{ body: 'one' }, { body: 'two' }]);

      saves[1]?.done();
      await settle();
      expect(autosave.status).toBe('saved');
    });

    it('waits for its own pause when the save ends first, going back to dirty', async () => {
      const { autosave, saves } = setup();
      autosave.change({ body: 'one' });
      await vi.advanceTimersByTimeAsync(800);

      autosave.change({ body: 'two' });
      saves[0]?.done();
      await settle();
      expect(autosave.status).toBe('dirty');
      expect(saves).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(800);
      expect(saves.map((s) => s.patch)).toEqual([{ body: 'one' }, { body: 'two' }]);
    });
  });

  describe('flush', () => {
    it('saves what is pending right away, without waiting for the pause', async () => {
      const { autosave, saves } = setup();
      autosave.change({ title: 'a' });

      const flushed = autosave.flush();
      expect(saves.map((s) => s.patch)).toEqual([{ title: 'a' }]);
      saves[0]?.done();
      await flushed;

      expect(autosave.status).toBe('saved');
      await vi.advanceTimersByTimeAsync(5000);
      expect(saves).toHaveLength(1); // the cancelled timer does not save again
    });

    it('does nothing when nothing changed', async () => {
      const { autosave, saves } = setup();

      await autosave.flush();

      expect(saves).toHaveLength(0);
      expect(autosave.status).toBe('idle');
    });

    it('waits for the save in flight, then saves what came after it', async () => {
      const { autosave, saves } = setup();
      autosave.change({ body: 'one' });
      await vi.advanceTimersByTimeAsync(800);
      autosave.change({ body: 'two' });

      let done = false;
      const flushed = autosave.flush().then(() => {
        done = true;
      });
      await settle();
      expect(done).toBe(false);

      saves[0]?.done();
      await settle();
      expect(saves.map((s) => s.patch)).toEqual([{ body: 'one' }, { body: 'two' }]);
      saves[1]?.done();
      await flushed;
      expect(done).toBe(true);
      expect(autosave.status).toBe('saved');
    });
  });

  describe('failure', () => {
    it('reports the error and keeps the patch, so retry saves it', async () => {
      const { autosave, saves } = setup();
      autosave.change({ title: 'a' });
      await vi.advanceTimersByTimeAsync(800);

      saves[0]?.fail();
      await settle();
      expect(autosave.status).toBe('error');

      autosave.retry();
      expect(saves.map((s) => s.patch)).toEqual([{ title: 'a' }, { title: 'a' }]);
      saves[1]?.done();
      await settle();
      expect(autosave.status).toBe('saved');
    });

    it('saves the old and the new fields together when the user keeps typing', async () => {
      const { autosave, saves } = setup();
      autosave.change({ title: 'a' });
      await vi.advanceTimersByTimeAsync(800);
      saves[0]?.fail();
      await settle();

      autosave.change({ body: 'x' });
      expect(autosave.status).toBe('dirty');
      await vi.advanceTimersByTimeAsync(800);

      expect(saves[1]?.patch).toEqual({ title: 'a', body: 'x' });
    });

    it('keeps a change made during the failed save, newest value winning', async () => {
      const { autosave, saves } = setup();
      autosave.change({ title: 'a' });
      await vi.advanceTimersByTimeAsync(800);
      autosave.change({ title: 'b', body: 'x' });

      saves[0]?.fail();
      await settle();
      expect(autosave.status).toBe('error');

      await vi.advanceTimersByTimeAsync(800);
      expect(saves[1]?.patch).toEqual({ title: 'b', body: 'x' });
    });

    it('retry does nothing when there is nothing to save', async () => {
      const { autosave, saves } = setup();

      autosave.retry();

      expect(saves).toHaveLength(0);
    });
  });

  it('goes back to idle when the save skips (an empty draft: nothing to create yet)', async () => {
    const { autosave, saves } = setup(['skipped']);
    autosave.change({ title: '' });

    await vi.advanceTimersByTimeAsync(800);
    saves[0]?.done();
    await settle();

    expect(autosave.status).toBe('idle');
  });

  it('stops reporting after detach, but a flush still saves; attach resumes the reports', async () => {
    const { autosave, saves, statuses } = setup();
    autosave.change({ title: 'a' });
    autosave.detach();
    const seen = statuses.length;

    const flushed = autosave.flush();
    expect(saves.map((s) => s.patch)).toEqual([{ title: 'a' }]);
    saves[0]?.done();
    await flushed;
    expect(statuses).toHaveLength(seen);

    autosave.attach();
    autosave.change({ title: 'b' });
    expect(statuses.at(-1)).toBe('dirty');
  });
});
