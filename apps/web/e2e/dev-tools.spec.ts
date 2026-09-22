import { expect, test } from '@playwright/test';
import { editorText, gotoHydrated } from './helpers';

const TOOLS = [
  ['/dev-tools/json', 'JSON'],
  ['/dev-tools/data', 'Dados'],
  ['/dev-tools/encode', 'Encodings'],
  ['/dev-tools/image', 'Imagens'],
  ['/dev-tools/rsa', 'Chaves RSA'],
  ['/dev-tools/readme', 'README'],
] as const;

test('the index lists the six tools, and each block opens one', async ({ page }) => {
  await gotoHydrated(page, '/dev-tools');
  await expect(page.getByRole('heading', { level: 1, name: 'Dev Tools' })).toBeVisible();

  for (const [to, label] of TOOLS) {
    await gotoHydrated(page, '/dev-tools');
    await page
      .getByRole('main')
      .getByRole('link', { name: new RegExp(`^${label}`) })
      .click();
    await expect(page).toHaveURL(new RegExp(`${to}$`));
    await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible();
  }
});

test('the index comes rendered from the server', async ({ request }) => {
  const html = await (await request.get('/dev-tools')).text();
  for (const [, label] of TOOLS) expect(html).toContain(label);
});

test('each tool opens straight from its URL, with its sidebar entry open and active', async ({
  page,
}) => {
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  for (const [to, label] of TOOLS) {
    await gotoHydrated(page, to);
    await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: label })).toHaveAttribute('data-active');
    await expect(sidebar.getByRole('link', { name: 'Dev Tools' })).toHaveAttribute('data-active');
  }

  await sidebar.getByRole('link', { name: 'JSON' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'JSON' })).toBeVisible();
});

test('the tools come expanded in the server HTML when a tool is open', async ({ request }) => {
  const html = await (await request.get('/dev-tools/rsa')).text();
  expect(html).toContain('data-sidebar="menu-sub"');
});

test('JSON: formats what is valid and points at what is not', async ({ page }) => {
  await gotoHydrated(page, '/dev-tools/json');
  const output = page.getByLabel('Saída');

  // Formats as you type: no button to press.
  await page.getByLabel('Entrada').fill('{"a":1,"b":[1,2]}');
  await expect.poll(() => editorText(output)).toBe('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}');

  await page.getByText('Min', { exact: true }).click();
  await expect.poll(() => editorText(output)).toBe('{"a":1,"b":[1,2]}');

  // The engine gives no position for this one; the tool still says line and column, and the
  // editor underlines the same place.
  await page.getByLabel('Entrada').fill('{\n  "a": 1,\n  "b": tru\n}');
  await expect(page.getByText(/Linha 3, coluna 8/)).toBeVisible();
  await expect(page.locator('.cm-lintRange-error')).toBeVisible();
});

test('JSON: Tab indents inside the editor, and Esc then Tab leaves it', async ({ page }) => {
  await gotoHydrated(page, '/dev-tools/json');
  const input = page.getByLabel('Entrada');

  await input.click();
  await page.keyboard.type('{');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.type('"a": 1');

  // The brace closed itself, the line is indented, and focus never left the editor.
  await expect.poll(() => editorText(input)).toMatch(/^\{\n {2,}"a": 1\n\}$/);
  await expect(input).toBeFocused();

  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await expect(input).not.toBeFocused();
});

test('Dados: YAML becomes JSON, and CSV says what it cannot describe', async ({ page }) => {
  const urls: string[] = [];
  page.on('response', (response) => urls.push(response.url()));
  await gotoHydrated(page, '/dev-tools/data');
  const target = page.getByRole('group', { name: 'Formato de saída' });
  await expect(page.getByLabel('Entrada')).toBeVisible();
  // Each grammar is downloaded when a pane needs it: nothing here is YAML yet.
  expect(urls.filter((url) => /lang-yaml/.test(url))).toEqual([]);

  await page.getByLabel('Entrada').fill('nome: Gabriel\ntags:\n  - a\n  - b\n');
  await expect(page.getByRole('radio', { name: 'Detectar (YAML)' })).toBeVisible();
  await expect.poll(() => urls.some((url) => /lang-yaml/.test(url))).toBe(true);
  await expect
    .poll(() => editorText(page.getByLabel('Saída')))
    .toBe('{\n  "nome": "Gabriel",\n  "tags": [\n    "a",\n    "b"\n  ]\n}');

  await target.getByText('CSV', { exact: true }).click();
  await expect(page.getByText(/O CSV precisa de uma lista/)).toBeVisible();

  await page.getByLabel('Entrada').fill('nome,idade\nGabriel,33\nMaria,41');
  await expect
    .poll(() => editorText(page.getByLabel('Saída')))
    .toBe('nome,idade\nGabriel,33\nMaria,41');
});

test('Encodings: an accent and an emoji survive the round trip, and a file becomes base64', async ({
  page,
}) => {
  await gotoHydrated(page, '/dev-tools/encode');

  await page.getByLabel('Texto', { exact: true }).fill('Anotação 🎉');
  await expect.poll(() => editorText(page.getByLabel('Codificado'))).toBe('QW5vdGHDp8OjbyDwn46J');

  await page.getByRole('button', { name: 'Inverter' }).click();
  await expect
    .poll(() => editorText(page.getByLabel('Texto', { exact: true })))
    .toBe('Anotação 🎉');

  await page.getByLabel('Codificado').fill('não é base64 !!');
  await expect(page.getByText(/Isto não é base64/)).toBeVisible();

  await page.getByRole('button', { name: 'Inverter' }).click();
  await page.setInputFiles('input[type=file]', {
    name: 'nota.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('oi'),
  });
  await expect.poll(() => editorText(page.getByLabel('Codificado'))).toBe('b2k=');
});

test('Imagens: a PNG becomes a smaller WebP and downloads', async ({ page }) => {
  await gotoHydrated(page, '/dev-tools/image');

  await page.setInputFiles('input[type=file]', 'e2e/fixtures/sample.png');
  await expect(page.getByText('400×250', { exact: false }).first()).toBeVisible();

  await page.getByLabel('Largura máxima').fill('200');
  await expect(page.getByText('→ 200×125', { exact: false })).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: /Baixar/ }).click();
  expect((await download).suggestedFilename()).toBe('sample.webp');
});

test('Chaves RSA: a 2048 pair shows up as two PEM blocks', async ({ page }) => {
  await gotoHydrated(page, '/dev-tools/rsa');

  const started = Date.now();
  await page.getByRole('button', { name: /Gerar par/ }).click();
  await expect(page.getByLabel('Chave pública (SPKI)')).toContainText('BEGIN PUBLIC KEY', {
    timeout: 10_000,
  });
  expect(Date.now() - started).toBeLessThan(10_000);
  await expect(page.getByLabel('Chave privada (PKCS#8)')).toContainText('BEGIN PRIVATE KEY');

  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Baixar' }).first().click();
  expect((await download).suggestedFilename()).toBe('chave.pub.pem');
});

test('README: markdown is rendered, and a table stays as text', async ({ page }) => {
  await gotoHydrated(page, '/dev-tools/readme');
  const reading = page.locator('.ProseMirror');

  await page
    .getByLabel('Markdown')
    .fill('# septo\n\n- notas\n- dev tools\n\n| a | b |\n| - | - |\n| 1 | 2 |\n');

  await expect(reading.getByRole('heading', { level: 1, name: 'septo' })).toBeVisible();
  await expect(reading.getByRole('listitem')).toHaveCount(2);
  await expect(reading.getByText('| a | b |')).toBeVisible();
  await expect(reading).toHaveAttribute('contenteditable', 'false');
});

test('README: a .md dropped on the editor replaces the text', async ({ page }) => {
  await gotoHydrated(page, '/dev-tools/readme');
  const input = page.getByLabel('Markdown');
  await input.fill('antes');

  const dataTransfer = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['# De arquivo'], 'LEIAME.md', { type: 'text/markdown' }));
    return transfer;
  });
  await input.dispatchEvent('drop', { dataTransfer });

  // The pane took the file; the editor did not insert it a second time at the cursor.
  await expect.poll(() => editorText(input)).toBe('# De arquivo');
  await expect(
    page.locator('.ProseMirror').getByRole('heading', { name: 'De arquivo' }),
  ).toBeVisible();
});

test('README: the reading expands over the whole window, and Esc brings it back', async ({
  page,
}) => {
  await gotoHydrated(page, '/dev-tools/readme');
  await page.getByLabel('Markdown').fill('# septo\n\nUm app pessoal.');

  await page.getByRole('button', { name: 'Expandir' }).click();
  const reading = page.getByRole('dialog', { name: 'Leitura' });
  await expect(reading.getByRole('heading', { level: 1, name: 'septo' })).toBeVisible();

  // The window, not the browser's fullscreen: the box is exactly the viewport, over sidebar and header.
  const viewport = page.viewportSize();
  expect(await reading.boundingBox()).toEqual({
    x: 0,
    y: 0,
    width: viewport?.width,
    height: viewport?.height,
  });

  await page.keyboard.press('Escape');
  await expect(reading).toBeHidden();
  const expand = page.getByRole('button', { name: 'Expandir' });
  await expect(expand).toBeFocused();
  await expect
    .poll(() => editorText(page.getByLabel('Markdown')))
    .toBe('# septo\n\nUm app pessoal.');

  // The same button closes it too.
  await expand.click();
  await page.getByRole('button', { name: 'Fechar' }).click();
  await expect(reading).toBeHidden();
});

test('nothing the tools touch leaves the tab', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));

  await gotoHydrated(page, '/dev-tools');
  const before = await page.evaluate(() => Object.keys(localStorage).sort());

  await gotoHydrated(page, '/dev-tools/json');
  await page.getByLabel('Entrada').fill('{"segredo":"de produção"}');
  await expect(page.getByLabel('Saída')).toContainText('segredo');

  await gotoHydrated(page, '/dev-tools/encode');
  await page.getByLabel('Texto', { exact: true }).fill('senha');
  await expect.poll(() => editorText(page.getByLabel('Codificado'))).toBe('c2VuaGE=');

  await gotoHydrated(page, '/dev-tools/rsa');
  await page.getByRole('button', { name: /Gerar par/ }).click();
  await expect(page.getByLabel('Chave privada (PKCS#8)')).toContainText('BEGIN PRIVATE KEY', {
    timeout: 10_000,
  });

  const origin = new URL(page.url()).origin;
  expect(requests.filter((url) => !url.startsWith(origin))).toEqual([]);

  // The shell keeps asking who is signed in and whether the API is up; the tools ask nothing.
  const apiPaths = requests
    .map((url) => new URL(url).pathname)
    .filter((path) => path.startsWith('/api/'));
  expect(apiPaths.filter((path) => !/^\/api\/(health|me|auth\/)/.test(path))).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage).sort())).toEqual(before);
});

test('the heavy tools keep their weight to themselves', async ({ page }) => {
  const urls: string[] = [];
  page.on('response', (response) => urls.push(response.url()));
  const heavy = /data-tool|readme-tool|js-yaml|papaparse|fast-xml|tiptap|prosemirror/i;
  const editor = /codemirror|lezer/i;

  // The index and the image tool edit no text: neither the editor nor a parser.
  await gotoHydrated(page, '/dev-tools');
  await gotoHydrated(page, '/dev-tools/image');
  expect(urls.filter((url) => heavy.test(url) || editor.test(url))).toEqual([]);

  // The JSON tool brings the editor, and still none of the parsers.
  await gotoHydrated(page, '/dev-tools/json');
  await expect(page.getByLabel('Entrada')).toBeVisible();
  expect(urls.some((url) => editor.test(url))).toBe(true);
  expect(urls.filter((url) => heavy.test(url))).toEqual([]);

  // And the parsers arrive when the tool that needs them is opened.
  await gotoHydrated(page, '/dev-tools/data');
  await expect(page.getByLabel('Entrada')).toBeVisible();
  expect(urls.some((url) => heavy.test(url))).toBe(true);
});

test.describe('mobile (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('the index and the tools fit the screen', async ({ page }) => {
    for (const url of ['/dev-tools', ...TOOLS.map(([to]) => to)]) {
      await gotoHydrated(page, url);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, url).toBe(0);
    }
  });
});

test.describe('layout', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('each tool fills the window without scrolling the page', async ({ page }) => {
    for (const [to, label] of TOOLS) {
      await gotoHydrated(page, to);
      await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
      );
      expect(overflow, to).toBe(0);
    }
  });
});
