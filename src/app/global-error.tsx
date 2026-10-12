'use client';

import { useEffect } from 'react';
import NextError from 'next/error';
import { captureRenderError } from '../lib/diagnostics/browser';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    void captureRenderError(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <NextError statusCode={500} />
      </body>
    </html>
  );
}
