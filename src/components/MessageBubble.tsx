import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Message } from '../types';
import { useTheme } from '../stores/themeStore';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolCallCard } from './ToolCallCard';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { colors } = useTheme();
  const isUser = message.role === 'user';
  const isError = message.type === 'error';

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.aiContainer]}>
      <View
        style={[
          styles.bubble,
          isUser
            ? [styles.userBubble, { backgroundColor: colors.bubbleUser[0] }]
            : isError
            ? [styles.errorBubble, { backgroundColor: 'rgba(192, 0, 0, 0.1)', borderLeftColor: colors.error }]
            : [styles.aiBubble, { backgroundColor: colors.bubbleAi }],
        ]}
      >
        {isError && (
          <Text style={[styles.errorText, { color: colors.error }]} selectable>
            {message.content}
          </Text>
        )}

        {message.toolCall && (
          <ToolCallCard toolCall={message.toolCall} />
        )}

        {message.thinkingContent && (
          <ThinkingBlock content={message.thinkingContent} />
        )}

        {!isError && !message.toolCall && (
          <Text
            style={[
              styles.text,
              { color: isUser ? '#FFFFFF' : colors.textPrimary },
            ]}
            selectable
          >
            {message.content}
          </Text>
        )}

        {message.sanityCost && message.sanityCost > 0 && (
          <Text style={styles.sanityCost}>🧠 -{message.sanityCost}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  aiContainer: {
    alignItems: 'flex-start',
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
    borderLeftWidth: 2,
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
  },
  sanityCost: {
    marginTop: 4,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'right',
  },
});
