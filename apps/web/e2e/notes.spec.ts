import { expect, type Page, test } from '@playwright/test';
import { createNote, gotoHydrated, resetNotes } from './helpers';

// All tests share one list, so they run one after the other and each one starts with no notes.
test.describe.configure({ mode: 'serial' });
test.beforeEach(({ request }) => resetNotes(request));

const noteList = (page: Page) => page.getByRole('list', { name: 'Notas' });
const noteItems = (page: Page) => noteList(page).getByRole('listitem');
const rowMenu = (page: Page, title: string) =>
  page.getByRole('button', { name: `Ações da nota ${title}` });
/** The autosave indicator. There are other `status` regions on the page, so match its text. */
const saved = (page: Page) => page.getByRole('status').filter({ hasText: 'Salvo' });
const bodyEditor = (page: Page) => page.getByRole('textbox', { name: 'Corpo da nota' });
const reminderField = (page: Page) => page.getByRole('textbox', { name: 'Lembrete', exact: true });
const titleField = (page: Page) => page.getByRole('textbox', { name: 'Título' });

/** The editor's HTML without the empty paragraph it keeps at the end: markdown drops it, by design. */
const editorHtml = async (page: Page) =>
  (await bodyEditor(page).innerHTML()).replace(
    /(<p><br class="ProseMirror-trailingBreak"><\/p>)+$/,
    '',
  );

/** Clicks the empty area under the text, which puts the caret at the end of the note. */
const clickAtEnd = (page: Page) => bodyEditor(page).click({ position: { x: 20, y: 200 } });

async function startNewNote(page: Page) {
  await gotoHydrated(page, '/notes');
  await page.getByRole('link', { name: 'Nova nota' }).click();
  await expect(bodyEditor(page)).toBeVisible();
}

test('typing a new note saves it on its own and it is there after a reload', async ({ page }) => {
  await startNewNote(page);

  await page.keyboard.type('Ideias para o fim de semana');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Ir à feira e cozinhar.');

  await expect(saved(page)).toBeVisible({ timeout: 3_000 });
  // The draft became a real note: the URL now carries its id, without reloading.
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/);
  await expect(noteItems(page)).toHaveCount(1);

  await page.reload();
  await expect(titleField(page)).toHaveValue('Ideias para o fim de semana');
  await expect(bodyEditor(page)).toContainText('Ir à feira e cozinhar.');
  await expect(noteList(page)).toContainText('Ideias para o fim de semana');
});

test('title, body, tags and reminder come back the same after a reload', async ({
  page,
  request,
}) => {
  const note = await createNote(request, {
    title: 'Completa',
    body: 'corpo com **destaque**',
    tags: ['casa', 'ideias'],
    remindAt: '2030-01-01T12:00:00.000Z',
  });
  await gotoHydrated(page, `/notes/${note.id}`);
  const snapshot = async () => ({
    title: await titleField(page).inputValue(),
    body: await bodyEditor(page).innerText(),
    bold: await bodyEditor(page).locator('strong').innerText(),
    tags: await page
      .getByRole('list', { name: 'Tags da nota' })
      .getByRole('listitem')
      .allInnerTexts(),
    reminder: await reminderField(page).inputValue(),
  });
  await expect(bodyEditor(page)).toContainText('corpo com destaque');

  const before = await snapshot();
  await page.reload();
  await expect(bodyEditor(page)).toContainText('corpo com destaque');

  expect(await snapshot()).toEqual(before);
  expect(before).toMatchObject({ title: 'Completa', bold: 'destaque', tags: ['casa', 'ideias'] });
  expect(before.reminder).toMatch(/^2030-01-01T\d{2}:\d{2}$/);
});

test('an empty draft never leaves a note behind', async ({ page, request }) => {
  await startNewNote(page);
  await page.waitForTimeout(1_500);
  await page.getByRole('link', { name: 'Notas', exact: true }).first().click();

  expect((await (await request.get('/api/notes')).json()).length).toBe(0);
});

test('formatting typed with markdown shortcuts comes back identical after a reload', async ({
  page,
  request,
}) => {
  await startNewNote(page);
  await page.keyboard.type('Formatação');
  await page.keyboard.press('Enter');

  await page.keyboard.type('## Pauta');
  await page.keyboard.press('Enter');
  await page.keyboard.type('- primeiro');
  await page.keyboard.press('Enter');
  await page.keyboard.type('segundo');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // leaves the list
  await page.keyboard.type('**negrito** e ~~riscado~~ e site');
  // A link through the toolbar: select the word (four characters back), choose Link, type the address.
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  await page.getByRole('textbox', { name: 'Endereço do link' }).fill('exemplo.com/x');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight'); // collapses the selection; End would scroll on macOS
  // ProseMirror learns of the new selection on the (asynchronous) `selectionchange`; an Enter sent
  // in the same instant would still replace the old selection. A person never types that fast.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));
  await page.keyboard.press('Enter');
  await page.keyboard.type('> uma citação');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // leaves the quote
  await page.keyboard.type('fim');

  await expect(saved(page)).toBeVisible({ timeout: 3_000 });
  await expect(bodyEditor(page).locator('h2')).toHaveText('Pauta');
  const before = await editorHtml(page);

  await page.reload();
  await expect(bodyEditor(page).locator('h2')).toHaveText('Pauta');
  expect(await editorHtml(page)).toBe(before);
  await expect(bodyEditor(page).locator('a[href="https://exemplo.com/x"]')).toHaveText('site');

  // What is stored is readable markdown.
  const [stored] = await (await request.get('/api/notes')).json();
  const { body } = await (await request.get(`/api/notes/${stored.id}`)).json();
  expect(body).toContain('## Pauta');
  expect(body).toContain('- primeiro\n- segundo');
  expect(body).toContain('**negrito**');
  expect(body).toContain('~~riscado~~');
  expect(body).toContain('[site](https://exemplo.com/x)');
  expect(body).toContain('> uma citação');
});

test('search finds a note whatever the accents and case, and the filter survives a reload', async ({
  page,
  request,
}) => {
  await createNote(request, { title: 'Anotação importante', body: 'texto' });
  await createNote(request, { title: 'Outra coisa', body: 'sem relação' });
  await gotoHydrated(page, '/notes');
  await expect(noteItems(page)).toHaveCount(2);

  await page.getByRole('searchbox', { name: 'Buscar notas' }).fill('ANOTACAO');

  await expect(page).toHaveURL(/[?&]q=ANOTACAO/);
  await expect(noteItems(page)).toHaveCount(1);
  await expect(noteItems(page).first()).toContainText('Anotação importante');

  await page.reload();
  await expect(page.getByRole('searchbox', { name: 'Buscar notas' })).toHaveValue('ANOTACAO');
  await expect(noteItems(page)).toHaveCount(1);
});

test('the list is rendered on the server, already filtered', async ({ request }) => {
  await createNote(request, { title: 'Anotação no servidor' });
  await createNote(request, { title: 'Escondida pelo filtro' });

  const html = await (await request.get('/notes?q=anotacao')).text();

  expect(html).toContain('Anotação no servidor');
  expect(html).not.toContain('Escondida pelo filtro');
});

test('tags: add one to a note, then filter the list by clicking it', async ({ page, request }) => {
  const tagged = await createNote(request, { title: 'Com tag' });
  await createNote(request, { title: 'Sem tag' });
  await gotoHydrated(page, `/notes/${tagged.id}`);

  const tagField = page.getByRole('combobox', { name: 'Adicionar tag' });
  await tagField.fill('  Trabalho ');
  await tagField.press('Enter');
  await expect(page.getByRole('list', { name: 'Tags da nota' })).toContainText('trabalho');
  await expect(saved(page)).toBeVisible({ timeout: 3_000 });

  await page.getByRole('link', { name: 'Filtrar pela tag trabalho' }).click();
  await expect(page).toHaveURL(/[?&]tag=trabalho/);
  await expect(noteItems(page)).toHaveCount(1);
  await expect(noteItems(page).first()).toContainText('Com tag');

  await page.getByRole('link', { name: 'Limpar o filtro da tag trabalho' }).click();
  await expect(noteItems(page)).toHaveCount(2);
});

test('an invalid or repeated tag is refused with a message', async ({ page, request }) => {
  const note = await createNote(request, { title: 'Nota', tags: ['casa'] });
  await gotoHydrated(page, `/notes/${note.id}`);
  const tagField = page.getByRole('combobox', { name: 'Adicionar tag' });

  await tagField.fill('a/b');
  await tagField.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'Tag inválida' })).toBeVisible();

  await tagField.fill('CASA');
  await tagField.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'já está na nota' })).toBeVisible();
});

test('pinning moves a note to the top', async ({ page, request }) => {
  await createNote(request, { title: 'Antiga' });
  await createNote(request, { title: 'Recente' });
  await gotoHydrated(page, '/notes');
  await expect(noteItems(page)).toHaveText([/Recente/, /Antiga/]);

  await rowMenu(page, 'Antiga').click();
  await page.getByRole('menuitem', { name: 'Fixar' }).click();

  await expect(noteItems(page)).toHaveText([/Antiga/, /Recente/]);
  await expect(noteItems(page).first().getByLabel('Fixada')).toBeVisible();
});

test('archiving takes a note off the list, and Arquivadas brings it back', async ({
  page,
  request,
}) => {
  await createNote(request, { title: 'Para arquivar' });
  await createNote(request, { title: 'Fica' });
  await gotoHydrated(page, '/notes');

  await rowMenu(page, 'Para arquivar').click();
  await page.getByRole('menuitem', { name: 'Arquivar' }).click();
  await expect(noteItems(page)).toHaveCount(1);
  await expect(noteItems(page).first()).toContainText('Fica');

  await page.getByRole('link', { name: 'Arquivadas' }).click();
  await expect(page).toHaveURL(/view=archived/);
  await expect(noteItems(page)).toHaveCount(1);
  await expect(noteItems(page).first()).toContainText('Para arquivar');

  await rowMenu(page, 'Para arquivar').click();
  await page.getByRole('menuitem', { name: 'Desarquivar' }).click();
  await expect(page.getByText('Nenhuma nota arquivada.')).toBeVisible();

  await page.getByRole('link', { name: 'Ativas' }).click();
  await expect(noteItems(page)).toHaveCount(2);
});

test('a reminder puts the note under Lembretes, and clearing it takes it out', async ({
  page,
  request,
}) => {
  const note = await createNote(request, { title: 'Pagar a conta' });
  await createNote(request, { title: 'Sem lembrete' });
  await gotoHydrated(page, `/notes/${note.id}`);

  await reminderField(page).fill('2030-01-01T09:00');
  await expect(page.getByText('Lembrar em')).toBeVisible();
  await expect(saved(page)).toBeVisible({ timeout: 3_000 });

  await page.getByRole('link', { name: 'Lembretes' }).click();
  await expect(page).toHaveURL(/view=reminders/);
  await expect(noteItems(page)).toHaveCount(1);
  await expect(noteItems(page).first()).toContainText('Pagar a conta');

  await page.getByRole('button', { name: 'Limpar lembrete' }).click();
  await expect(page.getByText('Nenhuma nota com lembrete.')).toBeVisible();
});

test('a reminder in the past is saved, with a warning', async ({ page, request }) => {
  const note = await createNote(request, { title: 'Já passou' });
  await gotoHydrated(page, `/notes/${note.id}`);

  await reminderField(page).fill('2020-01-01T09:00');

  await expect(page.getByText('Essa data já passou.')).toBeVisible();
  await expect(saved(page)).toBeVisible({ timeout: 3_000 });
  const stored = await (await request.get(`/api/notes/${note.id}`)).json();
  expect(stored.remindAt).not.toBeNull();
});

test('deleting asks first: cancel keeps the note, confirm removes it for good', async ({
  page,
  request,
}) => {
  const note = await createNote(request, { title: 'Vai embora' });
  await createNote(request, { title: 'Fica' });
  await gotoHydrated(page, `/notes/${note.id}`);

  await page.getByRole('button', { name: 'Ações da nota Vai embora' }).last().click();
  await page.getByRole('menuitem', { name: 'Excluir' }).click();
  const dialog = page.getByRole('dialog', { name: 'Excluir esta nota?' });
  await expect(dialog).toContainText('de vez');

  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toBeHidden();
  expect((await request.get(`/api/notes/${note.id}`)).status()).toBe(200);

  await page.getByRole('button', { name: 'Ações da nota Vai embora' }).last().click();
  await page.getByRole('menuitem', { name: 'Excluir' }).click();
  await page.getByRole('button', { name: 'Excluir de vez' }).click();

  await expect(page).toHaveURL(/\/notes$/);
  await expect(noteItems(page)).toHaveCount(1);
  await expect(noteList(page)).not.toContainText('Vai embora');
  expect((await request.get(`/api/notes/${note.id}`)).status()).toBe(404);
});

test('an edit made right before switching notes is not lost', async ({ page, request }) => {
  const first = await createNote(request, { title: 'Primeira', body: 'começo' });
  await createNote(request, { title: 'Segunda', body: 'outra' });
  await gotoHydrated(page, `/notes/${first.id}`);

  await clickAtEnd(page);
  await page.keyboard.type(' e depois');
  // Leaves inside the 800 ms pause, before the autosave would have fired.
  await noteList(page)
    .getByRole('link', { name: /Segunda/ })
    .click();
  await expect(titleField(page)).toHaveValue('Segunda');

  await noteList(page)
    .getByRole('link', { name: /Primeira/ })
    .click();
  await expect(titleField(page)).toHaveValue('Primeira');
  await expect(bodyEditor(page)).toContainText('começo e depois');
  await expect
    .poll(async () => (await (await request.get(`/api/notes/${first.id}`)).json()).body)
    .toContain('começo e depois');
});

test('a failed save shows the error, keeps the text, and retrying saves it', async ({
  page,
  request,
  context,
}) => {
  const note = await createNote(request, { title: 'Offline', body: 'base' });
  await gotoHydrated(page, `/notes/${note.id}`);
  await expect(bodyEditor(page)).toBeVisible();

  await context.setOffline(true);
  await clickAtEnd(page);
  await page.keyboard.type(' sem rede');
  await expect(page.getByRole('alert').filter({ hasText: 'Erro ao salvar' })).toBeVisible();
  await expect(bodyEditor(page)).toContainText('base sem rede');

  await context.setOffline(false);
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(saved(page)).toBeVisible({ timeout: 5_000 });
  await expect
    .poll(async () => (await (await request.get(`/api/notes/${note.id}`)).json()).body)
    .toContain('base sem rede');
});

test('/notes does not download the editor bundle until a note is opened', async ({
  page,
  request,
}) => {
  await createNote(request, { title: 'Abre o editor' });
  const editorRequests: string[] = [];
  page.on('request', (req) => {
    if (/tiptap|prosemirror/i.test(req.url())) editorRequests.push(req.url());
  });

  await gotoHydrated(page, '/notes');
  await expect(noteItems(page)).toHaveCount(1);
  expect(editorRequests).toEqual([]);

  await noteList(page)
    .getByRole('link', { name: /Abre o editor/ })
    .click();
  await expect(bodyEditor(page)).toBeVisible();
  expect(editorRequests.length).toBeGreaterThan(0);
});

test('an unknown note id shows a message inside the shell', async ({ page }) => {
  await gotoHydrated(page, '/notes/7f1c2b3a-0000-4000-8000-000000000000');

  await expect(page.getByText('Nota não encontrada')).toBeVisible();
  await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
});

test.describe('mobile (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('the list and the editor fit the screen, one column at a time', async ({
    page,
    request,
  }) => {
    await createNote(request, {
      title: 'Uma nota com um título bem comprido para testar o corte',
      body: 'x'.repeat(400),
      tags: ['trabalho', 'ideias'],
    });
    const overflows = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );

    await gotoHydrated(page, '/notes');
    await expect(noteItems(page)).toHaveCount(1);
    expect(await overflows()).toBe(false);
    await expect(page.getByRole('link', { name: 'Nova nota' })).toBeVisible();

    await noteList(page)
      .getByRole('link', { name: /Uma nota/ })
      .click();
    await expect(bodyEditor(page)).toBeVisible();
    expect(await overflows()).toBe(false);
    // The list is off screen while a note is open, and the way back is on screen.
    await expect(noteList(page)).toBeHidden();
    await page.getByRole('link', { name: 'Notas', exact: true }).first().click();
    await expect(noteList(page)).toBeVisible();
  });
});
