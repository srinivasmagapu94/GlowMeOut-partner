import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pColors, pRadii, pSpacing, pType } from '@/src/theme';
import { partnerApi } from '@/src/api';

export default function Certificates() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState('not_uploaded');

  useEffect(() => {
    (async () => {
      try {
        const r = await partnerApi('/partner/me');
        setItems(r.partner?.certificates || []);
        setStatus((r.partner?.certificate_status || r.partner?.certificateStatus || 'not_uploaded').toLowerCase());
      } catch {
        setItems([]);
        setStatus('not_uploaded');
      }
    })();
  }, []);

  const badge = {
    not_uploaded: { label: 'Not uploaded', color: pColors.inkMuted, bg: '#F3F4F6' },
    pending: { label: 'Pending', color: pColors.goldDeep, bg: '#FFF3D6' },
    approved: { label: 'Approved', color: '#1B7F5A', bg: '#E7F9F1' },
    rejected: { label: 'Rejected', color: '#B42318', bg: '#FDECEC' },
  }[status] || { label: 'Not uploaded', color: pColors.inkMuted, bg: '#F3F4F6' };

  return (
    <SafeAreaView style={styles.c} testID="certificates-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={{ width: 40 }}><Feather name="arrow-left" size={22} color={pColors.ink} /></Pressable>
        <Text style={styles.h}>Certificates</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: pSpacing.xl, gap: pSpacing.md }}>
        <View style={styles.statusWrap}>
          <Text style={styles.statusLabel}>Certificate status</Text>
          <View style={[styles.statusPill, { backgroundColor: badge.bg, borderColor: badge.color }]}>
            <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        <Pressable style={styles.uploadBtn}>
          <Feather name="upload-cloud" size={18} color={pColors.ink} />
          <Text style={styles.uploadBtnTxt}>{status === 'rejected' ? 'Upload a new certificate' : 'Upload certificate'}</Text>
        </Pressable>

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="award" size={32} color={pColors.inkFaint} />
            <Text style={styles.emptyTxt}>No certificates uploaded</Text>
            <Text style={styles.emptySub}>Add certificates during registration to build trust.</Text>
          </View>
        ) : items.map((c, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.icon}><Feather name="award" size={18} color={pColors.goldDeep} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.n}>{c.name}</Text>
              <Text style={styles.m}>{c.institute} · {c.issue_date}</Text>
              {!!c.comment && <Text style={styles.cm}>{c.comment}</Text>}
            </View>
            <View style={styles.verifiedPill}><Feather name="check" size={11} color={pColors.gold} /><Text style={styles.verifiedTxt}>Status</Text></View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: pSpacing.xl, paddingVertical: pSpacing.md },
  h: { ...pType.h2, color: pColors.ink },
  statusWrap: { backgroundColor: pColors.surface, borderRadius: pRadii.md, borderWidth: 1, borderColor: pColors.border, padding: pSpacing.md },
  statusLabel: { color: pColors.inkMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  statusPill: { marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: pRadii.pill, borderWidth: 1 },
  statusText: { fontSize: 12, fontWeight: '800' },
  uploadBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: pRadii.pill, backgroundColor: pColors.gold, borderWidth: 1, borderColor: pColors.goldDeep },
  uploadBtnTxt: { color: pColors.ink, fontWeight: '800' },
  card: { flexDirection: 'row', gap: pSpacing.md, alignItems: 'flex-start', backgroundColor: pColors.surface, borderRadius: pRadii.md, padding: pSpacing.lg, borderWidth: 1, borderColor: pColors.border },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: pColors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  n: { color: pColors.ink, fontWeight: '700', fontSize: 15 },
  m: { color: pColors.inkMuted, fontSize: 12, marginTop: 2 },
  cm: { color: pColors.inkMuted, fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  verifiedPill: { flexDirection: 'row', gap: 3, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: pRadii.pill, backgroundColor: pColors.goldSoft, borderWidth: 1, borderColor: pColors.gold },
  verifiedTxt: { color: pColors.goldDeep, fontSize: 10, fontWeight: '800' },
  empty: { alignItems: 'center', padding: pSpacing.xxl, backgroundColor: pColors.surface, borderRadius: pRadii.md, borderWidth: 1, borderColor: pColors.border },
  emptyTxt: { color: pColors.ink, fontWeight: '700', marginTop: 8 },
  emptySub: { color: pColors.inkMuted, textAlign: 'center', marginTop: 4, fontSize: 13 },
});
