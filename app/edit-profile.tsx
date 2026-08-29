import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pColors, pRadii, pSpacing, pType } from '@/src/theme';
import { partnerApi, updatePartnerUser } from '@/src/api';

export default function EditPartnerProfile() {
  const router = useRouter();
  const [f, setF] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { (async () => { const r = await partnerApi('/partner/me'); setF({ ...r.partner, avatar: r.user?.avatar }); })(); }, []);

  const upd = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        full_name: f.full_name, email: f.email, address: f.address, city: f.city, state: f.state, pincode: f.pincode,
        profile_picture: f.profile_picture, cover_picture: f.cover_picture, tagline: f.tagline, bio: f.bio,
        experience_years: parseInt(f.experience_years) || null,
        languages: typeof f.languages === 'string' ? f.languages.split(',').map((s: string) => s.trim()).filter(Boolean) : f.languages,
        awards: typeof f.awards === 'string' ? f.awards.split(',').map((s: string) => s.trim()).filter(Boolean) : f.awards,
        instagram: f.instagram,
      };
      const p = await partnerApi('/partner/profile', { method: 'PATCH', body: JSON.stringify(payload) });
      const me = await partnerApi('/partner/me');
      await updatePartnerUser(me.user);
      router.back();
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.c} testID="partner-edit-profile">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={{ width: 40 }}><Feather name="arrow-left" size={22} color={pColors.ink} /></Pressable>
        <Text style={styles.h}>Personal details</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: pSpacing.xl, paddingBottom: 140, gap: pSpacing.lg }}>
        <View style={{ alignItems: 'center' }}>
          <Image source={f.profile_picture || 'https://i.pravatar.cc/200'} style={styles.avatar} contentFit="cover" />
          <Text style={{ color: pColors.inkMuted, fontSize: 12, marginTop: 8 }}>Tap to update photo (mocked)</Text>
        </View>
        <Field lbl="FULL NAME" v={f.full_name} onC={(v: any) => upd('full_name', v)} testID="fn" />
        <Field lbl="TAGLINE" v={f.tagline} onC={(v: any) => upd('tagline', v)} placeholder="e.g. Bridal Couture Specialist" />
        <Field lbl="EMAIL" v={f.email} onC={(v: any) => upd('email', v)} kb="email-address" />
        <Field lbl="ADDRESS" v={f.address} onC={(v: any) => upd('address', v)} multi />
        <View style={{ flexDirection: 'row', gap: pSpacing.md }}>
          <View style={{ flex: 1 }}><Field lbl="CITY" v={f.city} onC={(v: any) => upd('city', v)} /></View>
          <View style={{ flex: 1 }}><Field lbl="STATE" v={f.state} onC={(v: any) => upd('state', v)} /></View>
        </View>
        <View style={{ flexDirection: 'row', gap: pSpacing.md }}>
          <View style={{ flex: 1 }}><Field lbl="PINCODE" v={f.pincode} onC={(v: any) => upd('pincode', v)} kb="number-pad" /></View>
          <View style={{ flex: 1 }}><Field lbl="EXPERIENCE (YRS)" v={String(f.experience_years || '')} onC={(v: any) => upd('experience_years', v)} kb="number-pad" /></View>
        </View>
        <Field lbl="BIO" v={f.bio} onC={(v: any) => upd('bio', v)} multi placeholder="Tell customers about yourself" />
        <Field lbl="LANGUAGES (comma sep)" v={Array.isArray(f.languages) ? f.languages.join(', ') : f.languages} onC={(v: any) => upd('languages', v)} />
        <Field lbl="AWARDS (comma sep)" v={Array.isArray(f.awards) ? f.awards.join(', ') : f.awards} onC={(v: any) => upd('awards', v)} />
        <Field lbl="INSTAGRAM" v={f.instagram} onC={(v: any) => upd('instagram', v)} placeholder="@handle" />
      </ScrollView>
      <View style={styles.footer}>
        <Pressable style={[styles.cta, saving && { opacity: 0.6 }]} disabled={saving} onPress={save} testID="save-profile">
          <Text style={styles.ctaTxt}>{saving ? 'Saving…' : 'Save profile'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Field({ lbl, v, onC, multi, kb, placeholder, testID }: any) {
  return (
    <View>
      <Text style={styles.lbl}>{lbl}</Text>
      <TextInput
        testID={testID}
        value={v || ''}
        onChangeText={onC}
        multiline={multi}
        keyboardType={kb || 'default'}
        placeholder={placeholder}
        placeholderTextColor={pColors.inkFaint}
        style={[styles.input, multi && { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: pSpacing.xl, paddingVertical: pSpacing.md },
  h: { ...pType.h2, color: pColors.ink },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: pColors.gold },
  lbl: { color: pColors.inkMuted, fontSize: 10, letterSpacing: 1.5, fontWeight: '800', marginBottom: 6 },
  input: { backgroundColor: pColors.surface, borderWidth: 1, borderColor: pColors.border, borderRadius: pRadii.md, paddingHorizontal: pSpacing.lg, height: 52, fontSize: 15, color: pColors.ink },
  footer: { padding: pSpacing.xl, paddingTop: pSpacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: pColors.divider, backgroundColor: pColors.bg },
  cta: { backgroundColor: pColors.ink, borderRadius: pRadii.pill, paddingVertical: 18, alignItems: 'center' },
  ctaTxt: { color: pColors.gold, fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
});
