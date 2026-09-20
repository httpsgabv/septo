import { NoteEmptyError } from './errors.js';
import { buildSearchText } from './search-text.js';
import { normalizeTags } from './tags.js';

type NoteProps = {
  id: string;
  title: string;
  /** Markdown. */
  body: string;
  /** Derived from title and body by the entity itself; nothing outside sets it. */
  searchText: string;
  tags: readonly string[];
  pinnedAt: Date | null;
  archivedAt: Date | null;
  remindAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NoteInput = {
  title?: string;
  body?: string;
  tags?: readonly string[];
  remindAt?: Date | null;
};

/** `undefined` leaves a field alone; for `remindAt`, `null` clears it. */
export type NotePatch = NoteInput;

const isBlank = (text: string) => text.trim() === '';
const sameInstant = (a: Date | null, b: Date | null) => a?.getTime() === b?.getTime();

export class Note {
  private constructor(private props: NoteProps) {}

  static create(input: NoteInput, now: Date): Note {
    const title = input.title ?? '';
    const body = input.body ?? '';
    if (isBlank(title) && isBlank(body)) throw new NoteEmptyError();
    return new Note({
      id: crypto.randomUUID(),
      title,
      body,
      searchText: buildSearchText(title, body),
      tags: normalizeTags(input.tags ?? []),
      pinnedAt: null,
      archivedAt: null,
      remindAt: input.remindAt ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Rebuilds a stored note; `searchText` is recomputed, so a stale stored value never survives. */
  static restore(props: Omit<NoteProps, 'searchText'>): Note {
    return new Note({ ...props, searchText: buildSearchText(props.title, props.body) });
  }

  get id() {
    return this.props.id;
  }
  get title() {
    return this.props.title;
  }
  get body() {
    return this.props.body;
  }
  get searchText() {
    return this.props.searchText;
  }
  get tags() {
    return this.props.tags;
  }
  get pinnedAt() {
    return this.props.pinnedAt;
  }
  get archivedAt() {
    return this.props.archivedAt;
  }
  get remindAt() {
    return this.props.remindAt;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }

  /**
   * Validates everything before changing anything. `updatedAt` only moves when a value actually
   * changes, so a no-op autosave does not reorder the list.
   */
  edit(patch: NotePatch, now: Date) {
    const title = patch.title ?? this.props.title;
    const body = patch.body ?? this.props.body;
    if (isBlank(title) && isBlank(body)) throw new NoteEmptyError();
    const tags = patch.tags === undefined ? this.props.tags : normalizeTags(patch.tags);
    const remindAt = patch.remindAt === undefined ? this.props.remindAt : patch.remindAt;

    const changed =
      title !== this.props.title ||
      body !== this.props.body ||
      tags.join('\n') !== this.props.tags.join('\n') ||
      !sameInstant(remindAt, this.props.remindAt);
    if (!changed) return;

    this.props = {
      ...this.props,
      title,
      body,
      tags,
      remindAt,
      searchText: buildSearchText(title, body),
      updatedAt: now,
    };
  }

  /** Idempotent, and does not count as an edit: `updatedAt` stays. */
  setPinned(pinned: boolean, now: Date) {
    this.props.pinnedAt = pinned ? (this.props.pinnedAt ?? now) : null;
  }

  /** Idempotent, and does not count as an edit: `updatedAt` stays. */
  setArchived(archived: boolean, now: Date) {
    this.props.archivedAt = archived ? (this.props.archivedAt ?? now) : null;
  }
}
