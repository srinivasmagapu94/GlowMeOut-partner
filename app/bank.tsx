import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pColors, pRadii, pSpacing, pType } from '@/src/theme';
import { partnerApi } from '@/src/api';

export default function Bank() {
  const router = useRouter();
  const [data, setData] = useState<any>({});
  useEffect(() => { (async () => setData(await partnerApi('/partner/me')))(); }, []);
  const b = data.partner?.bank || {};
  return (
    <SafeAreaView style={styles.c} testID="bank-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={{ width: 40 }}><Feather name="arrow-left" size={22} color={pColors.ink} /></Pressable>
        <Text style={styles.h}>Bank & payouts</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: pSpacing.xl, gap: pSpacing.md }}>
        <View style={styles.hero}>
          <Feather name="credit-card" size={20} color={pColors.gold} />
          <Text style={styles.heroTxt}>{b.bank_name || '—'}</Text>
          <Text style={styles.heroSub}>{b.account_holder || '—'}</Text>
          <Text style={styles.heroAcc}>•••• •••• {b.account_number?.slice(-4) || '••••'}</Text>
        </View>
        <View style={styles.card}>
          <KV k="Bank" v={b.bank_name} />
          <KV k="Account holder" v={b.account_holder} />
          <KV k="IFSC" v={b.ifsc} />
          <KV k={'Account'} v={b.account_number ? `XXXX${b.account_number.slice(-4)}` : '—'} />
          <KV k="UPI ID" v={b.upi_id || '—'} last />
        </View>
        <View style={styles.info}>
          <Feather name="info" size={14} color={pColors.goldDeep} />
          <Text style={styles.infoTxt}>Contact partner-support@glowmeout.com to update your bank details.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
function KV({ k, v, last }: any) {
  return <View style={[{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: pColors.divider }]}><Text style={{ color: pColors.inkMuted, fontSize: 13 }}>{k}</Text><Text style={{ color: pColors.ink, fontWeight: '700', fontSize: 13 }}>{v || '—'}</Text></View>;
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: pSpacing.xl, paddingVertical: pSpacing.md },
  h: { ...pType.h2, color: pColors.ink },
  hero: { backgroundColor: pColors.ink, borderRadius: pRadii.md, padding: pSpacing.xl },
  heroTxt: { color: pColors.surface, fontWeight: '800', fontSize: 18, marginTop: 8 },
  heroSub: { color: 'rgba(246,245,241,0.6)', fontSize: 12, marginTop: 4 },
  heroAcc: { color: pColors.gold, marginTop: pSpacing.lg, letterSpacing: 3, fontSize: 16, fontWeight: '700' },
  card: { backgroundColor: pColors.surface, borderRadius: pRadii.md, padding: pSpacing.lg, borderWidth: 1, borderColor: pColors.border },
  info: { flexDirection: 'row', gap: 6, backgroundColor: pColors.goldSoft, padding: pSpacing.md, borderRadius: pRadii.sm },
  infoTxt: { color: pColors.goldDeep, fontSize: 12, flex: 1 },
});
