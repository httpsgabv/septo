import { getSchema, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  defaultMarkdownParser,
  defaultMarkdownSerializer,
  MarkdownParser,
  MarkdownSerializer,
} from 'prosemirror-markdown';

/**
 * The approved formatting set, shared by the notes editor and the dev-tools README reader, and the
 * single source for both the editor and the markdown bridge:
 * h1–h3, bold, italic, strike, code, code block, lists, blockquote, link, horizontal rule, hard break.
 * Widening it (tables, checklists, images, syntax highlight) needs the spec to change first.
 */
export const markdownExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    underline: false,
    link: { openOnClick: false },
  }),
];

export const markdownSchema = getSchema(markdownExtensions);

// Reuses the tokenizer of prosemirror-markdown's default parser (CommonMark, html off) instead of a
// direct `markdown-it` import, which is not a declared dependency. `~~strike~~` is the only rule
// CommonMark lacks. Images are turned off so `![alt](src)` stays text: a "!" followed by a link.
// Tables are not in CommonMark, so they stay paragraph text.
const tokenizer = defaultMarkdownParser.tokenizer.enable('strikethrough').disable('image');

// Token names come from markdown-it; node and mark names from the Tiptap schema (camelCase), which
// is why the prosemirror-markdown defaults (snake_case) cannot be used as they are.
const markdownParser = new MarkdownParser(markdownSchema, tokenizer, {
  paragraph: { block: 'paragraph' },
  blockquote: { block: 'blockquote' },
  // The Tiptap heading only renders levels 1–3, so deeper ones are clamped instead of shown as h1.
  heading: {
    block: 'heading',
    getAttrs: (token) => ({ level: Math.min(Number(token.tag.slice(1)), 3) }),
  },
  bullet_list: { block: 'bulletList' },
  ordered_list: {
    block: 'orderedList',
    getAttrs: (token) => ({ start: Number(token.attrGet('start')) || 1 }),
  },
  list_item: { block: 'listItem' },
  fence: {
    block: 'codeBlock',
    getAttrs: (token) => ({ language: token.info.trim() || null }),
    noCloseToken: true,
  },
  code_block: { block: 'codeBlock', noCloseToken: true },
  hr: { node: 'horizontalRule' },
  hardbreak: { node: 'hardBreak' },
  strong: { mark: 'bold' },
  em: { mark: 'italic' },
  s: { mark: 'strike' },
  code_inline: { mark: 'code', noCloseToken: true },
  link: { mark: 'link', getAttrs: (token) => ({ href: token.attrGet('href') }) },
});

const { nodes, marks } = defaultMarkdownSerializer;

// Tiptap list items have no `tight` attribute, so loose lists are normalized to tight ones through
// this option, which `renderList` reads but the published types of 1.13.7 leave out.
const serializerOptions: NonNullable<ConstructorParameters<typeof MarkdownSerializer>[2]> & {
  tightLists: boolean;
} = { tightLists: true };

// The default rules are typed as an index signature, so a lookup is `T | undefined`.
function borrow<T>(rules: Record<string, T>, name: string): T {
  const rule = rules[name];
  if (!rule) throw new Error(`prosemirror-markdown has no default rule for "${name}"`);
  return rule;
}

// Rules that only read names shared with Tiptap (`level`, `text`) are borrowed from the defaults;
// the ones that read `bullet`, `order` or `params` are rewritten for the Tiptap attributes.
export const markdownSerializer = new MarkdownSerializer(
  {
    paragraph: borrow(nodes, 'paragraph'),
    text: borrow(nodes, 'text'),
    heading: borrow(nodes, 'heading'),
    blockquote: borrow(nodes, 'blockquote'),
    horizontalRule: borrow(nodes, 'horizontal_rule'),
    hardBreak: borrow(nodes, 'hard_break'),
    listItem: borrow(nodes, 'list_item'),
    bulletList(state, node) {
      state.renderList(node, '  ', () => '- ');
    },
    orderedList(state, node) {
      const start: number = node.attrs.start ?? 1;
      const indent = ' '.repeat(String(start + node.childCount - 1).length + 2);
      state.renderList(node, indent, (index) => `${start + index}. `);
    },
    codeBlock(state, node) {
      // The fence must be longer than any backtick run inside the code.
      const longestRun = node.textContent.match(/`{3,}/g)?.sort().at(-1);
      const fence = longestRun ? `${longestRun}\`` : '```';
      state.write(`${fence}${node.attrs.language ?? ''}\n`);
      state.text(node.textContent, false);
      state.write('\n');
      state.write(fence);
      state.closeBlock(node);
    },
  },
  {
    bold: borrow(marks, 'strong'),
    italic: borrow(marks, 'em'),
    strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
    code: borrow(marks, 'code'),
    link: borrow(marks, 'link'),
  },
  serializerOptions,
);

export function parseMarkdown(markdown: string): JSONContent {
  return markdownParser.parse(markdown).toJSON();
}

export function serializeMarkdown(doc: JSONContent): string {
  return markdownSerializer.serialize(markdownSchema.nodeFromJSON(doc));
}
