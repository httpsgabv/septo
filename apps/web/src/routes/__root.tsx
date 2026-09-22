import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { type ReactNode, useEffect } from 'react';
import { PREFERENCES_SCRIPT } from '../features/settings/preferences-script';
import appCss from '../styles.css?url';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#5808a3' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { title: 'septo' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/app.webmanifest' },
      { rel: 'apple-touch-icon', href: '/icons/apple-touch-180.png' },
    ],
    // Before first paint: stored theme and accent, no flash of the defaults.
    scripts: [{ children: PREFERENCES_SCRIPT }],
  }),
  component: RootComponent,
});

function RootComponent() {
  // Signals that event handlers are live (e2e tests wait for it instead of guessing).
  useEffect(() => {
    document.body.dataset.hydrated = 'true';
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
    }
  }, []);
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    // The preferences script sets the class and accent before hydration.
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
