import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
} from '@playwright/test';
import { E2E_PASSWORD, E2E_USERNAME } from './constants';

/** Navigates and waits until React has hydrated, so clicks and shortcuts reach live handlers. */
export async function gotoHydrated(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('body')).toHaveAttribute('data-hydrated', 'true');
}

/** Signs a browser context in through the API, leaving the session cookie in its jar. */
export async function signInViaApi(context: BrowserContext, password = E2E_PASSWORD) {
  const res = await context.request.post('/api/auth/login', {
    data: { username: E2E_USERNAME, password },
  });
  expect(res.ok()).toBe(true);
}

/** Removes every note (active and archived) through the API, so each test starts from an empty list. */
export async function resetNotes(request: APIRequestContext) {
  for (const view of ['active', 'archived']) {
    const res = await request.get(`/api/notes?view=${view}`);
    for (const note of (await res.json()) as { id: string }[]) {
      await request.delete(`/api/notes/${note.id}`);
    }
  }
}

/** Creates a note through the API and returns it. */
export async function createNote(
  request: APIRequestContext,
  data: { title?: string; body?: string; tags?: string[]; remindAt?: string },
) {
  const res = await request.post('/api/notes', { data });
  expect(res.status()).toBe(201);
  return (await res.json()) as { id: string; title: string; body: string };
}

/**
 * The text of a code editor (CodeMirror's `.cm-content`, which `getByLabel` finds). `toHaveText`
 * collapses whitespace, so exact comparisons go through `expect.poll(() => editorText(...))`.
 */
export async function editorText(editor: Locator): Promise<string> {
  return editor.evaluate((element) => (element as HTMLElement).innerText.replace(/\n$/, ''));
}
