import { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { loadPartnerToken, loadPartnerUser } from '@/src/api';
import { pColors } from '@/src/theme';

/**
 * Standalone Partner app splash gate.
 * Restores an existing partner session (WhatsApp/Uber-style) — no OTP re-prompt.
 * Routes:
 *   - approved partner    → /(tabs)/dashboard
 *   - pending/rejected    → /verification-pending
 *   - no session          → /landing
 */
export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      await new Promise((r) => setTimeout(r, 700));
      const token = await loadPartnerToken();
      const user = await loadPartnerUser();
      if (token && user) {
        const status = user.artist_status || 'unregistered';
        if (status === 'approved') router.replace('/(tabs)/dashboard');
        else if (status === 'unregistered') router.replace('/register');
        else router.replace('/verification-pending');
      } else {
        router.replace('/landing');
      }
    })();
  }, []);

  return (
    <View style={styles.c} testID="partner-splash">
      <View style={styles.brandRow}>
        <Text style={styles.brand}>GlowMeOut</Text>
        <View style={styles.pill}><Text style={styles.pillTxt}>PARTNER</Text></View>
      </View>
      <ActivityIndicator color={pColors.gold} style={{ marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.ink, alignItems: 'center', justifyContent: 'center' },
  brandRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  brand: { color: pColors.surface, fontSize: 32, fontWeight: '700', letterSpacing: -0.8 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: pColors.gold },
  pillTxt: { color: pColors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
});
