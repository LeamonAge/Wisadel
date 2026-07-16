import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSanityStore } from '../stores/sanityStore';
import { useTheme } from '../stores/themeStore';

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    gap: 12,
    flexShrink: 0,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 20,
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 16px',
  },
  balanceCard: {
    padding: 20,
    borderRadius: 16,
    border: '1px solid',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 13,
    marginBottom: 8,
  },
  balanceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  balanceEmoji: {
    fontSize: 28,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: 800,
  },
  statsRow: {
    display: 'flex',
    marginTop: 16,
    paddingTop: 16,
    borderTop: '0.5px solid',
    width: '100%',
    justifyContent: 'space-around',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 600,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
  },
  section: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  txItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '0.5px solid',
  },
  txInfo: {
    flex: 1,
  },
  txDesc: {
    fontSize: 14,
  },
  txTime: {
    fontSize: 11,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: 600,
  },
};

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const state = useSanityStore((s) => s.state);
  const transactions = state?.transactions || [];

  return (
    <div style={{ ...styles.container, backgroundColor: colors.bg }}>
      <div style={styles.header}>
        <button onClick={() => navigate('/chat')} style={{ ...styles.backBtn, color: colors.textPrimary }}>
          ←
        </button>
        <div style={{ ...styles.headerTitle, color: colors.textPrimary }}>个人中心</div>
      </div>

      <div style={styles.content}>
        <div style={{ ...styles.balanceCard, backgroundColor: colors.card, borderColor: colors.border }}>
          <div style={{ ...styles.balanceLabel, color: colors.textSecondary }}>当前理智</div>
          <div style={styles.balanceRow}>
            <span style={styles.balanceEmoji}>🧠</span>
            <span style={{ ...styles.balanceValue, color: colors.textPrimary }}>
              {state ? state.balance.toLocaleString() : '--'}
            </span>
          </div>
          <div style={{ ...styles.statsRow, borderTopColor: colors.border }}>
            <div style={styles.statItem}>
              <div style={{ ...styles.statValue, color: colors.textPrimary }}>
                🧠 {state?.totalConsumed.toLocaleString() || '--'}
              </div>
              <div style={{ ...styles.statLabel, color: colors.textSecondary }}>累计消耗</div>
            </div>
            <div style={{ ...styles.statDivider, backgroundColor: colors.border }} />
            <div style={styles.statItem}>
              <div style={{ ...styles.statValue, color: colors.textPrimary }}>
                🧠 {state?.totalRecharged.toLocaleString() || '--'}
              </div>
              <div style={{ ...styles.statLabel, color: colors.textSecondary }}>累计充值</div>
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <div style={{ ...styles.sectionTitle, color: colors.textPrimary }}>理智记录</div>
          {transactions.length === 0 ? (
            <div style={{ ...styles.emptyText, color: colors.textSecondary }}>暂无记录</div>
          ) : (
            [...transactions].reverse().map((tx) => (
              <div key={tx.id} style={{ ...styles.txItem, borderBottomColor: colors.border }}>
                <div style={styles.txInfo}>
                  <div style={{ ...styles.txDesc, color: colors.textPrimary }}>{tx.description}</div>
                  <div style={{ ...styles.txTime, color: colors.textSecondary }}>
                    {new Date(tx.timestamp).toLocaleString('zh-CN')}
                  </div>
                </div>
                <div
                  style={{
                    ...styles.txAmount,
                    color: tx.type === 'consume' ? colors.error : colors.success,
                  }}
                >
                  {tx.type === 'consume' ? '-' : '+'}🧠{Math.abs(tx.amount)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
