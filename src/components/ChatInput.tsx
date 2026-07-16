import React from 'react';
import { useTheme } from '../stores/themeStore';

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onCancel: () => void;
  disabled: boolean;
  isStreaming: boolean;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '8px 12px',
    borderTop: '0.5px solid',
    flexShrink: 0,
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'flex-end',
    borderRadius: 20,
    border: '1px solid',
    padding: '4px 12px',
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    padding: '8px 0',
    border: 'none',
    outline: 'none',
    resize: 'none',
    fontFamily: 'inherit',
    lineHeight: '20px',
    backgroundColor: 'transparent',
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginBottom: 4,
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
  },
  sendBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  sendIcon: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  stopBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 10,
    marginBottom: 8,
    border: 'none',
    cursor: 'pointer',
    alignSelf: 'center',
    width: 'auto',
  },
  stopIcon: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  stopText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: 600,
  },
};

export function ChatInput({ value, onChangeText, onSend, onCancel, disabled, isStreaming }: ChatInputProps) {
  const { colors } = useTheme();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div style={{ ...styles.container, backgroundColor: colors.bg, borderTopColor: colors.border }}>
      {isStreaming && (
        <button
          onClick={onCancel}
          style={{ ...styles.stopBtn, backgroundColor: colors.error }}
        >
          <span style={styles.stopIcon}>■</span>
          <span style={styles.stopText}>停止生成</span>
        </button>
      )}
      <div style={{ ...styles.inputWrapper, backgroundColor: colors.inputBg, borderColor: colors.border }}>
        <textarea
          value={value}
          onChange={(e) => onChangeText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="发送消息... (Enter 发送, Shift+Enter 换行)"
          style={{ ...styles.input, color: colors.textPrimary }}
          maxLength={4000}
          disabled={disabled}
          rows={1}
        />
        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          style={{
            ...styles.sendBtn,
            backgroundColor: colors.accent,
            ...((disabled || !value.trim()) ? styles.sendBtnDisabled : {}),
          }}
        >
          <span style={styles.sendIcon}>↑</span>
        </button>
      </div>
    </div>
  );
}
