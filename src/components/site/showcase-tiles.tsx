'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  GlassAlert,
  GlassBreadcrumb,
  GlassBreadcrumbItem,
  GlassBreadcrumbLink,
  GlassCommand,
  GlassCommandEmpty,
  GlassCommandGroup,
  GlassCommandInput,
  GlassCommandItem,
  GlassCommandList,
  GlassCommandShortcut,
  GlassPagination,
  GlassPanel,
} from '@/components/liquid';

const JUMPS = [
  { category: 'Controls', href: '/components/glass-button', label: 'Button' },
  { category: 'Controls', href: '/components/glass-select', label: 'Select' },
  { category: 'Overlays', href: '/components/glass-dialog', label: 'Dialog' },
  { category: 'Overlays', href: '/components/glass-sheet', label: 'Sheet' },
  { category: 'Overlays', href: '/components/glass-command', label: 'Command' },
  { category: 'Feedback', href: '/components/glass-toast', label: 'Toast' },
  { category: 'Feedback', href: '/components/glass-progress', label: 'Progress' },
  { category: 'Navigation', href: '/components/glass-dock', label: 'Dock' },
];

export function CommandTile() {
  const router = useRouter();

  return (
    <GlassPanel
      className="tile-command"
      elevation="raised"
      lens
      preset="prominent"
      refraction="none"
      variant="card"
    >
      <GlassCommand label="Jump to a component">
        <GlassCommandInput placeholder="Jump to a component…" />
        <GlassCommandList>
          <GlassCommandEmpty>No components match.</GlassCommandEmpty>
          <GlassCommandGroup>
            {JUMPS.map((jump) => (
              <GlassCommandItem
                key={jump.href}
                keywords={[jump.category]}
                onSelect={() => router.push(jump.href)}
              >
                {jump.label}
                <GlassCommandShortcut>{jump.category}</GlassCommandShortcut>
              </GlassCommandItem>
            ))}
          </GlassCommandGroup>
        </GlassCommandList>
      </GlassCommand>
    </GlassPanel>
  );
}

/**
 * These are sample alerts. Use role="note" so screen readers do not announce
 * them as new events.
 */
export function AlertsTile() {
  return (
    <div className="tile-stack">
      <GlassAlert role="note" title="Deployed" tone="success">
        glassyui.com is live.
      </GlassAlert>
      <GlassAlert role="note" title="Almost full" tone="warning">
        92% of your storage is used.
      </GlassAlert>
    </div>
  );
}

/**
 * The sample trail links to the component docs. None of its items represents
 * the current page, so none uses aria-current.
 */
export function NavigationTile() {
  const [page, setPage] = useState(4);

  return (
    <div className="tile-stack tile-stack--center">
      <GlassPanel className="cpreview-bar" variant="pill">
        <GlassBreadcrumb>
          <GlassBreadcrumbItem>
            <GlassBreadcrumbLink href="/">Home</GlassBreadcrumbLink>
          </GlassBreadcrumbItem>
          <GlassBreadcrumbItem>
            <GlassBreadcrumbLink href="/components">Components</GlassBreadcrumbLink>
          </GlassBreadcrumbItem>
          <GlassBreadcrumbItem>
            <GlassBreadcrumbLink href="/components/glass-pagination">
              Pagination
            </GlassBreadcrumbLink>
          </GlassBreadcrumbItem>
        </GlassBreadcrumb>
      </GlassPanel>
      <GlassPanel className="cpreview-bar" variant="pill">
        <GlassPagination onPageChange={setPage} page={page} pageCount={9} siblingCount={0} />
      </GlassPanel>
    </div>
  );
}
