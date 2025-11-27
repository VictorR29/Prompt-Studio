
import React from 'react';

interface SimpleMarkdownProps {
  children: string;
}

export const SimpleMarkdown: React.FC<SimpleMarkdownProps> = ({ children }) => {
  if (!children) return null;

  // Split by newlines to handle blocks (lists, code blocks) vs inline
  const lines = children.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(<ul key={`list-${elements.length}`} className="list-disc list-inside mb-2 pl-2 space-y-1">{currentList}</ul>);
      currentList = [];
    }
  };

  const parseInline = (text: string, keyPrefix: string): React.ReactNode => {
    // Very simple inline parser for **bold** and `code`
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, index) => {
      const key = `${keyPrefix}-${index}`;
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={key} className="font-bold text-teal-300">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={key} className="bg-black/30 px-1.5 py-0.5 rounded text-amber-300 font-mono text-xs border border-white/10">{part.slice(1, -1)}</code>;
      }
      return <span key={key}>{part}</span>;
    });
  };

  lines.forEach((line, i) => {
    // Code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        inCodeBlock = false;
        elements.push(
          <div key={`code-${i}`} className="bg-gray-950/50 p-3 rounded-lg my-3 overflow-x-auto border border-white/10 shadow-inner">
             <pre className="text-xs font-mono text-gray-300">{codeBlockContent.join('\n')}</pre>
          </div>
        );
        codeBlockContent = [];
      } else {
        // Start code block
        flushList();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      return;
    }

    // Lists
    const listMatch = line.match(/^(\s*)[-*]\s+(.*)/);
    if (listMatch) {
      currentList.push(
        <li key={`li-${i}`} className="text-gray-200">
          {parseInline(listMatch[2], `li-content-${i}`)}
        </li>
      );
    } else {
      flushList();
      if (line.trim() === '') {
        elements.push(<div key={`br-${i}`} className="h-2" />);
      } else {
        elements.push(<p key={`p-${i}`} className="mb-1 last:mb-0">{parseInline(line, `p-${i}`)}</p>);
      }
    }
  });
  
  flushList();

  return <div className="text-sm leading-relaxed">{elements}</div>;
};
