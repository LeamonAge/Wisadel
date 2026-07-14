import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { useSanityStore } from '../stores/sanityStore';
import { useTheme } from '../stores/themeStore';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const state = useSanityStore((s) => s.state);
  const transactions = state?.transactions || [];

  const renderTransaction = ({ item }: any) => (
    <View style={[styles.txItem, { borderBottomColor: colors.border }]}>
      <View style={styles.txInfo}>
        <Text style={[styles.txDesc, { color: colors.textPrimary }]}>{item.description}</Text>
        <Text style={[styles.txTime, { color: colors.textSecondary }]}>
          {new Date(item.timestamp).toLocaleString('zh-CN')}
        </Text>
      </View>
      <Text
        style={[
          styles.txAmount,
          { color: item.type === 'consume' ? colors.error : colors.success },
        ]}
      >
        {item.type === 'consume' ? '-' : '+'}🧠{Math.abs(item.amount)}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>当前理智</Text>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceEmoji}>🧠</Text>
          <Text style={[styles.balanceValue, { color: colors.textPrimary }]}>
            {state ? state.balance.toLocaleString() : '--'}
          </Text>
        </View>
        <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              🧠 {state?.totalConsumed.toLocaleString() || '--'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>累计消耗</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              🧠 {state?.totalRecharged.toLocaleString() || '--'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>累计充值</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>理智记录</Text>
        {transactions.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>暂无记录</Text>
        ) : (
          <FlatList
            data={transactions.slice().reverse()}
            keyExtractor={(item) => item.id}
            renderItem={renderTransaction}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  balanceCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 13,
    marginBottom: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceEmoji: {
    fontSize: 28,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 0.5,
    width: '100%',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
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
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  txItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
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
    fontWeight: '600',
  },
});
