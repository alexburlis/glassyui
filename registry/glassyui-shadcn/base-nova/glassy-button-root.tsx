'use client';

import { Button as ButtonPrimitive } from '@base-ui/react/button';
import type { Ref } from 'react';
import { useGlassy } from './glassy-engine';

/** The root of shadcn/ui's Button: Base UI's button, with the engine. */
export function GlassyButtonRoot({ ref, ...props }: ButtonPrimitive.Props) {
  // SAFETY: Base UI renders an HTML element, a button unless render replaces it.
  const [attach, glass] = useGlassy(ref as Ref<HTMLElement> | undefined, 'slab');

  return (
    <>
      <ButtonPrimitive ref={attach} {...props} />
      {glass}
    </>
  );
}
