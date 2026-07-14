import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../stores/themeStore';

interface ThinkingBlockProps {
  content: string;
}

export function ThinkingBlock({ content }: ThinkingBlockProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  if (!content) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.header, { backgroundColor: 'rgba(192, 0, 0, 0.08)' }]}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={[styles.headerText, { color: colors.accentLight }]}>
          {expanded ? '💭 思考过程 ▾' : '💭 思考过程 ▸'}
        </Text>
      </TouchableOpacity>
      {expanded && (
        <View style={[styles.body, { backgroundColor: 'rgba(192, 0, 0, 0.06)', borderLeftColor: '#C00000' }]}>
          <Text style={[styles.content, { color: colors.textSecondary }]} selectable>
            {content}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  header: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  headerText: {
    fontSize: 12,
  },
  body: {
    marginTop: 4,
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 2,
  },
  content: {
    fontSize: 13,
    lineHeight: 20,
  },
});
