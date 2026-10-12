'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ComponentDemo,
  QuietDemos,
  ReleaseFeedbackProvider,
} from '@/components/docs/component-demos';
import { CardBackdrop } from './card-backdrop';

type ComponentCardData = {
  /** Replaces the docs demo with a composition made for this card. */
  demo?: ReactNode;
  description: string;
  id: string;
  isNew?: boolean;
  name: string;
  route: string;
};

type ComponentCardProps = {
  component: ComponentCardData;
  index: number;
  lazy: boolean;
};

// A lazy card mounts its live demo shortly before it scrolls into view.
function ComponentCard({ component, index, lazy }: ComponentCardProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(!lazy);

  useEffect(() => {
    const stage = stageRef.current;

    if (mounted || !stage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setMounted(true);
      },
      { rootMargin: '480px 0px' },
    );

    observer.observe(stage);

    return () => observer.disconnect();
  }, [mounted]);

  return (
    <article className="component-card">
      <div ref={stageRef} className="component-card-stage">
        <CardBackdrop index={index} />
        {mounted ? (
          <QuietDemos value>{component.demo ?? <ComponentDemo id={component.id} />}</QuietDemos>
        ) : null}
      </div>
      <div className="component-card-meta">
        <h3>
          <Link href={component.route}>{component.name.replace('Glass ', '')}</Link>
          {component.isNew ? <span className="new-tag">New</span> : null}
        </h3>
        <p>{component.description}</p>
      </div>
    </article>
  );
}

type ComponentGridProps = {
  components: ComponentCardData[];
  lazy?: boolean;
  /** Where this grid joins the backdrop rotation, such as the number of cards above it. */
  offset?: number;
};

export function ComponentGrid({ components, lazy = false, offset = 0 }: ComponentGridProps) {
  return (
    <div className="component-grid">
      {components.map((component, index) => (
        <ComponentCard
          key={component.id}
          component={component}
          index={offset + index}
          lazy={lazy}
        />
      ))}
    </div>
  );
}

export { ReleaseFeedbackProvider };
