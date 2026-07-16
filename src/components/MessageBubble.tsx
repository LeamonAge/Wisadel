import React from 'react';
import { Message } from '../types';
import { useTheme } from '../stores/themeStore';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolCallCard } from './ToolCallCard';

interface MessageBubbleProps {
  message: Message;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '4px 12px',
    maxWidth: '100%',
  },
  userContainer: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  aiContainer: {
    display: 'flex',
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    borderBottomLeftRadius: 4,
  },
  errorBubble: {
    borderLeft: '2px solid',
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: '22px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  errorText: {
    fontSize: 14,
    lineHeight: '20px',
    userSelect: 'text',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  sanityCost: {
    marginTop: 4,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'right',
  },
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const { colors } = useTheme();
  const isUser = message.role === 'user';

  return (
    <div style={{ ...styles.container, ...(isUser ? styles.userContainer : styles.aiContainer) }}>
      <div
        style={{
          ...styles.bubble,
          ...(isUser
            ? { ...styles.userBubble, backgroundColor: colors.bubbleUser[0] }
            : { ...styles.aiBubble, backgroundColor: colors.bubbleAi }),
        }}
      >
        {message.thinkingContent && (
          <ThinkingBlock content={message.thinkingContent} />
        )}

        <div
          style={{
            ...styles.text,
            color: isUser ? '#FFFFFF' : colors.textPrimary,
          }}
        >
          {message.content}
        </div>

        {message.sanityCost && message.sanityCost > 0 && (
          <div style={styles.sanityCost}>🧠 -{message.sanityCost}</div>
        )}
      </div>
    </div>
  );
}
