import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pColors, pRadii, pShadow, pSpacing, pType, inr } from '@/src/theme';
import { fetchPartnerProfile, loadPartnerProfileId, loadPartnerUser } from '@/src/api';
import { ActivationGate } from '@/src/onboarding-guard';

export default function Dashboard() {
  return <ActivationGate><DashboardContent /></ActivationGate>;
}

function DashboardContent() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setUser(await loadPartnerUser());
    const partnerUUID = await loadPartnerProfileId();
    if (!partnerUUID) throw new Error('Partner profile ID not found.');
    setProfile(await fetchPartnerProfile(partnerUUID));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.c} testID="partner-dashboard">
      <SafeAreaView edges={['top']}>
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={pColors.gold} />}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.hello}>Welcome back</Text>
              <Text style={styles.name}>{profile?.fullName || user?.name || 'Partner'}</Text>
            </View>
            <Pressable style={styles.iconBtn} onPress={() => router.push('/notifications')} testID="notif-btn">
              <Feather name="bell" size={18} color={pColors.gold} />
              <View style={styles.notifDot} />
            </Pressable>
          </View>

          {/* Earnings hero */}
          <View style={styles.hero}>
            <LinearGradient colors={[pColors.ink, '#1F252E']} style={StyleSheet.absoluteFillObject} />
            <View style={styles.heroBadge}><Feather name="dollar-sign" size={11} color={pColors.gold} /><Text style={styles.heroBadgeTxt}>TODAY'S EARNINGS</Text></View>
            <Text style={styles.heroAmt}>{profile?.accountStatus || 'ACTIVE'}</Text>
            <View style={styles.heroLine} />
            <View style={styles.heroFoot}>
              <View>
                <Text style={styles.heroLbl}>Total earned</Text>
                <Text style={styles.heroVal}>{profile?.city || '—'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.heroLbl}>Rating</Text>
                <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                  <Feather name="star" size={13} color={pColors.gold} />
                  <Text style={styles.heroVal}>{profile?.verificationStatus || '—'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Metric row */}
          <View style={styles.metrics}>
            <MetricCard icon="inbox" label="Pending" value="—" accent onPress={() => router.push('/(tabs)/jobs')} />
            <MetricCard icon="calendar" label="Upcoming" value="—" onPress={() => router.push('/(tabs)/jobs')} />
          </View>

          {/* Quick actions */}
          <Text style={styles.section}>Quick actions</Text>
          <View style={styles.quickGrid}>
            <QuickAction icon="calendar" label="Availability" onPress={() => router.push('/availability')} />
            <QuickAction icon="image" label="Portfolio" onPress={() => router.push('/portfolio')} />
          </View>

          {/* Today's jobs */}
          <Text style={styles.section}>Today's schedule</Text>
          <View style={styles.empty}>
            <Feather name="user-check" size={24} color={pColors.goldDeep} />
            <Text style={styles.emptyTitle}>Profile loaded</Text>
            <Text style={styles.emptySub}>
              {profile?.emailAddress || profile?.mobileNumber || 'Your partner profile is active.'}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function MetricCard({ icon, label, value, accent, onPress }: any) {
  return (
    <Pressable style={[styles.metric, accent && { backgroundColor: pColors.goldSoft, borderColor: pColors.gold }]} onPress={onPress}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Feather name={icon} size={18} color={accent ? pColors.goldDeep : pColors.ink} />
        <Feather name="arrow-up-right" size={14} color={pColors.inkFaint} />
      </View>
      <Text style={styles.metricVal}>{value}</Text>
      <Text style={styles.metricLbl}>{label}</Text>
    </Pressable>
  );
}
function QuickAction({ icon, label, onPress }: any) {
  return (
    <Pressable style={styles.qa} onPress={onPress}>
      <View style={styles.qaIcon}><Feather name={icon} size={18} color={pColors.goldDeep} /></View>
      <Text style={styles.qaTxt}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: pSpacing.xl, paddingTop: pSpacing.sm, paddingBottom: pSpacing.md },
  hello: { color: pColors.inkMuted, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700' },
  name: { color: pColors.ink, ...pType.h1, marginTop: 2 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: pColors.ink, alignItems: 'center', justifyContent: 'center' },
  notifDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: pColors.gold, borderWidth: 1, borderColor: pColors.ink },
  hero: { marginHorizontal: pSpacing.xl, marginTop: pSpacing.md, borderRadius: pRadii.lg, padding: pSpacing.xl, overflow: 'hidden', ...pShadow.card },
  heroBadge: { flexDirection: 'row', alignSelf: 'flex-start', gap: 4, alignItems: 'center', backgroundColor: 'rgba(201,162,75,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: pRadii.pill, borderWidth: 1, borderColor: 'rgba(201,162,75,0.35)' },
  heroBadgeTxt: { color: pColors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  heroAmt: { color: pColors.surface, ...pType.displayLg, marginTop: pSpacing.md },
  heroLine: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginTop: pSpacing.lg },
  heroFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: pSpacing.md },
  heroLbl: { color: 'rgba(246,245,241,0.55)', fontSize: 11, letterSpacing: 1, fontWeight: '700', textTransform: 'uppercase' },
  heroVal: { color: pColors.surface, fontSize: 20, fontWeight: '700', marginTop: 4 },
  metrics: { flexDirection: 'row', gap: pSpacing.md, marginTop: pSpacing.md, paddingHorizontal: pSpacing.xl },
  metric: { flex: 1, backgroundColor: pColors.surface, borderRadius: pRadii.md, padding: pSpacing.lg, borderWidth: 1, borderColor: pColors.border, minHeight: 100 },
  metricVal: { color: pColors.ink, fontSize: 30, fontWeight: '800', marginTop: pSpacing.md, letterSpacing: -0.5 },
  metricLbl: { color: pColors.inkMuted, fontSize: 12, marginTop: 2, fontWeight: '600' },
  section: { color: pColors.ink, ...pType.h2, marginTop: pSpacing.xl, marginBottom: pSpacing.md, paddingHorizontal: pSpacing.xl },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: pSpacing.sm, paddingHorizontal: pSpacing.xl },
  qa: { width: '48.5%', backgroundColor: pColors.surface, borderRadius: pRadii.md, borderWidth: 1, borderColor: pColors.border, padding: pSpacing.md, alignItems: 'flex-start', minHeight: 84 },
  qaIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: pColors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  qaTxt: { color: pColors.ink, fontWeight: '600', fontSize: 12, marginTop: pSpacing.sm },
  empty: { backgroundColor: pColors.surface, borderRadius: pRadii.md, padding: pSpacing.xl, alignItems: 'center', borderWidth: 1, borderColor: pColors.border, marginHorizontal: pSpacing.xl },
  emptyTitle: { color: pColors.ink, fontWeight: '700', fontSize: 16, marginTop: 8 },
  emptySub: { color: pColors.inkMuted, marginTop: 4, fontSize: 13 },
  job: { flexDirection: 'row', gap: pSpacing.md, backgroundColor: pColors.surface, borderRadius: pRadii.md, borderWidth: 1, borderColor: pColors.border, padding: pSpacing.md, marginHorizontal: pSpacing.xl, marginBottom: pSpacing.sm, alignItems: 'center' },
  jobTime: { width: 56, height: 56, borderRadius: pRadii.sm, backgroundColor: pColors.ink, alignItems: 'center', justifyContent: 'center' },
  jobTimeTxt: { color: pColors.gold, fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },
  jobService: { color: pColors.ink, fontWeight: '700', fontSize: 15 },
  jobMeta: { color: pColors.inkMuted, fontSize: 12, marginTop: 2 },
  jobAddr: { color: pColors.inkFaint, fontSize: 11, marginTop: 2 },
  jobPrice: { color: pColors.ink, fontWeight: '800', fontSize: 15 },
});
