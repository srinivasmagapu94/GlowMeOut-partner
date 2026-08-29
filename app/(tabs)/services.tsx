import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pColors, pRadii, pSpacing, pType, inr, SERVICE_CATALOG } from '@/src/theme';
import { partnerApi } from '@/src/api';

const MODE_LABEL: Record<string, string> = {
  fixed: 'Fixed price',
  package: 'Packages',
  custom: 'Custom quote',
};

export default function Services() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await partnerApi('/partner/services')); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const priceLabel = (s: any) => {
    if (s.pricing_mode === 'fixed') return inr(s.fixed_price || 0);
    if (s.pricing_mode === 'custom') return `From ${inr(s.custom_starting_price || 0)}`;
    if (s.pricing_mode === 'package') {
      const prices = (s.packages || []).map((p: any) => p.price).filter(Boolean);
      return prices.length ? `From ${inr(Math.min(...prices))}` : '—';
    }
    return '—';
  };

  return (
    <View style={styles.c} testID="partner-services">
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.title}>Services</Text>
          <Pressable style={styles.addBtn} onPress={() => router.push('/service/new')} testID="add-service-btn">
            <Feather name="plus" size={16} color={pColors.ink} />
            <Text style={styles.addTxt}>Add</Text>
          </Pressable>
        </View>
        <Text style={styles.sub}>Configure your offerings with fixed price, package tiers, or custom quotes.</Text>
      </SafeAreaView>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={pColors.gold} />}
        contentContainerStyle={{ padding: pSpacing.xl, gap: pSpacing.md, paddingBottom: 120 }}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push({ pathname: '/service/[id]', params: { id: item.id } })}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.icon}><Feather name={(SERVICE_CATALOG.find(s => s.id === item.category)?.icon as any) || 'star'} size={18} color={pColors.goldDeep} /></View>
              <View style={{ flex: 1, marginLeft: pSpacing.md }}>
                <Text style={styles.name}>{item.name}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.modeChip}><Text style={styles.modeTxt}>{MODE_LABEL[item.pricing_mode] || item.pricing_mode}</Text></View>
                  <Text style={styles.dur}>· {item.duration_min || 60} min</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.price}>{priceLabel(item)}</Text>
                <Feather name="chevron-right" size={16} color={pColors.inkFaint} style={{ marginTop: 4 }} />
              </View>
            </View>
            {item.pricing_mode === 'package' && (item.packages || []).length > 0 && (
              <View style={styles.pkgRow}>
                {(item.packages as any[]).map((p, i) => (
                  <View key={i} style={styles.pkgChip}>
                    <Text style={styles.pkgName}>{p.name}</Text>
                    <Text style={styles.pkgPrice}>{inr(p.price)}</Text>
                  </View>
                ))}
              </View>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="layers" size={36} color={pColors.inkFaint} />
            <Text style={styles.emptyTitle}>No services yet</Text>
            <Text style={styles.emptySub}>Add your first service to start receiving bookings.</Text>
            <Pressable style={styles.emptyBtn} onPress={() => router.push('/service/new')}>
              <Text style={styles.emptyBtnTxt}>Add a service</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.bg },
  header: { paddingHorizontal: pSpacing.xl, paddingBottom: pSpacing.md },
  title: { color: pColors.ink, ...pType.display, marginTop: pSpacing.sm },
  sub: { color: pColors.inkMuted, marginTop: 4, fontSize: 13 },
  addBtn: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: pColors.gold, paddingHorizontal: 14, paddingVertical: 8, borderRadius: pRadii.pill },
  addTxt: { color: pColors.ink, fontWeight: '800', fontSize: 12 },
  card: { backgroundColor: pColors.surface, borderRadius: pRadii.md, borderWidth: 1, borderColor: pColors.border, padding: pSpacing.lg },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: pColors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  name: { color: pColors.ink, fontWeight: '700', fontSize: 15 },
  metaRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 6 },
  modeChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: pRadii.pill, backgroundColor: pColors.ink },
  modeTxt: { color: pColors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  dur: { color: pColors.inkMuted, fontSize: 11 },
  price: { color: pColors.ink, fontWeight: '800', fontSize: 15 },
  pkgRow: { flexDirection: 'row', gap: 6, marginTop: pSpacing.md, flexWrap: 'wrap' },
  pkgChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: pRadii.sm, backgroundColor: pColors.surfaceMuted, flexDirection: 'row', gap: 6 },
  pkgName: { color: pColors.ink, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  pkgPrice: { color: pColors.goldDeep, fontSize: 11, fontWeight: '800' },
  empty: { alignItems: 'center', padding: pSpacing.xxl, backgroundColor: pColors.surface, borderRadius: pRadii.md, borderWidth: 1, borderColor: pColors.border },
  emptyTitle: { color: pColors.ink, ...pType.h3, marginTop: pSpacing.md },
  emptySub: { color: pColors.inkMuted, marginTop: 4, textAlign: 'center', fontSize: 13 },
  emptyBtn: { marginTop: pSpacing.lg, backgroundColor: pColors.ink, paddingHorizontal: pSpacing.xl, paddingVertical: 12, borderRadius: pRadii.pill },
  emptyBtnTxt: { color: pColors.gold, fontWeight: '700' },
});
