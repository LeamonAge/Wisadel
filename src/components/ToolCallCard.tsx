import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ToolCall } from '../types';
import { useTheme } from '../stores/themeStore';

interface ToolCallCardProps {
  toolCall: ToolCall;
}

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
    <View style={[styles.card, { borderLeftColor: statusColors[toolCall.status], backgroundColor: 'rgba(192, 0, 0, 0.06)' }]}>
      <View style={styles.header}>
        <Text style={styles.icon}>{statusIcons[toolCall.status]}</Text>
        <Text style={[styles.name, { color: statusColors[toolCall.status] }]}>
          {toolCall.name}
        </Text>
      </View>
      {toolCall.result && (
        <View style={[styles.resultContainer, { backgroundColor: colors.codeBg }]}>
          <Text style={[styles.resultText, { color: colors.textSecondary }]} numberOfLines={5} selectable>
            {toolCall.result}
          </Text>
        </View>
      )}
      {toolCall.sanityCost > 0 && toolCall.status === 'done' && (
        <Text style={[styles.cost, { color: colors.warning }]}>🧠 -{toolCall.sanityCost}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 6,
    borderRadius: 8,
    borderLeftWidth: 3,
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    fontSize: 14,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
  },
  resultContainer: {
    marginTop: 6,
    padding: 8,
    borderRadius: 6,
  },
  resultText: {
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  cost: {
    marginTop: 4,
    fontSize: 11,
    textAlign: 'right',
  },
});
