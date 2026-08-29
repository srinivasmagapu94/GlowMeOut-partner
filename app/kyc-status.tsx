import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pColors, pRadii, pSpacing, pType } from '@/src/theme';
import { partnerApi } from '@/src/api';

export default function KycStatus() {
  const router = useRouter();
  const [data, setData] = useState<any>({});
  useEffect(() => { (async () => setData(await partnerApi('/partner/me')))(); }, []);
  const p = data.partner || {};
  return (
    <SafeAreaView style={styles.c} testID="kyc-status-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={{ width: 40 }}><Feather name="arrow-left" size={22} color={pColors.ink} /></Pressable>
        <Text style={styles.h}>KYC status</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: pSpacing.xl, gap: pSpacing.md }}>
        <View style={styles.hero}>
          <Feather name="shield" size={22} color={pColors.gold} />
          <Text style={styles.heroTxt}>Identity verified</Text>
          <Text style={styles.heroSub}>Verified on {p.verified_at ? new Date(p.verified_at).toLocaleDateString('en-IN') : 'pending'}</Text>
        </View>
        <View style={styles.card}>
          <KV k="Type" v={(p.kyc?.type || '').toUpperCase()} />
          <KV k="Number" v={p.kyc?.number ? maskKyc(p.kyc.number) : '—'} />
          <KV k="Document" v={p.kyc?.file ? 'Uploaded' : 'Not uploaded'} last />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
function maskKyc(n: string) {
  if (n.length <= 4) return n;
  return 'X'.repeat(n.length - 4) + n.slice(-4);
}
function KV({ k, v, last }: any) {
  return <View style={[{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: pColors.divider }]}><Text style={{ color: pColors.inkMuted, fontSize: 13 }}>{k}</Text><Text style={{ color: pColors.ink, fontWeight: '700', fontSize: 13 }}>{v}</Text></View>;
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: pSpacing.xl, paddingVertical: pSpacing.md },
  h: { ...pType.h2, color: pColors.ink },
  hero: { backgroundColor: pColors.ink, borderRadius: pRadii.md, padding: pSpacing.xl, alignItems: 'center', borderWidth: 1, borderColor: pColors.gold },
  heroTxt: { color: pColors.surface, fontWeight: '800', fontSize: 18, marginTop: 8 },
  heroSub: { color: 'rgba(246,245,241,0.6)', fontSize: 12, marginTop: 4 },
  card: { backgroundColor: pColors.surface, borderRadius: pRadii.md, padding: pSpacing.lg, borderWidth: 1, borderColor: pColors.border },
});
