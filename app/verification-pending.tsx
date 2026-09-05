import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { pColors, pRadii, pSpacing, pType } from '@/src/theme';
import { authenticatedFetch, clearPartnerSession, loadPartnerProfileId, loadPartnerUser, partnerApi, updatePartnerUser } from '@/src/api';
import { signOutFromFirebase } from '@/src/auth';

const BASE = 'http://localhost:8080/ws_glowmeout_partner_services/partner';

export default function VerificationPending() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    (async () => {
      const currentUser = await loadPartnerUser();
      setUser(currentUser);
      await check();
    })();
  }, []);

  const fetchOnBoardValidation = async () => {
    const currentUser = (await loadPartnerUser()) || user;
    const partnerUUID =
      (await loadPartnerProfileId()) ||
      currentUser?.partnerUUID ||
      currentUser?.partner_uuid ||
      currentUser?.id ||
      currentUser?.uuid;
    if (!partnerUUID) throw new Error('Partner profile ID not found.');

    const res = await authenticatedFetch(`${BASE}/${partnerUUID}/fetchPartnerOnBoardValidation`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Unable to load onboarding validation');
    }

    return res.json();
  };

  const check = async () => {
    setChecking(true);
    try {
      const validation = await fetchOnBoardValidation();
      const isKycValid = validation?.isKYCValidated === true;
      const isBankValid = validation?.isBankDetailsValidated === true;
      const isCertificateValid = validation?.isCertificateValidated === true;
      const isAccepted = validation?.isProfileAccepted === true;
      const isRejected = validation?.isProfileRejected === true;

      if (isAccepted) {
        router.replace('/(tabs)/dashboard');
        return;
      }

      setUser({
        ...(await loadPartnerUser()),
        validation,
        onboarding: {
          isKYCValidated: isKycValid,
          isBankDetailsValidated: isBankValid,
          isCertificateValidated: isCertificateValid,
          isProfileAccepted: isAccepted,
          isProfileRejected: isRejected,
          comments: validation?.comments || '',
        },
      });
    } catch (error) {
      console.warn('Onboarding validation fetch failed', error);
      setUser(await loadPartnerUser());
    } finally { setChecking(false); }
  };

  // Demo helper to unlock dashboard instantly for the presenter.
  const approve = async () => {
    setChecking(true);
    try {
      const res = await partnerApi('/partner/approve', { method: 'POST' });
      await updatePartnerUser(res.user);
      router.replace('/(tabs)/dashboard');
    } finally { setChecking(false); }
  };

  const logout = async () => {
    await signOutFromFirebase();
    await clearPartnerSession();
    router.replace('/landing');
  };

  return (
    <View style={styles.c} testID="verification-pending">
      <LinearGradient colors={[pColors.ink, '#20242A']} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={{ flex: 1, padding: pSpacing.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>GlowMeOut</Text>
            <View style={styles.pill}><Text style={styles.pillTxt}>PARTNER</Text></View>
          </View>
          <Pressable onPress={logout} style={styles.logoutBtn} testID="pending-logout"><Feather name="log-out" size={16} color={pColors.gold} /></Pressable>
        </View>

        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Animated.View entering={ZoomIn.duration(400)} style={styles.badge}>
            <Feather name="clock" size={38} color={pColors.gold} />
          </Animated.View>
          <Animated.Text entering={FadeInDown.delay(200)} style={styles.title}>Application submitted</Animated.Text>
          <Animated.Text entering={FadeInDown.delay(300)} style={styles.sub}>
            Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}. Our verification team will review your profile within 24–48 hours. You will be notified when approved.
          </Animated.Text>

          <View style={styles.timeline}>
            {[
              { s: 'Application received', done: true, active: false },
              { s: 'KYC & bank verification', done: false, active: true },
              { s: 'Team approval', done: false, active: false },
              { s: 'Ready to accept bookings', done: false, active: false },
            ].map((t, i) => (
              <View key={i} style={styles.step}>
                <View style={[styles.stepDot, t.done && styles.stepDone, t.active && styles.stepActive]}>
                  {t.done ? <Feather name="check" size={12} color={pColors.ink} /> : t.active ? <View style={styles.pulse} /> : null}
                </View>
                <Text style={[styles.stepTxt, (t.done || t.active) && { color: pColors.surface }]}>{t.s}</Text>
              </View>
            ))}
          </View>

          <View style={styles.help}>
            <Feather name="info" size={14} color={pColors.gold} />
            <Text style={styles.helpTxt}>Questions? Reach out to partner-support@glowmeout.com</Text>
          </View>
        </View>

        <Pressable style={styles.check} onPress={check} disabled={checking} testID="check-status-btn">
          {checking ? <ActivityIndicator color={pColors.ink} /> : (<><Feather name="refresh-cw" size={16} color={pColors.ink} /><Text style={styles.checkTxt}>Check verification status</Text></>)}
        </Pressable>
        <Pressable style={styles.demoBtn} onPress={approve} testID="demo-approve-btn">
          <Text style={styles.demoTxt}>Approve now (demo)</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.ink },
  brandRow: { flexDirection: 'row', gap: pSpacing.sm, alignItems: 'center' },
  brand: { color: pColors.surface, fontSize: 20, fontWeight: '700' },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: pRadii.pill, borderWidth: 1, borderColor: pColors.gold },
  pillTxt: { color: pColors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  badge: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(201,162,75,0.15)', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: pColors.gold },
  title: { ...pType.display, color: pColors.surface, textAlign: 'center', marginTop: pSpacing.xl },
  sub: { color: 'rgba(246,245,241,0.75)', textAlign: 'center', ...pType.body, marginTop: pSpacing.md, paddingHorizontal: pSpacing.md, lineHeight: 22 },
  timeline: { marginTop: pSpacing.xl, gap: pSpacing.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: pSpacing.md },
  stepDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  stepDone: { backgroundColor: pColors.gold, borderColor: pColors.gold },
  stepActive: { borderColor: pColors.gold },
  pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: pColors.gold },
  stepTxt: { color: 'rgba(246,245,241,0.5)', fontSize: 14 },
  help: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', marginTop: pSpacing.xxl },
  helpTxt: { color: 'rgba(246,245,241,0.55)', fontSize: 12 },
  check: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: pRadii.pill, backgroundColor: pColors.gold },
  checkTxt: { color: pColors.ink, fontWeight: '700', fontSize: 15 },
  demoBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 6 },
  demoTxt: { color: 'rgba(246,245,241,0.5)', fontSize: 12, textDecorationLine: 'underline' },
});
