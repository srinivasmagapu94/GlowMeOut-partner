import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pColors, pRadii, pSpacing, pType } from '@/src/theme';
import { partnerApi } from '@/src/api';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export default function Availability() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { (async () => setData(await partnerApi('/availability')))(); }, []);
  const upd = (k: string, v: any) => setData((d: any) => ({ ...d, [k]: v }));
  const toggleDay = (d: string) => {
    const cur: string[] = data.working_days || [];
    upd('working_days', cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]);
  };

  const save = async () => {
    setSaving(true);
    try {
      await partnerApi('/availability', { method: 'PATCH', body: JSON.stringify({
        working_days: data.working_days, working_hours_start: data.working_hours_start, working_hours_end: data.working_hours_end,
        blocked_dates: data.blocked_dates || [], vacation_mode: !!data.vacation_mode,
        max_per_day: parseInt(data.max_per_day) || 3, travel_radius_km: parseInt(data.travel_radius_km) || 15,
        cities: (data.cities || []),
      }) });
      router.back();
    } finally { setSaving(false); }
  };

  if (!data) return <View style={styles.c} />;

  return (
    <SafeAreaView style={styles.c} testID="availability-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={{ width: 40 }}><Feather name="arrow-left" size={22} color={pColors.ink} /></Pressable>
        <Text style={styles.h}>Availability</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: pSpacing.xl, paddingBottom: 140, gap: pSpacing.lg }}>
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sTitle}>Vacation mode</Text>
              <Text style={styles.sSub}>Pause new booking requests</Text>
            </View>
            <Switch value={!!data.vacation_mode} onValueChange={(v) => upd('vacation_mode', v)} trackColor={{ true: pColors.gold, false: pColors.border }} thumbColor={pColors.surface} />
          </View>
        </View>

        <Text style={styles.label}>WORKING DAYS</Text>
        <View style={styles.days}>
          {DAYS.map((d) => (
            <Pressable key={d} onPress={() => toggleDay(d)} style={[styles.day, (data.working_days || []).includes(d) && styles.dayOn]}>
              <Text style={[styles.dayTxt, (data.working_days || []).includes(d) && styles.dayTxtOn]}>{d[0].toUpperCase() + d.slice(1, 3)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: pSpacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>OPENS AT</Text>
            <TextInput value={data.working_hours_start} onChangeText={(v) => upd('working_hours_start', v)} placeholder="09:00" style={styles.input} placeholderTextColor={pColors.inkFaint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>CLOSES AT</Text>
            <TextInput value={data.working_hours_end} onChangeText={(v) => upd('working_hours_end', v)} placeholder="20:00" style={styles.input} placeholderTextColor={pColors.inkFaint} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: pSpacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>MAX BOOKINGS / DAY</Text>
            <TextInput value={String(data.max_per_day || '')} onChangeText={(v) => upd('max_per_day', v)} keyboardType="number-pad" style={styles.input} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>TRAVEL RADIUS (km)</Text>
            <TextInput value={String(data.travel_radius_km || '')} onChangeText={(v) => upd('travel_radius_km', v)} keyboardType="number-pad" style={styles.input} />
          </View>
        </View>

        <View>
          <Text style={styles.label}>CITIES SERVED (comma separated)</Text>
          <TextInput
            value={(data.cities || []).join(', ')}
            onChangeText={(v) => upd('cities', v.split(',').map((s: string) => s.trim()).filter(Boolean))}
            style={styles.input}
            placeholder="Mumbai, Pune, Thane"
            placeholderTextColor={pColors.inkFaint}
          />
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Pressable style={[styles.cta, saving && { opacity: 0.6 }]} disabled={saving} onPress={save} testID="save-availability">
          <Text style={styles.ctaTxt}>{saving ? 'Saving…' : 'Save availability'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: pSpacing.xl, paddingVertical: pSpacing.md },
  h: { ...pType.h2, color: pColors.ink },
  section: { backgroundColor: pColors.surface, borderRadius: pRadii.md, padding: pSpacing.lg, borderWidth: 1, borderColor: pColors.border },
  sTitle: { color: pColors.ink, fontWeight: '700', fontSize: 15 },
  sSub: { color: pColors.inkMuted, fontSize: 12, marginTop: 2 },
  label: { color: pColors.inkMuted, fontSize: 10, letterSpacing: 1.5, fontWeight: '800', marginBottom: 6 },
  days: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  day: { width: 50, height: 44, borderRadius: pRadii.sm, backgroundColor: pColors.surface, borderWidth: 1, borderColor: pColors.border, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: pColors.ink, borderColor: pColors.ink },
  dayTxt: { color: pColors.ink, fontWeight: '700', fontSize: 12 },
  dayTxtOn: { color: pColors.gold },
  input: { backgroundColor: pColors.surface, borderWidth: 1, borderColor: pColors.border, borderRadius: pRadii.md, paddingHorizontal: pSpacing.lg, height: 52, fontSize: 15, color: pColors.ink },
  footer: { padding: pSpacing.xl, paddingTop: pSpacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: pColors.divider, backgroundColor: pColors.bg },
  cta: { backgroundColor: pColors.ink, borderRadius: pRadii.pill, paddingVertical: 18, alignItems: 'center' },
  ctaTxt: { color: pColors.gold, fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
});
