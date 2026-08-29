import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pColors, pRadii, pSpacing, pType, inr } from '@/src/theme';
import { partnerApi } from '@/src/api';

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [b, setB] = useState<any>(null);

  const load = async () => setB(await partnerApi(`/bookings/${id}`));
  useEffect(() => { load(); }, [id]);

  const act = async (action: 'accept' | 'decline' | 'complete') => {
    await partnerApi(`/partner/bookings/${id}/${action}`, { method: 'POST' });
    load();
  };

  if (!b) return <View style={styles.c} />;

  return (
    <SafeAreaView style={styles.c} testID="partner-booking-detail">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={{ width: 40 }}><Feather name="arrow-left" size={22} color={pColors.ink} /></Pressable>
        <Text style={styles.h}>Booking</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: pSpacing.xl, gap: pSpacing.md, paddingBottom: 140 }}>
        <View style={styles.status}>
          <View style={styles.statusDot} />
          <Text style={styles.statusTxt}>{b.status.replace('_', ' ').toUpperCase()}</Text>
          <Text style={styles.pay}>{b.payment_status === 'paid' ? 'Paid' : 'Unpaid'}</Text>
        </View>

        <View style={styles.customer}>
          <Image source={b.customer?.avatar || 'https://i.pravatar.cc/100'} style={styles.cAv} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cN}>{b.customer?.name || 'Customer'}</Text>
            <Text style={styles.cP}>{b.customer?.phone || '—'}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={styles.iBtn}><Feather name="phone" size={18} color={pColors.ink} /></Pressable>
            <Pressable style={styles.iBtn}><Feather name="message-circle" size={18} color={pColors.ink} /></Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <KV k="Service" v={b.service_name} />
          <KV k="Date" v={b.date} />
          <KV k="Time" v={b.time} />
          <KV k="Address" v={b.address} last />
        </View>
        <View style={styles.card}>
          <KV k="Total" v={inr(b.price)} bold last />
        </View>

        {b.status === 'pending' && (
          <View style={{ flexDirection: 'row', gap: pSpacing.md, marginTop: pSpacing.md }}>
            <Pressable style={styles.decline} onPress={() => act('decline')} testID="pd-decline"><Text style={styles.declineTxt}>Decline</Text></Pressable>
            <Pressable style={styles.accept} onPress={() => act('accept')} testID="pd-accept"><Text style={styles.acceptTxt}>Accept</Text></Pressable>
          </View>
        )}
        {b.status === 'confirmed' && (
          <Pressable style={styles.accept} onPress={() => act('complete')} testID="pd-complete"><Text style={styles.acceptTxt}>Mark completed</Text></Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
function KV({ k, v, last, bold }: any) {
  return (
    <View style={[{ paddingVertical: 10 }, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: pColors.divider }]}>
      <Text style={{ color: pColors.inkMuted, fontSize: 10, letterSpacing: 1.5, fontWeight: '800' }}>{k.toUpperCase()}</Text>
      <Text style={{ color: pColors.ink, fontSize: bold ? 22 : 14, fontWeight: bold ? '800' : '600', marginTop: 4 }}>{v}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: pSpacing.xl, paddingVertical: pSpacing.md },
  h: { ...pType.h2, color: pColors.ink },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: pColors.surface, padding: pSpacing.md, borderRadius: pRadii.md, borderWidth: 1, borderColor: pColors.border },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: pColors.warning },
  statusTxt: { color: pColors.ink, fontWeight: '800', flex: 1 },
  pay: { color: pColors.inkMuted, fontSize: 12 },
  customer: { flexDirection: 'row', alignItems: 'center', gap: pSpacing.md, backgroundColor: pColors.surface, borderRadius: pRadii.md, padding: pSpacing.md, borderWidth: 1, borderColor: pColors.border },
  cAv: { width: 48, height: 48, borderRadius: 24 },
  cN: { color: pColors.ink, fontWeight: '700', fontSize: 15 },
  cP: { color: pColors.inkMuted, fontSize: 12, marginTop: 2 },
  iBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: pColors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: pColors.surface, borderRadius: pRadii.md, padding: pSpacing.md, borderWidth: 1, borderColor: pColors.border },
  decline: { flex: 1, paddingVertical: 16, borderRadius: pRadii.pill, backgroundColor: pColors.surface, borderWidth: 1, borderColor: pColors.borderStrong, alignItems: 'center' },
  declineTxt: { color: pColors.ink, fontWeight: '700' },
  accept: { flex: 1.5, paddingVertical: 16, borderRadius: pRadii.pill, backgroundColor: pColors.ink, alignItems: 'center' },
  acceptTxt: { color: pColors.gold, fontWeight: '800' },
});
