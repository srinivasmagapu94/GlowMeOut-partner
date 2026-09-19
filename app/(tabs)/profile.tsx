import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pColors, pRadii, pSpacing, pType, SERVICE_CATALOG } from '@/src/theme';
import { clearPartnerSession, loadPartnerUser, partnerApi } from '@/src/api';
import { signOutFromFirebase } from '@/src/auth';

const MENU = [
  { icon: 'user', label: 'Personal details', route: '/edit-profile' },
  { icon: 'award', label: 'Certificates', route: '/certificates' },
  { icon: 'shield', label: 'KYC status', route: '/kyc-status' },
  { icon: 'credit-card', label: 'Bank & payouts', route: '/bank' },
  { icon: 'calendar', label: 'Availability', route: '/availability' },
  { icon: 'image', label: 'Portfolio', route: '/portfolio' },
  { icon: 'plus-circle', label: 'Add-ons', route: '/addons' },
  { icon: 'help-circle', label: 'Help & support', route: '/help' },
];

export default function PartnerProfile() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [partner, setPartner] = useState<any>(null);
  useFocusEffect(useCallback(() => {
    (async () => {
      setUser(await loadPartnerUser());
      try { const res = await partnerApi('/partner/me'); setPartner(res.partner); } catch {}
    })();
  }, []));

  const logout = async () => {
    await signOutFromFirebase();
    await clearPartnerSession();
    router.replace('/landing');
  };

  return (
    <View style={styles.c} testID="partner-profile">
      <SafeAreaView edges={['top']}>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={styles.head}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: pSpacing.lg }}>
              <Image source={user?.avatar || partner?.profile_picture || 'https://i.pravatar.cc/200'} style={styles.avatar} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{user?.name || partner?.full_name || 'Partner'}</Text>
                <Text style={styles.phone}>{user?.phone}</Text>
                <View style={styles.verified}>
                  <Feather name="check-circle" size={11} color={pColors.gold} />
                  <Text style={styles.verifiedTxt}>Verified Partner</Text>
                </View>
              </View>
            </View>
            <View style={styles.svcRow}>
              {(partner?.service_categories || []).slice(0, 5).map((id: string) => (
                <View key={id} style={styles.svcChip}>
                  <Text style={styles.svcChipTxt}>{SERVICE_CATALOG.find((s) => s.id === id)?.name || id}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            {MENU.map((m, i) => (
              <Pressable key={m.label} style={[styles.item, i < MENU.length - 1 && styles.border]} onPress={() => router.push(m.route as any)}>
                <View style={styles.itemIcon}><Feather name={m.icon as any} size={16} color={pColors.goldDeep} /></View>
                <Text style={styles.itemTxt}>{m.label}</Text>
                <Feather name="chevron-right" size={16} color={pColors.inkFaint} />
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.logout} onPress={logout} testID="partner-logout"><Feather name="log-out" size={16} color={pColors.error} /><Text style={styles.logoutTxt}>Sign out</Text></Pressable>
          <Text style={styles.footer}>GlowMeOut Partner · v1.0</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.bg },
  head: { paddingHorizontal: pSpacing.xl, paddingTop: pSpacing.md, paddingBottom: pSpacing.lg },
  avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: pColors.gold },
  name: { color: pColors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  phone: { color: pColors.inkMuted, marginTop: 2, fontSize: 12 },
  verified: { flexDirection: 'row', gap: 4, alignItems: 'center', alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: pRadii.pill, borderWidth: 1, borderColor: pColors.gold, backgroundColor: pColors.goldSoft },
  verifiedTxt: { color: pColors.goldDeep, fontSize: 10, fontWeight: '800' },
  svcRow: { flexDirection: 'row', gap: 6, marginTop: pSpacing.md, flexWrap: 'wrap' },
  svcChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: pRadii.pill, backgroundColor: pColors.surfaceMuted, borderWidth: 1, borderColor: pColors.border },
  svcChipTxt: { color: pColors.ink, fontSize: 11, fontWeight: '600' },
  card: { marginHorizontal: pSpacing.xl, backgroundColor: pColors.surface, borderRadius: pRadii.md, borderWidth: 1, borderColor: pColors.border },
  item: { flexDirection: 'row', alignItems: 'center', gap: pSpacing.md, paddingHorizontal: pSpacing.md, paddingVertical: 14 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: pColors.divider },
  itemIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: pColors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  itemTxt: { flex: 1, color: pColors.ink, fontSize: 14, fontWeight: '600' },
  logout: { flexDirection: 'row', gap: 6, alignSelf: 'center', alignItems: 'center', marginTop: pSpacing.xl, paddingHorizontal: pSpacing.xl, paddingVertical: 12 },
  logoutTxt: { color: pColors.error, fontWeight: '700' },
  footer: { textAlign: 'center', color: pColors.inkFaint, marginTop: pSpacing.md, fontSize: 11 },
});
