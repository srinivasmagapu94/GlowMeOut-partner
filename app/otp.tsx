import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { pColors, pRadii, pSpacing, pType } from '@/src/theme';
import { partnerApi, savePartnerSession } from '@/src/api';

export default function PartnerOtp() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const router = useRouter();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const refs = useRef<Array<TextInput | null>>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [seconds, setSeconds] = useState(30);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const set = (i: number, v: string) => {
    const val = v.replace(/\D/g, '').slice(0, 1);
    const next = [...digits]; next[i] = val; setDigits(next);
    if (val && i < 5) refs.current[i + 1]?.focus();
    if (next.every((d) => d) && next.join('').length === 6) verify(next.join(''));
  };

  const verify = async (code?: string) => {
    setErr('');
    const otp = code || digits.join('');
    if (otp.length !== 6) return setErr('Enter the 6-digit code');
    try {
      setLoading(true);
      const res = await partnerApi('/partner/auth/otp/verify', { method: 'POST', body: JSON.stringify({ phone, otp }) });
      await savePartnerSession(res.token, res.user);
      const status = res.user.artist_status || 'unregistered';
      if (status === 'unregistered') router.replace('/register');
      else if (status === 'pending_verification' || status === 'rejected') router.replace('/verification-pending');
      else router.replace('/(tabs)/dashboard');
    } catch { setErr('Invalid code. Use 123456 for demo.'); }
    finally { setLoading(false); }
  };

  const resend = async () => {
    if (seconds > 0) return;
    setSeconds(30);
    await partnerApi('/partner/auth/otp/request', { method: 'POST', body: JSON.stringify({ phone }) });
  };

  return (
    <SafeAreaView style={styles.c} testID="partner-otp">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable onPress={() => router.back()} style={styles.back}><Feather name="arrow-left" size={22} color={pColors.ink} /></Pressable>
        <View style={{ paddingHorizontal: pSpacing.xl }}>
          <Text style={styles.h1}>Verify OTP</Text>
          <Text style={styles.sub}>We sent a 6-digit code to <Text style={{ fontWeight: '700' }}>{phone}</Text>. Use <Text style={{ color: pColors.goldDeep, fontWeight: '700' }}>123456</Text> for demo.</Text>
          <View style={styles.row}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                testID={`partner-otp-${i}`}
                ref={(r) => { refs.current[i] = r; }}
                value={d}
                onChangeText={(v) => set(i, v)}
                onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus(); }}
                keyboardType="number-pad"
                maxLength={1}
                style={[styles.box, d && styles.boxFilled]}
              />
            ))}
          </View>
          {!!err && <Text style={styles.err}>{err}</Text>}
          <Pressable onPress={resend} style={{ marginTop: pSpacing.xl }}>
            <Text style={styles.resend}>{seconds > 0 ? `Resend in ${seconds}s` : 'Resend code'}</Text>
          </Pressable>
        </View>
        <View style={styles.footer}>
          <Pressable style={[styles.cta, loading && { opacity: 0.6 }]} disabled={loading} onPress={() => verify()} testID="partner-verify-btn">
            <Text style={styles.ctaTxt}>{loading ? 'Verifying…' : 'Verify & continue'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.bg },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', margin: pSpacing.md },
  h1: { ...pType.display, color: pColors.ink },
  sub: { color: pColors.inkMuted, marginTop: pSpacing.md, ...pType.body },
  row: { flexDirection: 'row', gap: 8, marginTop: pSpacing.xxl, justifyContent: 'center' },
  box: { width: 48, height: 60, borderRadius: pRadii.md, borderWidth: 1, borderColor: pColors.border, backgroundColor: pColors.surface, textAlign: 'center', fontSize: 24, fontWeight: '700', color: pColors.ink },
  boxFilled: { borderColor: pColors.gold, backgroundColor: '#FFFDF6' },
  err: { color: pColors.error, marginTop: pSpacing.md, fontSize: 13 },
  resend: { color: pColors.goldDeep, fontWeight: '700', fontSize: 14 },
  footer: { marginTop: 'auto', padding: pSpacing.xl, paddingTop: pSpacing.md },
  cta: { backgroundColor: pColors.ink, borderRadius: pRadii.pill, paddingVertical: 18, alignItems: 'center' },
  ctaTxt: { color: pColors.gold, fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
});
