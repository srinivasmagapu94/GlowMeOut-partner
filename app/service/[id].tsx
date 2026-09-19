import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pColors, pRadii, pSpacing, pType, SERVICE_CATALOG } from '@/src/theme';
import { authenticatedFetch, loadPartnerProfileId, partnerApi } from '@/src/api';
import { ActivationGate } from '@/src/onboarding-guard';

const MODES = [
  { k: 'fixed', title: 'Fixed price', sub: 'One flat price · quickest to set up', icon: 'tag' },
  { k: 'package', title: 'Packages', sub: 'Silver / Gold / Platinum tiers', icon: 'layers' },
  { k: 'custom', title: 'Custom quote', sub: 'Customer briefs first, you quote later', icon: 'edit-3' },
] as const;

// Some categories only allow a single fixed price (no packages / custom quote).
const FIXED_ONLY_CATEGORIES = new Set(['saree']);
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080/ws_glowmeout_partner_services';

export default function ServiceEditor() {
  return <ActivationGate><ServiceEditorContent /></ActivationGate>;
}

function ServiceEditorContent() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const editing = id && id !== 'new';
  const [mode, setMode] = useState<'fixed' | 'package' | 'custom'>('fixed');
  const [category, setCategory] = useState('bridal');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('60');
  const [fixedPrice, setFixedPrice] = useState('');
  const [startingPrice, setStartingPrice] = useState('');
  const [packages, setPackages] = useState([
    { name: 'Silver', price: '', description: '', included_services: '', duration_min: '60', equipment_included: '' },
    { name: 'Gold', price: '', description: '', included_services: '', duration_min: '120', equipment_included: '' },
    { name: 'Platinum', price: '', description: '', included_services: '', duration_min: '180', equipment_included: '' },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    (async () => {
      // Prefer fetching the single service by UUID from backend for freshest data
      try {
        const res = await authenticatedFetch(`${BASE}/partner/fetchActivePartnerServiceByServiceUUID/${encodeURIComponent(String(id))}`);
        if (res.ok) {
          const s = await res.json();
          const pricingModel = s.pricingModel || {};
          const packagesArr = Array.isArray(pricingModel.packages) ? pricingModel.packages : [];
          const pricingMode = pricingModel.fixedPrice
            ? 'fixed'
            : packagesArr.length
              ? 'package'
              : pricingModel.customQuote
                ? 'custom'
                : 'fixed';

          setMode(pricingMode);
          setCategory(s.serviceType || '');
          setName(s.serviceName || '');
          setDescription(s.serviceDescription || '');
          setDuration(String(pricingModel.fixedPrice?.duration || packagesArr[0]?.packageDuration || 60));
          if (pricingModel.fixedPrice) setFixedPrice(String(pricingModel.fixedPrice.price || ''));
          if (pricingModel.customQuote) setStartingPrice(String(pricingModel.customQuote.startingPrice || ''));
          if (packagesArr.length) {
            setPackages(packagesArr.map((p: any) => ({
              name: p.packageType,
              price: String(p.packagePrice || ''),
              description: p.packageDescription || '',
              included_services: p.includedServices || '',
              duration_min: String(p.packageDuration || 60),
              equipment_included: p.equipmentIncluded || '',
            })));
          }
          return;
        }
      } catch (err) {
        // ignore and fallback to earlier approach
      }

      try {
        const items = await partnerApi('/partner/services');
        const s = items.find((x: any) => x.id === id);
        if (s) {
          setMode(s.pricing_mode); setCategory(s.category); setName(s.name);
          setDescription(s.description || ''); setDuration(String(s.duration_min || 60));
          if (s.fixed_price) setFixedPrice(String(s.fixed_price));
          if (s.custom_starting_price) setStartingPrice(String(s.custom_starting_price));
          if (s.packages) setPackages(s.packages.map((p: any) => ({ ...p, price: String(p.price || ''), duration_min: String(p.duration_min || 60) })));
        }
      } catch {
        // ignore
      }
    })();
  }, [id]);

  const canSave = () => {
    if (!name.trim() || !category) return false;
    if (mode === 'fixed') return !!parseInt(fixedPrice);
    if (mode === 'custom') return !!parseInt(startingPrice);
    if (mode === 'package') return packages.some((p) => !!parseInt(p.price));
    return false;
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        const pricingModel: any = {
          fixedPrice: mode === 'fixed' ? { price: String(fixedPrice).trim(), duration: String(duration).trim() } : null,
          packages: mode === 'package'
            ? packages
              .filter((p) => p.price.trim())
              .map((p) => ({
                packageType: p.name,
                packagePrice: p.price.trim(),
                packageDuration: p.duration_min.trim(),
                packageDescription: p.description.trim(),
                includedServices: p.included_services.trim(),
                equipmentIncluded: p.equipment_included.trim(),
              }))
            : [],
          customQuote: mode === 'custom' ? { startingPrice: startingPrice.trim() } : null,
        };

        const payload: any = {
          serviceType: category,
          serviceName: name.trim(),
          serviceDescription: description.trim(),
          pricingModel,
        };

        await partnerApi(`/partner/services/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        const partnerUUID = await loadPartnerProfileId();
        if (!partnerUUID) throw new Error('Partner profile ID not found.');

        const pricingModel = {
          fixedPrice: mode === 'fixed'
            ? { price: fixedPrice.trim(), duration: duration.trim() }
            : null,
          packages: mode === 'package'
            ? packages
              .filter((p) => p.price.trim())
              .map((p) => ({
                packageType: p.name,
                packagePrice: p.price.trim(),
                packageDuration: p.duration_min.trim(),
                packageDescription: p.description.trim(),
                includedServices: p.included_services.trim(),
                equipmentIncluded: p.equipment_included.trim(),
              }))
            : [],
          customQuote: mode === 'custom'
            ? { startingPrice: startingPrice.trim() }
            : null,
        };

        const response = await authenticatedFetch(
          `${BASE}/partner/createPartnerServices`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              partnerUUID,
              serviceType: category,
              serviceName: name.trim(),
              serviceDescription: description.trim(),
              pricingModel,
            }),
          },
        );

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || 'Service creation failed');
        }

        const servicesResponse = await authenticatedFetch(`${BASE}/partner/fetchActivePartnerServices`);
        if (!servicesResponse.ok) {
          const text = await servicesResponse.text();
          throw new Error(text || 'Unable to refresh services');
        }
      }
      router.replace('/(tabs)/services');
    } finally { setSaving(false); }
  };

  const del = async () => {
    if (!editing) return;
    try {
      const res = await authenticatedFetch(`${BASE}/partner/deactivatePartnerService/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      router.back();
    } catch (error: any) {
      Alert.alert('Delete failed', error?.message || 'Unable to delete service.');
    }
  };

  return (
    <SafeAreaView style={styles.c} testID="service-editor">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={{ width: 40 }}><Feather name="arrow-left" size={22} color={pColors.ink} /></Pressable>
        <Text style={styles.hTitle}>{editing ? 'Edit service' : 'New service'}</Text>
        {editing ? (
          <Pressable onPress={del} style={{ width: 40, alignItems: 'flex-end' }} testID="delete-service"><Feather name="trash-2" size={18} color={pColors.error} /></Pressable>
        ) : <View style={{ width: 40 }} />}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: pSpacing.xl, paddingBottom: 140, gap: pSpacing.lg }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>SERVICE TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: pSpacing.md }}>
            {SERVICE_CATALOG.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => {
                  setCategory(s.id);
                  if (FIXED_ONLY_CATEGORIES.has(s.id)) setMode('fixed');
                }}
                style={[styles.chip, category === s.id && styles.chipOn]}
                testID={`svc-cat-${s.id}`}
              >
                <Text style={[styles.chipTxt, category === s.id && styles.chipTxtOn]}>{s.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View>
            <Text style={styles.label}>SERVICE NAME</Text>
            <TextInput testID="svc-name" value={name} onChangeText={setName} placeholder="e.g. Premium Bridal Package" placeholderTextColor={pColors.inkFaint} style={styles.input} />
          </View>
          <View>
            <Text style={styles.label}>DESCRIPTION</Text>
            <TextInput testID="svc-desc" value={description} onChangeText={setDescription} multiline placeholder="What's included…" placeholderTextColor={pColors.inkFaint} style={[styles.input, { minHeight: 70, textAlignVertical: 'top', paddingTop: 12 }]} />
          </View>

          <Text style={styles.label}>PRICING MODEL</Text>
          {FIXED_ONLY_CATEGORIES.has(category) && (
            <View style={styles.info}>
              <Feather name="info" size={14} color={pColors.goldDeep} />
              <Text style={styles.infoTxt}>This service is offered at a single fixed price only.</Text>
            </View>
          )}
          <View style={{ gap: pSpacing.sm }}>
            {MODES
              .filter((m) => !FIXED_ONLY_CATEGORIES.has(category) || m.k === 'fixed')
              .map((m) => (
                <Pressable key={m.k} onPress={() => setMode(m.k)} style={[styles.modeCard, mode === m.k && styles.modeCardOn]} testID={`mode-${m.k}`}>
                  <View style={styles.modeIcon}><Feather name={m.icon as any} size={16} color={pColors.goldDeep} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modeTitle}>{m.title}</Text>
                    <Text style={styles.modeSub}>{m.sub}</Text>
                  </View>
                  {mode === m.k && <Feather name="check-circle" size={20} color={pColors.gold} />}
                </Pressable>
              ))}
          </View>

          {mode === 'fixed' && (
            <View>
              <Text style={styles.label}>PRICE (₹)</Text>
              <TextInput testID="fixed-price" value={fixedPrice} onChangeText={setFixedPrice} keyboardType="number-pad" placeholder="2500" placeholderTextColor={pColors.inkFaint} style={styles.input} />
              <Text style={styles.label}>DURATION (minutes)</Text>
              <TextInput testID="duration" value={duration} onChangeText={setDuration} keyboardType="number-pad" style={styles.input} />
            </View>
          )}

          {mode === 'custom' && (
            <View>
              <Text style={styles.label}>STARTING PRICE (₹)</Text>
              <TextInput testID="custom-start" value={startingPrice} onChangeText={setStartingPrice} keyboardType="number-pad" placeholder="12000" placeholderTextColor={pColors.inkFaint} style={styles.input} />
              <View style={styles.info}>
                <Feather name="info" size={14} color={pColors.goldDeep} />
                <Text style={styles.infoTxt}>Customers first answer a questionnaire, then you send a final quote.</Text>
              </View>
            </View>
          )}

          {mode === 'package' && !FIXED_ONLY_CATEGORIES.has(category) && (
            <View style={{ gap: pSpacing.md }}>
              {packages.map((p, i) => (
                <View key={i} style={styles.pkg}>
                  <View style={styles.pkgHead}>
                    <Text style={styles.pkgTitle}>{p.name}</Text>
                    <Text style={styles.pkgHint}>Tier {i + 1}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: pSpacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.miniLbl}>Price (₹)</Text>
                      <TextInput testID={`pkg-${i}-price`} value={p.price} onChangeText={(v) => { const c = [...packages]; c[i].price = v; setPackages(c); }} keyboardType="number-pad" style={styles.miniInput} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.miniLbl}>Duration (min)</Text>
                      <TextInput value={p.duration_min} onChangeText={(v) => { const c = [...packages]; c[i].duration_min = v; setPackages(c); }} keyboardType="number-pad" style={styles.miniInput} />
                    </View>
                  </View>
                  <Text style={styles.miniLbl}>Description</Text>
                  <TextInput value={p.description} onChangeText={(v) => { const c = [...packages]; c[i].description = v; setPackages(c); }} style={styles.miniInput} placeholder="What's in this tier" placeholderTextColor={pColors.inkFaint} />
                  <Text style={styles.miniLbl}>Included services (comma separated)</Text>
                  <TextInput value={p.included_services} onChangeText={(v) => { const c = [...packages]; c[i].included_services = v; setPackages(c); }} style={styles.miniInput} placeholder="Makeup, hair, saree draping" placeholderTextColor={pColors.inkFaint} />
                  <Text style={styles.miniLbl}>Equipment included</Text>
                  <TextInput value={p.equipment_included} onChangeText={(v) => { const c = [...packages]; c[i].equipment_included = v; setPackages(c); }} style={styles.miniInput} placeholder="Airbrush kit, professional lighting" placeholderTextColor={pColors.inkFaint} />
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={[styles.cta, (!canSave() || saving) && { opacity: 0.5 }]} disabled={!canSave() || saving} onPress={save} testID="save-service">
            <Text style={styles.ctaTxt}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Publish service'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: pSpacing.xl, paddingVertical: pSpacing.md },
  hTitle: { ...pType.h2, color: pColors.ink },
  label: { color: pColors.inkMuted, fontSize: 10, letterSpacing: 1.5, fontWeight: '800', marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: pColors.surface, borderWidth: 1, borderColor: pColors.border, borderRadius: pRadii.md, paddingHorizontal: pSpacing.lg, height: 52, fontSize: 15, color: pColors.ink, marginBottom: 6 },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: pRadii.pill, borderWidth: 1, borderColor: pColors.border, backgroundColor: pColors.surface, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: pColors.ink, borderColor: pColors.ink },
  chipTxt: { color: pColors.ink, fontSize: 12, fontWeight: '700' },
  chipTxtOn: { color: pColors.gold },
  modeCard: { flexDirection: 'row', alignItems: 'center', gap: pSpacing.md, backgroundColor: pColors.surface, borderWidth: 1, borderColor: pColors.border, borderRadius: pRadii.md, padding: pSpacing.md },
  modeCardOn: { borderColor: pColors.gold, borderWidth: 2, backgroundColor: '#FFFDF6' },
  modeIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: pColors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  modeTitle: { color: pColors.ink, fontWeight: '700', fontSize: 14 },
  modeSub: { color: pColors.inkMuted, fontSize: 12, marginTop: 2 },
  info: { flexDirection: 'row', gap: 6, marginTop: pSpacing.md, padding: pSpacing.md, borderRadius: pRadii.sm, backgroundColor: pColors.goldSoft },
  infoTxt: { color: pColors.goldDeep, fontSize: 12, flex: 1 },
  pkg: { backgroundColor: pColors.surface, borderRadius: pRadii.md, padding: pSpacing.md, borderWidth: 1, borderColor: pColors.border, gap: 4 },
  pkgHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  pkgTitle: { color: pColors.ink, fontWeight: '800', fontSize: 15 },
  pkgHint: { color: pColors.goldDeep, fontSize: 10, letterSpacing: 1, fontWeight: '800' },
  miniLbl: { color: pColors.inkMuted, fontSize: 9, letterSpacing: 1, fontWeight: '700', marginTop: 6 },
  miniInput: { backgroundColor: pColors.bg, borderRadius: pRadii.sm, paddingHorizontal: pSpacing.md, height: 42, fontSize: 14, color: pColors.ink, borderWidth: 1, borderColor: pColors.border, marginTop: 4 },
  addPkg: { flexDirection: 'row', gap: 6, alignSelf: 'flex-start', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: pRadii.pill, backgroundColor: pColors.gold },
  addPkgTxt: { color: pColors.ink, fontWeight: '700', fontSize: 12 },
  footer: { padding: pSpacing.xl, paddingTop: pSpacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: pColors.divider, backgroundColor: pColors.bg },
  cta: { backgroundColor: pColors.ink, borderRadius: pRadii.pill, paddingVertical: 18, alignItems: 'center' },
  ctaTxt: { color: pColors.gold, fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
});
