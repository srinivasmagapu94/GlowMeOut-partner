import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pColors, pRadii, pSpacing, pType, inr } from '@/src/theme';
import { partnerApi } from '@/src/api';

const SUGGESTIONS = ['Hair Styling', 'Saree Draping', 'Hair Extensions', 'Touch Up', 'False Lashes', 'Trial Makeup', 'Travel Charges', 'Extra Person'];

export default function Addons() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [desc, setDesc] = useState('');

  const load = useCallback(async () => setItems(await partnerApi('/addons')), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    if (!name.trim() || !parseInt(price)) return;
    await partnerApi('/addons', { method: 'POST', body: JSON.stringify({ name, price: parseInt(price), description: desc }) });
    setOpen(false); setName(''); setPrice(''); setDesc('');
    load();
  };

  return (
    <SafeAreaView style={styles.c} testID="addons-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={{ width: 40 }}><Feather name="arrow-left" size={22} color={pColors.ink} /></Pressable>
        <Text style={styles.h}>Add-ons</Text>
        <Pressable style={styles.addBtn} onPress={() => setOpen(true)} testID="new-addon"><Feather name="plus" size={16} color={pColors.ink} /></Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: pSpacing.xl, gap: pSpacing.md }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.n}>{item.name}</Text>
              {!!item.description && <Text style={styles.d}>{item.description}</Text>}
            </View>
            <Text style={styles.p}>{inr(item.price)}</Text>
            <Pressable onPress={async () => { await partnerApi(`/partner/addons/${item.id}`, { method: 'DELETE' }); load(); }} style={{ marginLeft: 8 }}><Feather name="trash-2" size={16} color={pColors.error} /></Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View>
            <Text style={styles.hint}>Add-ons let customers boost their booking. Popular examples:</Text>
            <View style={styles.suggWrap}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} onPress={() => { setName(s); setOpen(true); }} style={styles.suggChip}>
                  <Feather name="plus" size={12} color={pColors.ink} />
                  <Text style={styles.suggTxt}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
      />

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.mBg}>
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <Text style={styles.mH}>New add-on</Text>
            <TextInput placeholder="Name (e.g. Trial Makeup)" placeholderTextColor={pColors.inkFaint} value={name} onChangeText={setName} style={styles.input} testID="addon-name" />
            <TextInput placeholder="Price (₹)" placeholderTextColor={pColors.inkFaint} value={price} onChangeText={setPrice} keyboardType="number-pad" style={styles.input} testID="addon-price" />
            <TextInput placeholder="Description (optional)" placeholderTextColor={pColors.inkFaint} value={desc} onChangeText={setDesc} multiline style={[styles.input, { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }]} />
            <View style={{ flexDirection: 'row', gap: pSpacing.md, marginTop: pSpacing.md }}>
              <Pressable style={styles.cancelBtn} onPress={() => setOpen(false)}><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
              <Pressable style={styles.saveBtn} onPress={create} testID="save-addon"><Text style={styles.saveTxt}>Add</Text></Pressable>
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
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: pColors.surface, borderRadius: pRadii.md, borderWidth: 1, borderColor: pColors.border, padding: pSpacing.lg },
  n: { color: pColors.ink, fontWeight: '700', fontSize: 15 },
  d: { color: pColors.inkMuted, fontSize: 12, marginTop: 2 },
  p: { color: pColors.ink, fontWeight: '800', fontSize: 15 },
  hint: { color: pColors.inkMuted, fontSize: 13, textAlign: 'center', marginTop: pSpacing.xl },
  suggWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: pSpacing.md, justifyContent: 'center' },
  suggChip: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: pRadii.pill, backgroundColor: pColors.surface, borderWidth: 1, borderColor: pColors.border },
  suggTxt: { color: pColors.ink, fontSize: 12, fontWeight: '600' },
  mBg: { flex: 1, backgroundColor: pColors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: pColors.bg, borderTopLeftRadius: pRadii.xl, borderTopRightRadius: pRadii.xl, padding: pSpacing.xl, paddingBottom: pSpacing.xxl },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: pColors.border, alignSelf: 'center', marginBottom: pSpacing.lg },
  mH: { color: pColors.ink, ...pType.h2, marginBottom: pSpacing.md },
  input: { backgroundColor: pColors.surface, borderWidth: 1, borderColor: pColors.border, borderRadius: pRadii.md, paddingHorizontal: pSpacing.lg, height: 52, fontSize: 15, color: pColors.ink, marginBottom: pSpacing.sm },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: pRadii.pill, backgroundColor: pColors.surface, borderWidth: 1, borderColor: pColors.border },
  cancelTxt: { color: pColors.ink, fontWeight: '700' },
  saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: pRadii.pill, backgroundColor: pColors.ink },
  saveTxt: { color: pColors.gold, fontWeight: '700' },
});
