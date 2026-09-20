import { createFileRoute, notFound } from '@tanstack/react-router';
import { NotFound } from '../../shared/layout/not-found';

/**
 * Unknown URLs land here so the 404 renders inside the shell, like every other page. The component
 * lives on this route (not on `_app`): a layout's own notFoundComponent would replace the layout.
 */
export const Route = createFileRoute('/_app/$')({
  beforeLoad: () => {
    throw notFound();
  },
  notFoundComponent: NotFound,
});
