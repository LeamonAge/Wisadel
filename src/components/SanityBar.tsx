import React from 'react';
import { useTheme } from '../stores/themeStore';
import { useSanityStore } from '../stores/sanityStore';

const styles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '4px 10px',
  borderRadius: 12,
  gap: 4,
  flexShrink: 0,
};

export function SanityBar() {
  const { colors } = useTheme();
  const state = useSanityStore((s) => s.state);

  return (
    <div style={{ ...styles, backgroundColor: `rgba(192, 0, 0, 0.12)` }}>
      <span style={{ fontSize: 14 }}>🧠</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: colors.accentLight }}>
        {state ? state.balance.toLocaleString() : '--'}
      </span>
    </div>
  );
}
