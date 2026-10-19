import Link from 'next/link';
import { Children, isValidElement, type ComponentPropsWithoutRef } from 'react';
import type { MDXRemoteProps } from 'next-mdx-remote/rsc';
import { CopyCodeBlock } from '@/components/docs/copy-code-block';

function MdxPre({ children }: ComponentPropsWithoutRef<'pre'>) {
  const code = Children.only(children);

  if (!isValidElement<{ children: string; className?: string }>(code)) {
    throw new Error('A blog code block must contain a code element.');
  }

  const language = /(?:^|\s)language-([\w-]+)/.exec(code.props.className ?? '')?.[1] ?? '';

  const syntax =
    language === 'json'
      ? 'json'
      : /^(?:sh|shell|bash|zsh)$/.test(language)
        ? 'shell'
        : /^(?:js|jsx|ts|tsx|javascript|typescript)$/.test(language)
          ? 'tsx'
          : 'plain';

  return (
    <CopyCodeBlock
      code={code.props.children.replace(/\n$/, '')}
      label={language ? `${language.toUpperCase()} example` : 'Code example'}
      language={syntax}
    />
  );
}

function MdxLink({ href, children, ...props }: ComponentPropsWithoutRef<'a'>) {
  if (href?.startsWith('/') && !href.startsWith('//')) {
    return (
      <Link href={href} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

function MdxTable(props: ComponentPropsWithoutRef<'table'>) {
  return (
    <div className="blog-table-scroll" role="region" aria-label="Comparison table" tabIndex={0}>
      <table {...props} />
    </div>
  );
}

export const blogMdxComponents = {
  a: MdxLink,
  pre: MdxPre,
  table: MdxTable,
} satisfies NonNullable<MDXRemoteProps['components']>;
