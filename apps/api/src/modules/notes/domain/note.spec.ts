import { describe, expect, it } from 'vitest';
import { InvalidTagError, NoteEmptyError } from './errors.js';
import { Note } from './note.js';

const t0 = new Date('2026-09-20T10:00:00Z');
const t1 = new Date('2026-09-20T11:00:00Z');
const t2 = new Date('2026-09-20T12:00:00Z');

describe('Note.create', () => {
  it('starts unpinned, unarchived, without reminder, with both timestamps at `now`', () => {
    const note = Note.create({ title: 'Título', body: 'Corpo' }, t0);
    expect(note).toMatchObject({
      title: 'Título',
      body: 'Corpo',
      tags: [],
      pinnedAt: null,
      archivedAt: null,
      remindAt: null,
      createdAt: t0,
      updatedAt: t0,
    });
    expect(note.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('accepts only a title, or only a body', () => {
    expect(() => Note.create({ title: 'só título' }, t0)).not.toThrow();
    expect(() => Note.create({ body: 'só corpo' }, t0)).not.toThrow();
  });

  it.each([
    ['nothing', {}],
    ['empty strings', { title: '', body: '' }],
    ['only spaces and line breaks', { title: '  ', body: '\n \t' }],
  ])('rejects a note with %s', (_case, input) => {
    expect(() => Note.create(input, t0)).toThrow(NoteEmptyError);
  });

  it('normalizes tags and rejects invalid ones', () => {
    expect(Note.create({ title: 'a', tags: ['  Trabalho ', 'trabalho'] }, t0).tags).toEqual([
      'trabalho',
    ]);
    expect(() => Note.create({ title: 'a', tags: ['a/b'] }, t0)).toThrow(InvalidTagError);
  });

  it('accepts a reminder in the past (the UI warns, the domain does not block)', () => {
    const past = new Date('2020-01-01T00:00:00Z');
    expect(Note.create({ title: 'a', remindAt: past }, t0).remindAt).toEqual(past);
  });

  it('derives searchText from title and body, without accents', () => {
    const note = Note.create({ title: 'Anotação', body: 'Corpo' }, t0);
    expect(note.searchText).toContain('anotacao');
    expect(note.searchText).toContain('corpo');
  });
});

describe('Note.edit', () => {
  const make = () =>
    Note.create(
      { title: 'Título', body: 'Corpo', tags: ['a'], remindAt: new Date('2026-10-01T09:00:00Z') },
      t0,
    );

  it('applies the fields sent and moves updatedAt to `now`', () => {
    const note = make();
    note.edit(
      {
        title: 'Novo',
        body: 'Outro',
        tags: ['B', 'c'],
        remindAt: new Date('2026-11-01T09:00:00Z'),
      },
      t1,
    );
    expect(note).toMatchObject({
      title: 'Novo',
      body: 'Outro',
      tags: ['b', 'c'],
      remindAt: new Date('2026-11-01T09:00:00Z'),
      createdAt: t0,
      updatedAt: t1,
    });
  });

  it('leaves absent fields alone', () => {
    const note = make();
    note.edit({ title: 'Novo' }, t1);
    expect(note).toMatchObject({
      title: 'Novo',
      body: 'Corpo',
      tags: ['a'],
      remindAt: new Date('2026-10-01T09:00:00Z'),
    });
  });

  it('clears the reminder with null, and keeps it with undefined', () => {
    const note = make();
    note.edit({ remindAt: undefined, title: 'x' }, t1);
    expect(note.remindAt).not.toBeNull();
    note.edit({ remindAt: null }, t2);
    expect(note.remindAt).toBeNull();
    expect(note.updatedAt).toEqual(t2);
  });

  it('recalculates searchText', () => {
    const note = make();
    note.edit({ title: 'Ação', body: 'Rápida' }, t1);
    expect(note.searchText).toContain('acao');
    expect(note.searchText).toContain('rapida');
    expect(note.searchText).not.toContain('titulo');
  });

  it('does not move updatedAt when nothing actually changes', () => {
    const note = make();
    note.edit(
      { title: 'Título', body: 'Corpo', tags: ['A'], remindAt: new Date('2026-10-01T09:00:00Z') },
      t1,
    );
    note.edit({}, t2);
    expect(note.updatedAt).toEqual(t0);
  });

  it('clearing a reminder that is already clear changes nothing', () => {
    const note = Note.create({ title: 'a' }, t0);
    note.edit({ remindAt: null }, t1);
    expect(note.updatedAt).toEqual(t0);
  });

  it('accepts a title-only or body-only result', () => {
    const note = make();
    expect(() => note.edit({ body: '' }, t1)).not.toThrow();
    expect(() => note.edit({ title: '', body: 'volta' }, t2)).not.toThrow();
  });

  it('rejects an edit that leaves title and body empty, and changes nothing', () => {
    const note = Note.create({ title: 'só título' }, t0);
    expect(() => note.edit({ title: '  ', tags: ['x'] }, t1)).toThrow(NoteEmptyError);
    expect(note).toMatchObject({ title: 'só título', tags: [], updatedAt: t0 });
  });

  it('rejects invalid tags, and changes nothing', () => {
    const note = make();
    expect(() => note.edit({ title: 'Novo', tags: ['a/b'] }, t1)).toThrow(InvalidTagError);
    expect(note).toMatchObject({ title: 'Título', tags: ['a'], updatedAt: t0 });
  });
});

describe.each([
  ['pinned', 'pinnedAt', 'setPinned'],
  ['archived', 'archivedAt', 'setArchived'],
] as const)('%s', (_name, field, method) => {
  const make = () => Note.create({ title: 'Título' }, t0);

  it(`${method}(true) stamps ${field} with \`now\` and does not touch updatedAt`, () => {
    const note = make();
    note[method](true, t1);
    expect(note[field]).toEqual(t1);
    expect(note.updatedAt).toEqual(t0);
  });

  it(`${method}(true) twice keeps the first ${field}`, () => {
    const note = make();
    note[method](true, t1);
    note[method](true, t2);
    expect(note[field]).toEqual(t1);
  });

  it(`${method}(false) goes back to null, and is a no-op when already off`, () => {
    const note = make();
    note[method](true, t1);
    note[method](false, t2);
    expect(note[field]).toBeNull();
    note[method](false, t2);
    expect(note[field]).toBeNull();
    expect(note.updatedAt).toEqual(t0);
  });
});

describe('Note.restore', () => {
  it('rebuilds a stored note, deriving searchText itself', () => {
    const stored = {
      id: '0f9c6a0e-8a4b-4c39-9d5e-2f6f4f1c7a11',
      title: 'Anotação',
      body: 'Corpo',
      tags: ['a'],
      pinnedAt: t1,
      archivedAt: null,
      remindAt: t2,
      createdAt: t0,
      updatedAt: t1,
    };
    const note = Note.restore(stored);
    expect(note).toMatchObject(stored);
    expect(note.searchText).toContain('anotacao');
  });
});

describe('searchText', () => {
  it('has no public setter: only create and edit produce it', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Note.prototype, 'searchText');
    expect(descriptor?.get).toBeTypeOf('function');
    expect(descriptor?.set).toBeUndefined();
    const note = Note.create({ title: 'a' }, t0);
    expect(() => {
      // @ts-expect-error searchText is read-only
      note.searchText = 'x';
    }).toThrow(TypeError);
  });
});
