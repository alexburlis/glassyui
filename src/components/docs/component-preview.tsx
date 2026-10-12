'use client';

import { ComponentDemo, ReleaseFeedbackProvider } from '@/components/docs/component-demos';

type ComponentPreviewProps = {
  id: string;
};

export function ComponentPreview({ id }: ComponentPreviewProps) {
  return (
    <ReleaseFeedbackProvider>
      <div className="docs-preview">
        <ComponentDemo id={id} />
      </div>
    </ReleaseFeedbackProvider>
  );
}
