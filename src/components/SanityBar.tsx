import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../stores/themeStore';
import { useSanityStore } from '../stores/sanityStore';

export function SanityBar() {
  const { colors } = useTheme();
  const state = useSanityStore((s) => s.state);

  return (
    <View style={[styles.container, { backgroundColor: `rgba(192, 0, 0, 0.12)` }]}>
      <Text style={styles.icon}>🧠</Text>
      <Text style={[styles.balance, { color: colors.accentLight }]}>
        {state ? state.balance.toLocaleString() : '--'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  icon: {
    fontSize: 14,
  },
  balance: {
    fontSize: 13,
    fontWeight: '600',
  },
});
