import type { PushPayload } from './push-sender.js';

const FALLBACK_BODY = 'Toque para abrir a nota.';

export function buildReminderNotification(note: { id: string; title: string }): PushPayload {
  return {
    title: 'Lembrete',
    body: note.title.trim() || FALLBACK_BODY,
    url: `/notes/${note.id}`,
    tag: `reminder:${note.id}`,
    topic: note.id.replaceAll('-', ''),
  };
}
