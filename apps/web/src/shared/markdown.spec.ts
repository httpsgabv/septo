import { describe, expect, it } from 'vitest';
import { markdownSchema, markdownSerializer, parseMarkdown, serializeMarkdown } from './markdown';

/** Markdown in its canonical form: parsing and serializing it must give the same bytes back. */
const canonical: [name: string, markdown: string][] = [
  ['h1', '# Título'],
  ['h2', '## Título'],
  ['h3', '### Título'],
  ['bold', 'texto **negrito** aqui'],
  ['italic', 'texto *itálico* aqui'],
  ['strikethrough', 'texto ~~riscado~~ aqui'],
  ['nested marks', '**negrito e *itálico* juntos**'],
  ['inline code', 'use `npm test` agora'],
  ['code block', '```\nconst a = 1;\n```'],
  ['code block with language', '```ts\nconst a = 1;\n```'],
  ['code block containing a fence', '````\n```\ndentro\n```\n````'],
  ['bullet list', '- um\n- dois\n- três'],
  ['ordered list', '1. um\n2. dois\n3. três'],
  ['ordered list not starting at 1', '3. três\n4. quatro'],
  ['nested bullet list', '- pai\n  - filho\n  - outro filho\n- segundo pai'],
  ['nested ordered list', '1. pai\n   1. filho\n2. segundo pai'],
  ['ordered list inside bullet list', '- pai\n  1. filho'],
  ['blockquote', '> citação'],
  ['blockquote with two paragraphs', '> um\n>\n> dois'],
  ['link', 'veja [o site](https://example.com) hoje'],
  ['autolink', '<https://example.com>'],
  ['horizontal rule', 'antes\n\n---\n\ndepois'],
  ['hard break', 'linha um\\\nlinha dois'],
  ['multiple paragraphs', 'um\n\ndois\n\ntrês'],
  ['heading followed by list', '## Compras\n\n- pão\n- leite'],
  ['escaped asterisk', '2 \\* 3 = 6'],
  ['escaped underscore', '\\_solto\\_ mas snake_case_name fica'],
  ['escaped tilde', '\\~\\~não riscado\\~\\~'],
  ['escaped brackets', '\\[não é link\\]'],
  ['escaped # at line start', '\\# não é título'],
  ['escaped list marker at line start', '\\- não é item'],
  ['escaped quote marker at line start', '\\> não é citação'],
  ['escaped numbered list at line start', '1\\. não é lista'],
  ['empty document', ''],
];

describe('markdown bridge', () => {
  describe.each(canonical)('%s', (_name, markdown) => {
    it('round-trips markdown → document → markdown byte for byte', () => {
      expect(serializeMarkdown(parseMarkdown(markdown))).toBe(markdown);
    });

    it('round-trips document → markdown → document', () => {
      const doc = parseMarkdown(markdown);
      expect(parseMarkdown(serializeMarkdown(doc))).toEqual(doc);
    });
  });

  it('parses an empty markdown into a document with one empty paragraph (schema rule: block+)', () => {
    expect(parseMarkdown('')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });

  it('maps markdown onto the Tiptap node names, not the prosemirror-markdown defaults', () => {
    const doc = parseMarkdown('- item\n\n---\n\n```\ncode\n```');
    expect(doc.content?.map((node) => node.type)).toEqual([
      'bulletList',
      'horizontalRule',
      'codeBlock',
    ]);
    expect(doc.content?.[0]?.content?.[0]?.type).toBe('listItem');
  });

  describe('non-canonical input is normalized, and the normal form is stable', () => {
    const normalized: [name: string, markdown: string, expected: string][] = [
      ['`*` bullets', '* a\n* b', '- a\n- b'],
      ['`+` bullets', '+ a\n+ b', '- a\n- b'],
      ['setext heading', 'Título\n=====', '# Título'],
      [
        'heading level above 3 is clamped to h3 (the editor only renders h1–h3)',
        '#### fundo',
        '### fundo',
      ],
      ['`__bold__` and `_italic_`', '__negrito__ e _itálico_', '**negrito** e *itálico*'],
      ['soft line break becomes a space', 'linha\nseguinte', 'linha seguinte'],
      ['two trailing spaces become a hard break', 'a  \nb', 'a\\\nb'],
      ['indented code block becomes a fenced one', '    indentado', '```\nindentado\n```'],
      ['loose list becomes a tight list', '- a\n\n- b', '- a\n- b'],
      [
        'link title is dropped (the Tiptap link has no title)',
        '[a](https://e.com "título")',
        '[a](https://e.com)',
      ],
    ];

    it.each(normalized)('%s', (_name, markdown, expected) => {
      const once = serializeMarkdown(parseMarkdown(markdown));
      expect(once).toBe(expected);
      expect(serializeMarkdown(parseMarkdown(once))).toBe(once);
    });

    it('merges two adjacent lists into one on the next load (their text is kept)', () => {
      const list = (item: string) => ({
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }],
          },
        ],
      });
      const markdown = serializeMarkdown({ type: 'doc', content: [list('a'), list('b')] });
      expect(serializeMarkdown(parseMarkdown(markdown))).toBe('- a\n- b');
    });

    it('drops empty paragraphs (the editor creates them on double Enter)', () => {
      const doc = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'um' }] },
          { type: 'paragraph' },
          { type: 'paragraph' },
          { type: 'paragraph', content: [{ type: 'text', text: 'dois' }] },
        ],
      };
      expect(serializeMarkdown(doc)).toBe('um\n\ndois');
    });
  });

  // Out of the approved set (no tables, images, checklists or html in v1). Pasted markdown must not
  // throw or lose text: it degrades to plain text, and that text survives every later save.
  describe('constructs outside the approved set degrade to text without losing it', () => {
    it('table: kept as a paragraph of text (rows collapse into one line)', () => {
      const once = serializeMarkdown(parseMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |'));
      expect(once).toBe('| a | b | | --- | --- | | 1 | 2 |');
      expect(serializeMarkdown(parseMarkdown(once))).toBe(once);
    });

    it('image: kept as a "!" followed by a link (the serializer escapes the "!", stable from then on)', () => {
      const doc = parseMarkdown('![alt](https://example.com/a.png)');
      expect(JSON.stringify(doc)).not.toContain('"image"');
      const once = serializeMarkdown(doc);
      expect(once).toBe('\\![alt](https://example.com/a.png)');
      expect(serializeMarkdown(parseMarkdown(once))).toBe(once);
    });

    it('task list: becomes a bullet list whose text keeps the brackets', () => {
      const once = serializeMarkdown(parseMarkdown('- [ ] tarefa\n- [x] feita'));
      expect(once).toBe('- \\[ \\] tarefa\n- \\[x\\] feita');
      expect(serializeMarkdown(parseMarkdown(once))).toBe(once);
    });

    it('html: kept as literal text, never as markup', () => {
      const markdown = '<b>negrito</b> e <script>alert(1)</script>';
      const doc = parseMarkdown(markdown);
      expect(serializeMarkdown(doc)).toBe(markdown);
      expect(JSON.stringify(doc)).not.toContain('"bold"');
    });
  });

  describe('schema', () => {
    it('holds exactly the approved formatting set (widening it needs the spec to change first)', () => {
      expect(Object.keys(markdownSchema.nodes).sort()).toEqual([
        'blockquote',
        'bulletList',
        'codeBlock',
        'doc',
        'hardBreak',
        'heading',
        'horizontalRule',
        'listItem',
        'orderedList',
        'paragraph',
        'text',
      ]);
      expect(Object.keys(markdownSchema.marks).sort()).toEqual([
        'bold',
        'code',
        'italic',
        'link',
        'strike',
      ]);
    });

    it('has a serializer rule for every node and mark (doc is the root, serialized through its children)', () => {
      const nodesWithoutRule = Object.keys(markdownSchema.nodes).filter(
        (name) => name !== 'doc' && !(name in markdownSerializer.nodes),
      );
      const marksWithoutRule = Object.keys(markdownSchema.marks).filter(
        (name) => !(name in markdownSerializer.marks),
      );
      expect(nodesWithoutRule).toEqual([]);
      expect(marksWithoutRule).toEqual([]);
    });
  });
});
