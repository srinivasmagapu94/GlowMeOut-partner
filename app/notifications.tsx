import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pColors, pRadii, pSpacing, pType } from '@/src/theme';

const DEMO = [
  { id: '1', title: 'New booking request', body: 'Priya S. requested Bridal Makeup on Nov 12', time: '2m ago' },
  { id: '2', title: 'Payout credited', body: '₹12,500 sent to your bank account', time: '5h ago' },
  { id: '3', title: 'Portfolio boost live', body: 'You are featured in Mumbai discover feed', time: 'Yesterday' },
];

export default function PartnerNotifications() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.c} testID="partner-notifications">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={{ width: 40 }}><Feather name="arrow-left" size={22} color={pColors.ink} /></Pressable>
        <Text style={styles.h}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>
      <FlatList
        data={DEMO}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: pSpacing.xl, gap: pSpacing.md }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.dot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.t}>{item.title}</Text>
              <Text style={styles.b}>{item.body}</Text>
              <Text style={styles.tm}>{item.time}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: pSpacing.xl, paddingVertical: pSpacing.md },
  h: { ...pType.h2, color: pColors.ink },
  card: { flexDirection: 'row', gap: pSpacing.md, backgroundColor: pColors.surface, borderRadius: pRadii.md, padding: pSpacing.lg, borderWidth: 1, borderColor: pColors.border, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: pColors.gold, marginTop: 6 },
  t: { color: pColors.ink, fontWeight: '700', fontSize: 14 },
  b: { color: pColors.inkMuted, marginTop: 4, fontSize: 13 },
  tm: { color: pColors.inkFaint, marginTop: 4, fontSize: 11 },
});
