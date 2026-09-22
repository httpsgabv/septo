import { describe, expect, it } from 'vitest';
import { buildReminderNotification } from './notification-copy.js';

const noteId = '7f1c2b3a-0000-4000-8000-000000000001';

describe('buildReminderNotification', () => {
  it('uses the note title without exposing its body', () => {
    expect(buildReminderNotification({ id: noteId, title: 'Comprar café' })).toEqual({
      title: 'Lembrete',
      body: 'Comprar café',
      url: `/notes/${noteId}`,
      tag: `reminder:${noteId}`,
      topic: '7f1c2b3a000040008000000000000001',
    });
  });

  it('uses a safe fallback when the note has no title', () => {
    expect(buildReminderNotification({ id: noteId, title: '   ' }).body).toBe(
      'Toque para abrir a nota.',
    );
  });
});
