import type { ReactNode } from 'react';

/** A hard requirement under a component's description, such as WebGL2 or a provider. */
export function Requirement({ children }: { children: ReactNode }) {
  return (
    <p className="docs-requirement">
      <span>Requires</span> {children}
    </p>
  );
}
