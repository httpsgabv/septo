import { Button } from '@septo/ui/components/button';
import { Input } from '@septo/ui/components/input';
import { type Editor, useEditorState } from '@tiptap/react';
import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  type LucideIcon,
  MinusIcon,
  QuoteIcon,
  SquareCodeIcon,
  StrikethroughIcon,
} from 'lucide-react';
import { type FormEvent, useState } from 'react';

type Action = {
  label: string;
  icon: LucideIcon;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
};

const ACTIONS: Action[] = [
  {
    label: 'Negrito',
    icon: BoldIcon,
    isActive: (e) => e.isActive('bold'),
    run: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    label: 'Itálico',
    icon: ItalicIcon,
    isActive: (e) => e.isActive('italic'),
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    label: 'Riscado',
    icon: StrikethroughIcon,
    isActive: (e) => e.isActive('strike'),
    run: (e) => e.chain().focus().toggleStrike().run(),
  },
  {
    label: 'Código',
    icon: CodeIcon,
    isActive: (e) => e.isActive('code'),
    run: (e) => e.chain().focus().toggleCode().run(),
  },
  {
    label: 'Título 1',
    icon: Heading1Icon,
    isActive: (e) => e.isActive('heading', { level: 1 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    label: 'Título 2',
    icon: Heading2Icon,
    isActive: (e) => e.isActive('heading', { level: 2 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: 'Título 3',
    icon: Heading3Icon,
    isActive: (e) => e.isActive('heading', { level: 3 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    label: 'Lista com marcadores',
    icon: ListIcon,
    isActive: (e) => e.isActive('bulletList'),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    label: 'Lista numerada',
    icon: ListOrderedIcon,
    isActive: (e) => e.isActive('orderedList'),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    label: 'Citação',
    icon: QuoteIcon,
    isActive: (e) => e.isActive('blockquote'),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    label: 'Bloco de código',
    icon: SquareCodeIcon,
    isActive: (e) => e.isActive('codeBlock'),
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    label: 'Linha horizontal',
    icon: MinusIcon,
    isActive: () => false,
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
];

const HAS_SCHEME = /^[a-z][a-z\d+.-]*:/i;

/** "example.com" becomes "https://example.com"; anything with a scheme, path or anchor is kept. */
const toHref = (input: string) =>
  HAS_SCHEME.test(input) || /^[/#]/.test(input) ? input : `https://${input}`;

export function EditorToolbar({ editor }: { editor: Editor | null }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      active: editor ? ACTIONS.map((action) => action.isActive(editor)) : [],
      link: editor?.isActive('link') ?? false,
      // A link needs text to sit on, or a link to edit.
      canLink: editor ? !editor.state.selection.empty || editor.isActive('link') : false,
    }),
  });
  if (!editor) return null;

  function applyLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = new FormData(event.currentTarget).get('href');
    const href = typeof input === 'string' ? input.trim() : '';
    const chain = editor?.chain().focus().extendMarkRange('link');
    if (href) chain?.setLink({ href: toHref(href) }).run();
    else chain?.unsetLink().run();
    setLinkOpen(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="toolbar"
        aria-label="Formatação"
        className="flex flex-wrap items-center gap-0.5 rounded-lg border bg-background p-1"
      >
        {ACTIONS.map((action, index) => (
          <Button
            key={action.label}
            type="button"
            variant={state?.active[index] ? 'secondary' : 'ghost'}
            size="icon-sm"
            aria-label={action.label}
            title={action.label}
            aria-pressed={state?.active[index] ?? false}
            // Keeps the selection in the editor: the click formats it instead of stealing focus.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => action.run(editor)}
          >
            <action.icon />
          </Button>
        ))}
        <Button
          type="button"
          variant={state?.link ? 'secondary' : 'ghost'}
          size="icon-sm"
          aria-label="Link"
          title="Link"
          aria-pressed={state?.link ?? false}
          aria-expanded={linkOpen}
          disabled={!state?.canLink && !linkOpen}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setLinkOpen((open) => !open)}
        >
          <LinkIcon />
        </Button>
      </div>

      {linkOpen && (
        <form onSubmit={applyLink} className="flex gap-2">
          <Input
            name="href"
            defaultValue={editor.getAttributes('link').href ?? ''}
            aria-label="Endereço do link"
            placeholder="https://…"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setLinkOpen(false);
                editor.chain().focus().run();
              }
            }}
          />
          <Button type="submit" variant="outline" size="sm">
            Aplicar
          </Button>
        </form>
      )}
    </div>
  );
}
