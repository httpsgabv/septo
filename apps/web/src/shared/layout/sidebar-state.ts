import { createIsomorphicFn } from '@tanstack/react-start';
import { getCookie } from '@tanstack/react-start/server';

// Same cookie the shadcn sidebar writes when toggled; reading it during SSR avoids a layout jump.
const SIDEBAR_COOKIE = 'sidebar_state';

export const readSidebarOpen = createIsomorphicFn()
  .server(() => getCookie(SIDEBAR_COOKIE) !== 'false')
  .client(() => !document.cookie.includes(`${SIDEBAR_COOKIE}=false`));
