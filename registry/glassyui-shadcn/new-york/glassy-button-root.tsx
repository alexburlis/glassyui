'use client';

import { Slot } from 'radix-ui';
import type { ComponentProps, Ref } from 'react';
import { useGlassy } from './glassy-engine';

/** The root of shadcn/ui's Button: a button, or its one child with asChild, with the engine. */
export function GlassyButtonRoot({
  asChild = false,
  ref,
  ...props
}: ComponentProps<'button'> & { asChild?: boolean }) {
  // SAFETY: with asChild the element is the child's, which shadcn/ui types as a button too.
  const [attach, glass] = useGlassy(ref as Ref<HTMLElement> | undefined, 'slab');
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <>
      <Comp ref={attach} {...props} />
      {glass}
    </>
  );
}
