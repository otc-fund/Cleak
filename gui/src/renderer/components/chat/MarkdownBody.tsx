import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { cn } from '../../lib/cn';

interface Props {
  children: string;
  className?: string;
}

export function MarkdownBody({ children, className }: Props): React.ReactElement {
  return (
    <div className={cn('prose prose-invert prose-sm max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre({ children, ...props }) {
            return (
              <div className="relative group my-2">
                <pre {...props}>{children}</pre>
                <CopyButton getText={() => {
                  const code = (children as React.ReactElement)?.props?.children;
                  return typeof code === 'string' ? code : '';
                }} />
              </div>
            );
          },
          code({ className: cls, children, ...props }) {
            const isBlock = cls?.startsWith('language-');
            return isBlock
              ? <code className={cls} {...props}>{children}</code>
              : <code className="px-1 py-0.5 rounded bg-panel text-accent text-[0.8em]" {...props}>{children}</code>;
          },
        }}
      />
    </div>
  );
}

function CopyButton({ getText }: { getText: () => string }): React.ReactElement {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      className="absolute top-2 right-2 px-2 py-1 text-[10px] rounded bg-panel/80 text-muted
                 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={() => {
        void navigator.clipboard.writeText(getText());
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
