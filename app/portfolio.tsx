import { View, Text, StyleSheet, FlatList, Pressable, Dimensions, Modal, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pColors, pRadii, pSpacing, pType } from '@/src/theme';
import { partnerApi } from '@/src/api';

const { width } = Dimensions.get('window');
const size = (width - pSpacing.xl * 2 - 8) / 2;

const SUGGEST_IMAGES = [
  'https://images.unsplash.com/photo-1595475207225-428b62bda831?w=800&q=80',
  'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&q=80',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80',
  'https://images.unsplash.com/photo-1512316609839-ce289d3eba0a?w=800&q=80',
  'https://images.unsplash.com/photo-1512257151-5c1f61cb1eb6?w=800&q=80',
  'https://images.unsplash.com/photo-1610173827043-9db50e0d8ef9?w=800&q=80',
];

export default function Portfolio() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const load = useCallback(async () => setItems(await partnerApi('/portfolio')), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async (imgUrl: string) => {
    await partnerApi('/portfolio', { method: 'POST', body: JSON.stringify({ type: 'image', url: imgUrl }) });
    setUrl(''); setOpen(false);
    load();
  };

  return (
    <SafeAreaView style={styles.c} testID="partner-portfolio">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={{ width: 40 }}><Feather name="arrow-left" size={22} color={pColors.ink} /></Pressable>
        <Text style={styles.h}>Portfolio</Text>
        <Pressable style={styles.addBtn} onPress={() => setOpen(true)} testID="add-portfolio"><Feather name="plus" size={16} color={pColors.ink} /></Pressable>
      </View>
      <FlatList
        data={items}
        numColumns={2}
        keyExtractor={(i) => i.id}
        columnWrapperStyle={{ gap: 8 }}
        contentContainerStyle={{ padding: pSpacing.xl, gap: 8 }}
        renderItem={({ item }) => (
          <View style={styles.tile}>
            <Image source={item.url} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            <Pressable style={styles.delX} onPress={async () => { await partnerApi(`/partner/portfolio/${item.id}`, { method: 'DELETE' }); load(); }}>
              <Feather name="x" size={14} color={pColors.surface} />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="image" size={36} color={pColors.inkFaint} />
            <Text style={styles.emptyTitle}>Showcase your best work</Text>
            <Text style={styles.emptySub}>Upload before/after photos, videos, and event highlights.</Text>
          </View>
        }
      />
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.mBg}>
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <Text style={styles.mH}>Add to portfolio</Text>
            <Text style={styles.mSub}>Pick from suggestions below or paste your own image URL.</Text>
            <View style={styles.sugRow}>
              {SUGGEST_IMAGES.map((u) => (
                <Pressable key={u} onPress={() => add(u)} style={styles.sugTile}>
                  <Image source={u} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                </Pressable>
              ))}
            </View>
            <Text style={styles.divTxt}>Or paste an image URL</Text>
            <TextInput placeholder="https://..." placeholderTextColor={pColors.inkFaint} value={url} onChangeText={setUrl} style={styles.input} autoCapitalize="none" testID="portfolio-url" />
            <View style={{ flexDirection: 'row', gap: pSpacing.md, marginTop: pSpacing.md }}>
              <Pressable style={styles.cancelBtn} onPress={() => setOpen(false)}><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
              <Pressable style={[styles.saveBtn, !url && { opacity: 0.5 }]} disabled={!url} onPress={() => url && add(url)}><Text style={styles.saveTxt}>Add</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: pSpacing.xl, paddingVertical: pSpacing.md },
  h: { ...pType.h2, color: pColors.ink },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: pColors.gold, alignItems: 'center', justifyContent: 'center' },
  tile: { width: size, height: size, borderRadius: pRadii.md, overflow: 'hidden', position: 'relative' },
  delX: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(15,17,20,0.7)', alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', padding: pSpacing.xxl, backgroundColor: pColors.surface, borderRadius: pRadii.md, borderWidth: 1, borderColor: pColors.border, margin: pSpacing.xl },
  emptyTitle: { color: pColors.ink, ...pType.h3, marginTop: pSpacing.md },
  emptySub: { color: pColors.inkMuted, marginTop: 4, textAlign: 'center', fontSize: 13 },
  mBg: { flex: 1, backgroundColor: pColors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: pColors.bg, borderTopLeftRadius: pRadii.xl, borderTopRightRadius: pRadii.xl, padding: pSpacing.xl, paddingBottom: pSpacing.xxl },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: pColors.border, alignSelf: 'center', marginBottom: pSpacing.lg },
  mH: { color: pColors.ink, ...pType.h2 },
  mSub: { color: pColors.inkMuted, fontSize: 13, marginTop: 4 },
  sugRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: pSpacing.lg },
  sugTile: { width: (width - pSpacing.xl * 2 - 16) / 3, height: 90, borderRadius: pRadii.sm, overflow: 'hidden' },
  divTxt: { color: pColors.inkMuted, fontSize: 12, marginTop: pSpacing.lg, marginBottom: 6 },
  input: { backgroundColor: pColors.surface, borderWidth: 1, borderColor: pColors.border, borderRadius: pRadii.md, paddingHorizontal: pSpacing.lg, height: 52, fontSize: 14, color: pColors.ink },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: pRadii.pill, backgroundColor: pColors.surface, borderWidth: 1, borderColor: pColors.border },
  cancelTxt: { color: pColors.ink, fontWeight: '700' },
  saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: pRadii.pill, backgroundColor: pColors.ink },
  saveTxt: { color: pColors.gold, fontWeight: '700' },
});
