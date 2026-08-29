import { View, Text, StyleSheet, ScrollView, Pressable, FlatList, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pColors, pRadii, pSpacing, pType, inr } from '@/src/theme';
import { partnerApi } from '@/src/api';

const TABS = [
  { k: 'pending', label: 'Requests' },
  { k: 'confirmed', label: 'Upcoming' },
  { k: 'completed', label: 'Completed' },
  { k: 'declined', label: 'Declined' },
] as const;

export default function Jobs() {
  const router = useRouter();
  const [tab, setTab] = useState<'pending' | 'confirmed' | 'completed' | 'declined'>('pending');
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await partnerApi('/partner/bookings')); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = items.filter((b) => {
    if (tab === 'pending') return b.status === 'pending';
    if (tab === 'confirmed') return ['confirmed', 'in_progress'].includes(b.status);
    if (tab === 'completed') return b.status === 'completed';
    return ['rejected', 'cancelled'].includes(b.status);
  });

  const act = async (id: string, action: 'accept' | 'decline' | 'complete') => {
    await partnerApi(`/partner/bookings/${id}/${action}`, { method: 'POST' });
    await load();
  };

  return (
    <View style={styles.c} testID="partner-jobs">
      <SafeAreaView edges={['top']} style={styles.header}>
        <Text style={styles.title}>Jobs</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map((t) => (
            <Pressable key={t.k} onPress={() => setTab(t.k)} style={[styles.tab, tab === t.k && styles.tabActive]} testID={`tab-${t.k}`}>
              <Text style={[styles.tabTxt, tab === t.k && styles.tabTxtActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={pColors.gold} />}
        contentContainerStyle={{ padding: pSpacing.xl, paddingBottom: 120, gap: pSpacing.md }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', gap: pSpacing.md }}>
              <View style={styles.avatarBox}>
                {item.customer?.avatar ? <Image source={item.customer.avatar} style={{ width: '100%', height: '100%', borderRadius: pRadii.sm }} contentFit="cover" /> : <Feather name="user" size={22} color={pColors.goldDeep} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cName}>{item.customer?.name || 'Customer'}</Text>
                <Text style={styles.cPhone}>{item.customer?.phone || '—'}</Text>
                <View style={styles.badgeRow}>
                  <View style={styles.badge}><Text style={styles.badgeTxt}>{item.service_name}</Text></View>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.price}>{inr(item.price)}</Text>
                <Text style={styles.dt}>{item.date}</Text>
                <Text style={styles.dt}>{item.time}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.locRow}>
              <Feather name="map-pin" size={12} color={pColors.inkMuted} />
              <Text style={styles.locTxt} numberOfLines={2}>{item.address}</Text>
            </View>
            {tab === 'pending' && (
              <View style={styles.actions}>
                <Pressable style={styles.declineBtn} onPress={() => act(item.id, 'decline')} testID={`decline-${item.id}`}><Text style={styles.declineTxt}>Decline</Text></Pressable>
                <Pressable style={styles.chatBtn} testID={`chat-${item.id}`}><Feather name="message-circle" size={16} color={pColors.ink} /></Pressable>
                <Pressable style={styles.acceptBtn} onPress={() => act(item.id, 'accept')} testID={`accept-${item.id}`}>
                  <Text style={styles.acceptTxt}>Accept</Text>
                  <Feather name="arrow-right" size={14} color={pColors.ink} />
                </Pressable>
              </View>
            )}
            {tab === 'confirmed' && (
              <View style={styles.actions}>
                <Pressable style={styles.smallBtn}><Feather name="phone" size={14} color={pColors.ink} /><Text style={styles.smallTxt}>Call</Text></Pressable>
                <Pressable style={styles.smallBtn}><Feather name="navigation" size={14} color={pColors.ink} /><Text style={styles.smallTxt}>Navigate</Text></Pressable>
                <Pressable style={styles.acceptBtn} onPress={() => act(item.id, 'complete')} testID={`complete-${item.id}`}>
                  <Text style={styles.acceptTxt}>Mark complete</Text>
                </Pressable>
              </View>
            )}
            {tab === 'completed' && (
              <View style={styles.compRow}>
                <Feather name="check-circle" size={14} color={pColors.success} />
                <Text style={styles.compTxt}>Completed · Payment {item.payment_status}</Text>
              </View>
            )}
            {tab === 'declined' && (
              <View style={styles.compRow}>
                <Feather name="x-circle" size={14} color={pColors.error} />
                <Text style={[styles.compTxt, { color: pColors.error }]}>Declined · Customer notified</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="inbox" size={40} color={pColors.inkFaint} />
            <Text style={styles.emptyTitle}>No {tab === 'pending' ? 'pending requests' : tab === 'confirmed' ? 'upcoming jobs' : tab === 'completed' ? 'completed jobs' : 'declined jobs'}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.bg },
  header: { paddingHorizontal: pSpacing.xl, paddingBottom: pSpacing.md, backgroundColor: pColors.bg },
  title: { color: pColors.ink, ...pType.display, marginTop: pSpacing.sm },
  tabs: { flexDirection: 'row', gap: pSpacing.sm, marginTop: pSpacing.md, paddingRight: pSpacing.xl },
  tab: { paddingHorizontal: pSpacing.lg, height: 34, borderRadius: pRadii.pill, borderWidth: 1, borderColor: pColors.border, backgroundColor: pColors.surface, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tabActive: { backgroundColor: pColors.ink, borderColor: pColors.ink },
  tabTxt: { color: pColors.ink, fontSize: 12, fontWeight: '700' },
  tabTxtActive: { color: pColors.gold },
  card: { backgroundColor: pColors.surface, borderRadius: pRadii.md, borderWidth: 1, borderColor: pColors.border, padding: pSpacing.lg },
  avatarBox: { width: 44, height: 44, borderRadius: pRadii.sm, backgroundColor: pColors.goldSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cName: { color: pColors.ink, fontWeight: '700', fontSize: 15 },
  cPhone: { color: pColors.inkMuted, fontSize: 12, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: pRadii.pill, backgroundColor: pColors.surfaceMuted },
  badgeTxt: { color: pColors.ink, fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  price: { color: pColors.ink, fontWeight: '800', fontSize: 18 },
  dt: { color: pColors.inkMuted, fontSize: 11, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: pColors.divider, marginVertical: pSpacing.md },
  locRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  locTxt: { color: pColors.inkMuted, fontSize: 12, flex: 1 },
  actions: { flexDirection: 'row', gap: pSpacing.sm, marginTop: pSpacing.md },
  declineBtn: { flex: 1, paddingVertical: 12, borderRadius: pRadii.pill, backgroundColor: pColors.surface, borderWidth: 1, borderColor: pColors.borderStrong, alignItems: 'center' },
  declineTxt: { color: pColors.ink, fontWeight: '700', fontSize: 12 },
  chatBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: pColors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  acceptBtn: { flex: 1.5, flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderRadius: pRadii.pill, backgroundColor: pColors.gold },
  acceptTxt: { color: pColors.ink, fontWeight: '800', fontSize: 12, letterSpacing: 0.3 },
  smallBtn: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, borderRadius: pRadii.pill, backgroundColor: pColors.surfaceMuted },
  smallTxt: { color: pColors.ink, fontWeight: '700', fontSize: 12 },
  compRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: pSpacing.md },
  compTxt: { color: pColors.success, fontWeight: '600', fontSize: 12 },
  empty: { alignItems: 'center', padding: pSpacing.xxl },
  emptyTitle: { color: pColors.inkMuted, marginTop: pSpacing.md, fontSize: 14, fontWeight: '600' },
});
