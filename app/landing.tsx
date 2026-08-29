import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pColors, pFont, pRadii, pSpacing, pType } from '@/src/theme';

const { height } = Dimensions.get('window');

export default function PartnerLanding() {
  const router = useRouter();
  return (
    <View style={styles.c} testID="partner-landing">
      <Image
        source="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&q=80"
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
      />
      <LinearGradient colors={['rgba(15,17,20,0.35)', 'rgba(15,17,20,0.85)', pColors.ink]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={styles.top}>
        <Pressable onPress={() => router.back()} testID="close-partner-btn" style={styles.close}>
          <Feather name="x" size={22} color={pColors.surface} />
        </Pressable>
      </SafeAreaView>
      <SafeAreaView style={styles.bottom} edges={['bottom']}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>GlowMeOut</Text>
          <View style={styles.pill}><Text style={styles.pillTxt}>PARTNER</Text></View>
        </View>
        <Text style={styles.title}>Your business.{'\n'}Your brand.{'\n'}Your terms.</Text>
        <Text style={styles.sub}>
          Join India's most trusted network of independent beauty professionals. Manage bookings, showcase your work, and grow your income — all in one place.
        </Text>

        <View style={styles.perks}>
          {['Zero listing fee', 'Same-day payouts', '24×7 support'].map((p) => (
            <View key={p} style={styles.perk}>
              <Feather name="check" size={12} color={pColors.gold} />
              <Text style={styles.perkTxt}>{p}</Text>
            </View>
          ))}
        </View>

        <Pressable style={styles.cta} onPress={() => router.push('/login')} testID="partner-continue">
          <Text style={styles.ctaTxt}>Continue as Partner</Text>
          <Feather name="arrow-right" size={18} color={pColors.ink} />
        </Pressable>
        <Text style={styles.foot}>By continuing you accept the Partner Terms & Payout Policy.</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.ink },
  top: { padding: pSpacing.lg, alignItems: 'flex-end' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  bottom: { marginTop: 'auto', paddingHorizontal: pSpacing.xl, paddingBottom: pSpacing.xl },
  brandRow: { flexDirection: 'row', gap: pSpacing.sm, alignItems: 'center' },
  brand: { color: pColors.surface, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: pRadii.pill, borderWidth: 1, borderColor: pColors.gold },
  pillTxt: { color: pColors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  title: { color: pColors.surface, ...pType.displayLg, marginTop: pSpacing.xl },
  sub: { color: 'rgba(246,245,241,0.75)', ...pType.body, marginTop: pSpacing.md, lineHeight: 22 },
  perks: { flexDirection: 'row', gap: pSpacing.md, marginTop: pSpacing.xl, flexWrap: 'wrap' },
  perk: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: pRadii.pill, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(201,162,75,0.4)' },
  perkTxt: { color: pColors.surface, fontSize: 12, fontWeight: '600' },
  cta: { marginTop: pSpacing.xxl, backgroundColor: pColors.gold, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 18, borderRadius: pRadii.pill },
  ctaTxt: { color: pColors.ink, fontWeight: '700', fontSize: 16 },
  foot: { color: 'rgba(246,245,241,0.5)', fontSize: 11, textAlign: 'center', marginTop: pSpacing.md },
});
