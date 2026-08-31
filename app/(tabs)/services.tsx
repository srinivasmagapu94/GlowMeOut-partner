import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, Alert, Modal } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pColors, pRadii, pSpacing, pType, inr, SERVICE_CATALOG, serviceRequiresCertificate } from '@/src/theme';
import { loadPartnerProfileId, partnerApi } from '@/src/api';

const BASE = 'http://localhost:8080/ws_glowmeout_partner_services';

const MODE_LABEL: Record<string, string> = {
  fixed: 'Fixed price',
  package: 'Packages',
  custom: 'Custom quote',
};

export default function Services() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [certificateStatus, setCertificateStatus] = useState('not_uploaded');
  const [dialogVisible, setDialogVisible] = useState(false);
  const [selectedLockedService, setSelectedLockedService] = useState<any | null>(null);

  const load = useCallback(async () => {
    try {
      const [services, profile] = await Promise.all([
        partnerApi('/partner/services'),
        partnerApi('/partner/me').catch(() => null),
      ]);
      setItems(Array.isArray(services) ? services : []);
      const status = (profile?.partner?.certificate_status || profile?.partner?.certificateStatus || 'not_uploaded').toLowerCase();
      setCertificateStatus(status);
    } catch {
      setItems([]);
      setCertificateStatus('not_uploaded');
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const isApproved = certificateStatus === 'approved';

  const getServiceMeta = useCallback((service: any) => {
    const key = service?.category || service?.serviceType || service?.service_type || service?.type || service?.name;
    if (!key) return null;
    const match = SERVICE_CATALOG.find((s) => s.id === key || s.name.toLowerCase() === String(key).toLowerCase());
    return match || null;
  }, []);

  const handleLockedTap = (service: any) => {
    const meta = getServiceMeta(service);
    if (!meta || !serviceRequiresCertificate(meta.id) || isApproved) {
      router.push({ pathname: '/service/[id]', params: { id: service.id } });
      return;
    }
    setSelectedLockedService(service);
    setDialogVisible(true);
  };

  const uploadCertificate = async () => {
    try {
      const partnerUUID = await loadPartnerProfileId();
      if (!partnerUUID) {
        Alert.alert('Profile not found', 'Save your profile before uploading a certificate.');
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const name = (asset.name || 'certificate.pdf').toLowerCase();
      const mimeType = (asset.mimeType || 'application/pdf').toLowerCase();
      const validExt = name.endsWith('.pdf') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg');
      const validMime = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'].includes(mimeType);
      const sizeOk = (asset.size ?? 0) <= 5 * 1024 * 1024;

      if (!validExt && !validMime) {
        Alert.alert('Invalid file', 'Please choose a PDF, PNG, JPG, or JPEG certificate.');
        return;
      }
      if (!sizeOk) {
        Alert.alert('File too large', 'Certificate must be 5 MB or less.');
        return;
      }

      const formData = new FormData();
      if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
        formData.append('certificate', {
          uri: asset.uri,
          name: asset.name || 'certificate.pdf',
          type: asset.mimeType || 'application/pdf',
        } as any);
      } else {
        const blobResponse = await fetch(asset.uri);
        const blob = await blobResponse.blob();
        const file = new File([blob], asset.name || 'certificate.pdf', { type: asset.mimeType || 'application/pdf' });
        formData.append('certificate', file);
      }

      const response = await fetch(`${BASE}/partner/${partnerUUID}/uploadCertificate`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Unable to upload certificate');
      }

      setCertificateStatus('pending');
      setDialogVisible(false);
      Alert.alert('Certificate uploaded', 'Your certificate is under verification. Makeup services remain locked until approved.');
    } catch (error: any) {
      Alert.alert('Upload failed', error?.message || 'Unable to upload certificate.');
    }
  };

  const priceLabel = (s: any) => {
    if (s.pricing_mode === 'fixed') return inr(s.fixed_price || 0);
    if (s.pricing_mode === 'custom') return `From ${inr(s.custom_starting_price || 0)}`;
    if (s.pricing_mode === 'package') {
      const prices = (s.packages || []).map((p: any) => p.price).filter(Boolean);
      return prices.length ? `From ${inr(Math.min(...prices))}` : '—';
    }
    return '—';
  };

  const headerMeta = useMemo(() => {
    if (certificateStatus === 'approved') return 'Certificate approved';
    if (certificateStatus === 'pending') return 'Verification pending';
    if (certificateStatus === 'rejected') return 'Certificate rejected';
    return 'Certificate required for Makeup';
  }, [certificateStatus]);

  return (
    <View style={styles.c} testID="partner-services">
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.title}>Services</Text>
          <Pressable style={styles.addBtn} onPress={() => router.push('/service/new')} testID="add-service-btn">
            <Feather name="plus" size={16} color={pColors.ink} />
            <Text style={styles.addTxt}>Add</Text>
          </Pressable>
        </View>
        <Text style={styles.sub}>Configure your offerings with fixed price, package tiers, or custom quotes.</Text>
        <View style={styles.statusPill}><Text style={styles.statusTxt}>{headerMeta}</Text></View>
      </SafeAreaView>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={pColors.gold} />}
        contentContainerStyle={{ padding: pSpacing.xl, gap: pSpacing.md, paddingBottom: 120 }}
        renderItem={({ item }) => {
          const serviceMeta = getServiceMeta(item);
          const locked = !!serviceMeta && serviceRequiresCertificate(serviceMeta.id) && !isApproved;
          return (
            <Pressable style={[styles.card, locked && styles.cardLocked]} onPress={() => handleLockedTap(item)}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.icon, locked && styles.iconLocked]}><Feather name={(serviceMeta?.icon as any) || 'star'} size={18} color={locked ? pColors.goldDeep : pColors.goldDeep} /></View>
                <View style={{ flex: 1, marginLeft: pSpacing.md }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <View style={styles.metaRow}>
                    <View style={styles.modeChip}><Text style={styles.modeTxt}>{MODE_LABEL[item.pricing_mode] || item.pricing_mode}</Text></View>
                    <Text style={styles.dur}>· {item.duration_min || 60} min</Text>
                  </View>
                  {locked && <View style={styles.lockRow}><Feather name="lock" size={12} color={pColors.goldDeep} /><Text style={styles.lockTxt}>Certificate required</Text></View>}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.price}>{priceLabel(item)}</Text>
                  <Feather name={locked ? 'lock' : 'chevron-right'} size={16} color={locked ? pColors.goldDeep : pColors.inkFaint} style={{ marginTop: 4 }} />
                </View>
              </View>
              {item.pricing_mode === 'package' && (item.packages || []).length > 0 && (
                <View style={styles.pkgRow}>
                  {(item.packages as any[]).map((p, i) => (
                    <View key={i} style={styles.pkgChip}>
                      <Text style={styles.pkgName}>{p.name}</Text>
                      <Text style={styles.pkgPrice}>{inr(p.price)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="layers" size={36} color={pColors.inkFaint} />
            <Text style={styles.emptyTitle}>No services yet</Text>
            <Text style={styles.emptySub}>Add your first service to start receiving bookings.</Text>
            <Pressable style={styles.emptyBtn} onPress={() => router.push('/service/new')}>
              <Text style={styles.emptyBtnTxt}>Add a service</Text>
            </Pressable>
          </View>
        }
      />

      <Modal visible={dialogVisible} transparent animationType="fade" onRequestClose={() => setDialogVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDialogVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalIcon}><Feather name="lock" size={22} color={pColors.goldDeep} /></View>
            <Text style={styles.modalTitle}>Certificate Required</Text>
            <Text style={styles.modalText}>Upload your professional certificate to unlock this Makeup service.</Text>
            <Pressable style={styles.modalPrimary} onPress={uploadCertificate}>
              <Text style={styles.modalPrimaryTxt}>Upload Certificate</Text>
            </Pressable>
            <Pressable style={styles.modalSecondary} onPress={() => setDialogVisible(false)}>
              <Text style={styles.modalSecondaryTxt}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.bg },
  header: { paddingHorizontal: pSpacing.xl, paddingBottom: pSpacing.md },
  title: { color: pColors.ink, ...pType.display, marginTop: pSpacing.sm },
  sub: { color: pColors.inkMuted, marginTop: 4, fontSize: 13 },
  statusPill: { alignSelf: 'flex-start', marginTop: 10, backgroundColor: pColors.goldSoft, borderWidth: 1, borderColor: pColors.gold, borderRadius: pRadii.pill, paddingHorizontal: 10, paddingVertical: 6 },
  statusTxt: { color: pColors.goldDeep, fontSize: 11, fontWeight: '800' },
  addBtn: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: pColors.gold, paddingHorizontal: 14, paddingVertical: 8, borderRadius: pRadii.pill },
  addTxt: { color: pColors.ink, fontWeight: '800', fontSize: 12 },
  card: { backgroundColor: pColors.surface, borderRadius: pRadii.md, borderWidth: 1, borderColor: pColors.border, padding: pSpacing.lg },
  cardLocked: { borderColor: pColors.gold, backgroundColor: '#FFFDF6' },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: pColors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  iconLocked: { backgroundColor: '#F7EAD2' },
  name: { color: pColors.ink, fontWeight: '700', fontSize: 15 },
  metaRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 6 },
  modeChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: pRadii.pill, backgroundColor: pColors.ink },
  modeTxt: { color: pColors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  dur: { color: pColors.inkMuted, fontSize: 11 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  lockTxt: { color: pColors.goldDeep, fontSize: 11, fontWeight: '700' },
  price: { color: pColors.ink, fontWeight: '800', fontSize: 15 },
  pkgRow: { flexDirection: 'row', gap: 6, marginTop: pSpacing.md, flexWrap: 'wrap' },
  pkgChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: pRadii.sm, backgroundColor: pColors.surfaceMuted, flexDirection: 'row', gap: 6 },
  pkgName: { color: pColors.ink, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  pkgPrice: { color: pColors.goldDeep, fontSize: 11, fontWeight: '800' },
  empty: { alignItems: 'center', padding: pSpacing.xxl, backgroundColor: pColors.surface, borderRadius: pRadii.md, borderWidth: 1, borderColor: pColors.border },
  emptyTitle: { color: pColors.ink, ...pType.h3, marginTop: pSpacing.md },
  emptySub: { color: pColors.inkMuted, marginTop: 4, textAlign: 'center', fontSize: 13 },
  emptyBtn: { marginTop: pSpacing.lg, backgroundColor: pColors.ink, paddingHorizontal: pSpacing.xl, paddingVertical: 12, borderRadius: pRadii.pill },
  emptyBtnTxt: { color: pColors.gold, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.42)', justifyContent: 'center', padding: pSpacing.xl },
  modalCard: { backgroundColor: pColors.surface, borderRadius: pRadii.lg, padding: pSpacing.xl, borderWidth: 1, borderColor: pColors.border, alignItems: 'center' },
  modalIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: pColors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { color: pColors.ink, fontWeight: '800', fontSize: 20, marginTop: pSpacing.md },
  modalText: { color: pColors.inkMuted, fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  modalPrimary: { width: '100%', marginTop: pSpacing.lg, backgroundColor: pColors.gold, borderRadius: pRadii.pill, paddingVertical: 14, alignItems: 'center' },
  modalPrimaryTxt: { color: pColors.ink, fontWeight: '800' },
  modalSecondary: { width: '100%', marginTop: pSpacing.sm, borderRadius: pRadii.pill, borderWidth: 1, borderColor: pColors.border, paddingVertical: 12, alignItems: 'center' },
  modalSecondaryTxt: { color: pColors.ink, fontWeight: '700' },
});
