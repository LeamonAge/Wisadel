import React from 'react';
import { useTheme } from '../stores/themeStore';

interface ToolCall {
  name: string;
  status: string;
  result?: string;
  sanityCost: number;
}

interface ToolCallCardProps {
  toolCall: ToolCall;
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    marginTop: 6,
    borderRadius: 8,
    borderLeft: '3px solid',
    padding: 10,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    fontSize: 14,
  },
  name: {
    fontSize: 13,
    fontWeight: 600,
  },
  resultContainer: {
    marginTop: 6,
    padding: 8,
    borderRadius: 6,
  },
  resultText: {
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: '18px',
    userSelect: 'text',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflow: 'hidden',
    maxHeight: 75,
  },
  cost: {
    marginTop: 4,
    fontSize: 11,
    textAlign: 'right',
  },
};

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const { colors } = useTheme();

  const statusIcons: Record<string, string> = {
    pending: '⏳',
    running: '🔄',
    done: '✅',
    error: '❌',
  };

  const statusColors: Record<string, string> = {
    pending: colors.textSecondary,
    running: colors.accent,
    done: colors.success,
    error: colors.error,
  };

  return (
    <div style={{ ...styles.card, borderLeftColor: statusColors[toolCall.status], backgroundColor: 'rgba(192, 0, 0, 0.06)' }}>
      <div style={styles.header}>
        <span style={styles.icon}>{statusIcons[toolCall.status]}</span>
        <span style={{ ...styles.name, color: statusColors[toolCall.status] }}>
          {toolCall.name}
        </span>
      </div>
      {toolCall.result && (
        <div style={{ ...styles.resultContainer, backgroundColor: colors.codeBg }}>
          <div style={{ ...styles.resultText, color: colors.textSecondary }}>
            {toolCall.result}
          </div>
        </div>
      )}
      {toolCall.sanityCost > 0 && toolCall.status === 'done' && (
        <div style={{ ...styles.cost, color: colors.warning }}>🧠 -{toolCall.sanityCost}</div>
      )}
    </div>
  );
}
