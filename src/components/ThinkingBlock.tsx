import React, { useState } from 'react';
import { useTheme } from '../stores/themeStore';

interface ThinkingBlockProps {
  content: string;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: 4,
  },
  header: {
    padding: '4px 8px',
    borderRadius: 6,
    display: 'inline-block',
    cursor: 'pointer',
    border: 'none',
    fontSize: 12,
  },
  body: {
    marginTop: 4,
    padding: 10,
    borderRadius: 8,
    borderLeft: '2px solid #C00000',
  },
  content: {
    fontSize: 13,
    lineHeight: '20px',
    userSelect: 'text',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
};

export function ThinkingBlock({ content }: ThinkingBlockProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  if (!content) return null;

  return (
    <div style={styles.container}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          ...styles.header,
          backgroundColor: 'rgba(192, 0, 0, 0.08)',
          color: colors.accentLight,
        }}
      >
        {expanded ? '💭 思考过程 ▾' : '💭 思考过程 ▸'}
      </button>
      {expanded && (
        <div style={{ ...styles.body, backgroundColor: 'rgba(192, 0, 0, 0.06)' }}>
          <div style={{ ...styles.content, color: colors.textSecondary }}>
            {content}
          </div>
        </div>
      )}
    </div>
  );
}
