import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pColors, pRadii, pSpacing, pType, inr } from '@/src/theme';
import { partnerApi } from '@/src/api';

export default function Earnings() {
  const [data, setData] = useState<any>({});
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try { setData(await partnerApi('/partner/earnings')); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return (
    <View style={styles.c} testID="partner-earnings">
      <SafeAreaView edges={['top']}>
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={pColors.gold} />}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          <View style={{ paddingHorizontal: pSpacing.xl, paddingTop: pSpacing.sm }}>
            <Text style={styles.title}>Earnings</Text>
          </View>
          <View style={styles.hero}>
            <Text style={styles.heroLbl}>TODAY'S EARNINGS</Text>
            <Text style={styles.heroAmt}>{inr(data.today || 0)}</Text>
            <View style={styles.heroRow}>
              <View><Text style={styles.heroSubLbl}>Week</Text><Text style={styles.heroSubVal}>{inr(data.week || 0)}</Text></View>
              <View style={styles.heroDivider} />
              <View><Text style={styles.heroSubLbl}>Month</Text><Text style={styles.heroSubVal}>{inr(data.month || 0)}</Text></View>
              <View style={styles.heroDivider} />
              <View><Text style={styles.heroSubLbl}>Year</Text><Text style={styles.heroSubVal}>{inr(data.year || 0)}</Text></View>
            </View>
          </View>

          <View style={styles.payoutRow}>
            <View style={styles.payoutCard}>
              <Feather name="clock" size={16} color={pColors.warning} />
              <Text style={styles.payoutLbl}>PENDING PAYOUT</Text>
              <Text style={styles.payoutVal}>{inr(data.pending_payout || 0)}</Text>
            </View>
            <View style={styles.payoutCard}>
              <Feather name="check-circle" size={16} color={pColors.success} />
              <Text style={styles.payoutLbl}>COMPLETED</Text>
              <Text style={styles.payoutVal}>{inr(data.completed_payout || 0)}</Text>
            </View>
          </View>

          <Text style={styles.section}>Recent transactions</Text>
          {(data.transactions || []).length === 0 ? (
            <View style={styles.empty}><Feather name="file-text" size={28} color={pColors.inkFaint} /><Text style={styles.emptyTxt}>No transactions yet</Text></View>
          ) : (data.transactions || []).map((t: any) => (
            <View key={t.id} style={styles.tx}>
              <View style={styles.txIcon}><Feather name="arrow-down-left" size={16} color={pColors.success} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txService}>{t.service}</Text>
                <Text style={styles.txMeta}>{new Date(t.date).toLocaleDateString('en-IN')} · Customer #{t.customer}</Text>
              </View>
              <Text style={styles.txAmt}>+{inr(t.amount)}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.bg },
  title: { color: pColors.ink, ...pType.display },
  hero: { marginHorizontal: pSpacing.xl, marginTop: pSpacing.md, backgroundColor: pColors.ink, borderRadius: pRadii.lg, padding: pSpacing.xl },
  heroLbl: { color: pColors.gold, fontSize: 10, letterSpacing: 2, fontWeight: '800' },
  heroAmt: { color: pColors.surface, ...pType.displayLg, marginTop: pSpacing.sm },
  heroRow: { flexDirection: 'row', marginTop: pSpacing.lg, alignItems: 'center', justifyContent: 'space-between' },
  heroSubLbl: { color: 'rgba(246,245,241,0.55)', fontSize: 10, letterSpacing: 1, fontWeight: '700', textTransform: 'uppercase' },
  heroSubVal: { color: pColors.surface, fontWeight: '700', fontSize: 15, marginTop: 4 },
  heroDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)' },
  payoutRow: { flexDirection: 'row', gap: pSpacing.md, paddingHorizontal: pSpacing.xl, marginTop: pSpacing.md },
  payoutCard: { flex: 1, backgroundColor: pColors.surface, borderRadius: pRadii.md, borderWidth: 1, borderColor: pColors.border, padding: pSpacing.lg },
  payoutLbl: { color: pColors.inkMuted, fontSize: 10, letterSpacing: 1, fontWeight: '700', marginTop: pSpacing.sm },
  payoutVal: { color: pColors.ink, fontWeight: '800', fontSize: 22, marginTop: 4 },
  section: { color: pColors.ink, ...pType.h2, paddingHorizontal: pSpacing.xl, marginTop: pSpacing.xl, marginBottom: pSpacing.md },
  tx: { flexDirection: 'row', gap: pSpacing.md, backgroundColor: pColors.surface, borderRadius: pRadii.md, padding: pSpacing.md, marginHorizontal: pSpacing.xl, marginBottom: pSpacing.sm, borderWidth: 1, borderColor: pColors.border, alignItems: 'center' },
  txIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E1EBE2', alignItems: 'center', justifyContent: 'center' },
  txService: { color: pColors.ink, fontWeight: '700', fontSize: 14 },
  txMeta: { color: pColors.inkMuted, fontSize: 11, marginTop: 2 },
  txAmt: { color: pColors.success, fontWeight: '800', fontSize: 14 },
  empty: { alignItems: 'center', padding: pSpacing.xxl },
  emptyTxt: { color: pColors.inkMuted, marginTop: 8, fontSize: 13 },
});
