import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { pColors, pRadii, pSpacing, pType } from '@/src/theme';
import { normalizePartnerMobileNumber, savePartnerPhone } from '@/src/api';

const BASE = 'http://localhost:8080/ws_glowmeout_partner_services';

export default function PartnerLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const send = async () => {
    setErr('');
    const normalized = normalizePartnerMobileNumber(phone);
    if (!normalized) return setErr('Enter a valid 10-digit mobile number');
    try {
      setLoading(true);
      const res = await fetch(`${BASE}/partner/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber: normalized }),
      });

      if (res.status === 200) {
        await savePartnerPhone(normalized);
        router.push({ pathname: '/otp', params: { phone: normalized } });
        return;
      }

      const text = await res.text();
      throw new Error(text || 'Login failed');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.c} testID="partner-login">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: pSpacing.xl, paddingBottom: pSpacing.xxl }} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.back}><Feather name="arrow-left" size={22} color={pColors.ink} /></Pressable>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>GlowMeOut</Text>
            <View style={styles.pill}><Text style={styles.pillTxt}>PARTNER</Text></View>
          </View>
          <Text style={styles.h1}>Sign in</Text>
          <Text style={styles.sub}>Enter your registered mobile number. First-time users can register right after OTP.</Text>
          <View style={styles.field}>
            <Text style={styles.label}>MOBILE NUMBER</Text>
            <View style={styles.row}>
              <Text style={styles.prefix}>+91</Text>
              <View style={styles.dv} />
              <TextInput
                testID="partner-phone-input"
                value={phone}
                onChangeText={setPhone}
                keyboardType="number-pad"
                maxLength={10}
                placeholder="98765 43210"
                placeholderTextColor={pColors.inkFaint}
                selectionColor={pColors.goldDeep}
                style={[styles.input, { outline: 'none', shadowOpacity: 0, elevation: 0, borderWidth: 0, backgroundColor: 'transparent' }]}
              />
            </View>
            {!!err && <Text style={styles.err}>{err}</Text>}
          </View>
          <View style={styles.info}>
            <Feather name="shield" size={16} color={pColors.goldDeep} />
            <Text style={styles.infoTxt}>Your session stays signed in on this device — you won&apos;t need OTP each time.</Text>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Pressable style={[styles.cta, loading && { opacity: 0.6 }]} disabled={loading} onPress={send} testID="partner-send-otp">
            <Text style={styles.ctaTxt}>{loading ? 'Sending…' : 'Send OTP'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.bg },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  brandRow: { flexDirection: 'row', gap: pSpacing.sm, alignItems: 'center', marginTop: pSpacing.md },
  brand: { color: pColors.ink, fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: pRadii.pill, borderWidth: 1, borderColor: pColors.gold, backgroundColor: pColors.surface },
  pillTxt: { color: pColors.goldDeep, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  h1: { ...pType.display, color: pColors.ink, marginTop: pSpacing.xl },
  sub: { color: pColors.inkMuted, marginTop: pSpacing.sm, ...pType.body },
  field: { marginTop: pSpacing.xxl },
  label: { color: pColors.inkMuted, ...pType.caption },
  row: { marginTop: pSpacing.md, flexDirection: 'row', alignItems: 'center', backgroundColor: pColors.surface, borderRadius: pRadii.md, borderWidth: 1, borderColor: pColors.border, paddingHorizontal: pSpacing.lg, height: 60 },
  prefix: { fontSize: 18, color: pColors.ink, fontWeight: '700' },
  dv: { width: 1, height: 24, backgroundColor: pColors.border, marginHorizontal: pSpacing.md },
  input: { flex: 1, fontSize: 18, color: pColors.ink, letterSpacing: 1 },
  err: { color: pColors.error, marginTop: pSpacing.sm, fontSize: 13 },
  info: { flexDirection: 'row', gap: pSpacing.sm, backgroundColor: pColors.goldSoft, padding: pSpacing.md, borderRadius: pRadii.md, marginTop: pSpacing.xl, alignItems: 'flex-start' },
  infoTxt: { flex: 1, color: pColors.goldDeep, fontSize: 12, lineHeight: 18 },
  footer: { padding: pSpacing.xl, paddingTop: pSpacing.md, backgroundColor: pColors.bg },
  cta: { backgroundColor: pColors.ink, borderRadius: pRadii.pill, paddingVertical: 18, alignItems: 'center' },
  ctaTxt: { color: pColors.gold, fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
});
