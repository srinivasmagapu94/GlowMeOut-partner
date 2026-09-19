import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Pressable } from 'react-native';
import { useRootNavigationState, useRouter } from 'expo-router';
import { fetchPartnerProfile, loadPartnerProfileId, partnerApi } from '@/src/api';
import { pColors } from '@/src/theme';
import { useAuth } from '@/src/auth-context';
import { getOnboardingDecision } from '@/src/onboarding';

/**
 * Restores Firebase auth first, then lets the backend accountStatus values
 * choose Home or the first incomplete onboarding step.
 */
export default function Index() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const { isAuthenticated, isLoading } = useAuth();
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!rootNavigationState?.key || isLoading) return;

    let cancelled = false;

    (async () => {
      if (!isAuthenticated) {
        router.replace('/landing');
        return;
      }

      try {
        setChecking(true);
        const partnerUUID = await loadPartnerProfileId();
        const profile = partnerUUID
          ? await fetchPartnerProfile(partnerUUID)
          : await partnerApi('/partner/me');
        if (!cancelled) {
          const decision = getOnboardingDecision(profile);
          if (String(profile?.accountStatus || '').toUpperCase() === 'COMPLETED'
            || String(profile?.accountStatus || '').toUpperCase() === 'ACTIVE'
            || String(profile?.accountStatus || '').toUpperCase() === 'APPROVED'
            || String(profile?.accountStatus || '').toUpperCase() === 'FULLY_ONBOARDED') {
            router.replace('/(tabs)/dashboard');
            return;
          }
          if (decision.kind === 'unknown') {
            setError('We could not determine your onboarding status. Please try again.');
          } else {
            router.replace(decision.route);
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Unable to load your onboarding status.');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, retryCount, rootNavigationState?.key, router]);

  if (error) {
    return (
      <View style={styles.c}>
        <Text style={styles.error}>{error}</Text>
        <Pressable style={styles.retry} onPress={() => { setError(''); setRetryCount((count) => count + 1); }}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.c} testID="partner-splash">
      <View style={styles.brandRow}>
        <Text style={styles.brand}>GlowMeOut</Text>
        <View style={styles.pill}><Text style={styles.pillTxt}>PARTNER</Text></View>
      </View>
      <ActivityIndicator color={pColors.gold} style={{ marginTop: 24 }} animating={checking || isLoading} />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.ink, alignItems: 'center', justifyContent: 'center' },
  brandRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  brand: { color: pColors.surface, fontSize: 32, fontWeight: '700', letterSpacing: -0.8 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: pColors.gold },
  pillTxt: { color: pColors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  error: { color: pColors.surface, textAlign: 'center', paddingHorizontal: 32, lineHeight: 22 },
  retry: { marginTop: 16, backgroundColor: pColors.gold, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
  retryText: { color: pColors.ink, fontWeight: '700' },
});
