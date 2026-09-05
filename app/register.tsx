import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Alert, BackHandler, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pColors, pRadii, pSpacing, pType, SERVICE_CATALOG } from '@/src/theme';
import { authenticatedFetch, loadPartnerPhone, loadPartnerProfileId, savePartnerProfileId } from '@/src/api';

const BASE = 'http://localhost:8080/ws_glowmeout_partner_services/partner';

const SAMPLE_AVATAR = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80';
const MAX_CERTIFICATE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_CERTIFICATE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

const STEPS = ['Personal', 'Services', 'Certificates', 'KYC', 'Bank details', 'Review'];

const isValidAadhaar = (value: string) => /^\d{12}$/.test(value);
const isValidPan = (value: string) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(value);
const normalizeAccountNumber = (value: string) => (value || '').replace(/[\s-]/g, '').trim();
const isValidIfsc = (value: string) => /^[A-Z]{4}0[A-Z0-9]{6}$/i.test((value || '').trim().toUpperCase());
const isValidBankAccountNumber = (value: string) => /^\d{9,18}$/.test(normalizeAccountNumber(value));

const buildMultipartFile = async (document: { name: string; uri: string; type?: string }) => {
  if (Platform.OS === 'web') {
    const blobResponse = await fetch(document.uri);
    const blob = await blobResponse.blob();
    return new File([blob], document.name || 'bank-document.pdf', {
      type: document.type || 'application/pdf',
    });
  }

  return {
    uri: document.uri,
    name: document.name || 'bank-document.pdf',
    type: document.type || 'application/pdf',
  } as any;
};

export default function PartnerRegister() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => true;
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, []),
  );

  // step 1
  const [profilePicture] = useState<string>(SAMPLE_AVATAR);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');
  // step 2
  const [selected, setSelected] = useState<string[]>([]);
  // step 3
  const [certs, setCerts] = useState<{ name: string; institute: string; issue_date: string; comment: string }[]>([]);
  // step 4
  const [kycType, setKycType] = useState<'aadhaar' | 'pan'>('aadhaar');
  const [kycNumber, setKycNumber] = useState('123456');
  const [kycDocument, setKycDocument] = useState<{ name: string; uri: string; type?: string } | null>(null);
  const [certificateFile, setCertificateFile] = useState<{ name: string; uri: string; type?: string } | null>(null);
  // step 5
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccount, setConfirmAccount] = useState('');
  const [upi, setUpi] = useState('');
  const [passbookDocument, setPassbookDocument] = useState<{ name: string; uri: string; type?: string } | null>(null);
  const [passbookStatus, setPassbookStatus] = useState<'uploadDisabled' | 'uploadEnabled' | 'uploading' | 'processing' | 'verified' | 'mismatch' | 'unreadable'>('uploadDisabled');

  const bankFormValid = Boolean(
    bankName.trim() &&
    accountHolder.trim() &&
    isValidIfsc(ifsc) &&
    isValidBankAccountNumber(accountNumber) &&
    normalizeAccountNumber(accountNumber) === normalizeAccountNumber(confirmAccount),
  );

  useEffect(() => {
    if (passbookStatus === 'uploading' || passbookStatus === 'processing') return;
    if (!bankFormValid) {
      setPassbookStatus('uploadDisabled');
      return;
    }
    if (passbookStatus === 'uploadDisabled' || passbookStatus === 'uploadEnabled') {
      setPassbookStatus('uploadEnabled');
    }
  }, [bankFormValid, passbookStatus]);

  const canNext = () => {
    if (step === 0) return fullName.trim() && email.trim() && address.trim() && city.trim() && stateName.trim() && pincode.length === 6;
    if (step === 1) return selected.length > 0;
    if (step === 2) return true;
    if (step === 3) return !!kycDocument && ((kycType === 'aadhaar' && isValidAadhaar(kycNumber)) || (kycType === 'pan' && isValidPan(kycNumber)));
    if (step === 4) return bankFormValid && !!passbookDocument && !saving;
    return true;
  };

  const validateCertificateAsset = (asset: { name?: string; mimeType?: string; size?: number }) => {
    const name = (asset.name || '').toLowerCase();
    const mimeType = (asset.mimeType || '').toLowerCase();
    const isAllowedExtension = name.endsWith('.pdf') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg');
    const isAllowedMimeType = ALLOWED_CERTIFICATE_TYPES.includes(mimeType);
    const isWithinSizeLimit = (asset.size ?? 0) <= MAX_CERTIFICATE_SIZE_BYTES;

    if (!isAllowedExtension && !isAllowedMimeType) {
      throw new Error('Certificate must be a PDF, PNG, JPG, or JPEG file.');
    }

    if (!isWithinSizeLimit) {
      throw new Error('Certificate size must be 5 MB or less.');
    }
  };

  const toggleService = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const addCert = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      validateCertificateAsset(asset);

      const partnerUUID = await loadPartnerProfileId();
      if (!partnerUUID) {
        Alert.alert('Profile not saved', 'Please save personal details before uploading a certificate.');
        return;
      }

      const formData = new FormData();

      if (Platform.OS === 'web') {
        const blobResponse = await fetch(asset.uri);
        const blob = await blobResponse.blob();
        const file = new File([blob], asset.name || 'certificate.pdf', {
          type: asset.mimeType || 'application/pdf',
        });
        formData.append('certificate', file);
      } else {
        formData.append('certificate', {
          uri: asset.uri,
          name: asset.name || 'certificate.pdf',
          type: asset.mimeType || 'application/pdf',
        } as any);
      }

      const response = await authenticatedFetch(`${BASE}/${partnerUUID}/uploadCertificate`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        Alert.alert('Certificate upload failed', errText || 'Please try again.');
        return;
      }

      setCertificateFile({
        name: asset.name || 'certificate',
        uri: asset.uri,
        type: asset.mimeType || 'application/pdf',
      });
      setCerts(prev => [...prev, {
        name: asset.name || 'Certificate',
        institute: 'Uploaded',
        issue_date: new Date().toISOString().slice(0, 10),
        comment: 'Uploaded by partner',
      }]);
      Alert.alert('Success', 'Certificate uploaded successfully.');
    } catch (error: any) {
      Alert.alert('Upload error', error?.message || 'Unable to upload certificate.');
    }
  };

  const createProfile = async () => {
    const phone = await loadPartnerPhone();
    if (!phone) throw new Error('Mobile number not found. Please log in again.');

    const res = await authenticatedFetch(`${BASE}/createProfile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName,
        emailAddress: email,
        fullAddress: address,
        city,
        state: stateName,
        pinCode: pincode,
        mobileNumber: phone,
      }),
    });

    if (res.status !== 201) {
      const text = await res.text();
      throw new Error(text || 'Profile creation failed');
    }

    const partnerUuid = await res.text();
    const cleanedUuid = partnerUuid.replace(/^"|"$/g, '').trim();
    if (cleanedUuid) await savePartnerProfileId(cleanedUuid);
    return cleanedUuid;
  };

  const createServices = async () => {
    const partnerUUID = await loadPartnerProfileId();
    if (!partnerUUID) throw new Error('Partner profile ID not found.');

    const res = await authenticatedFetch(`${BASE}/createServices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partnerUUID,
        serviceTypes: selected.map((id) => ({
          serviceType: id,
        })),
      }),
    });

    if (res.status !== 201) {
      const text = await res.text();
      throw new Error(text || 'Service save failed');
    }
  };

  const validateKycAsset = (asset: { name?: string; mimeType?: string; size?: number }) => {
    const name = (asset.name || '').toLowerCase();
    const mimeType = (asset.mimeType || '').toLowerCase();
    const isAllowedExtension = name.endsWith('.pdf') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg');
    const isAllowedMimeType = ALLOWED_CERTIFICATE_TYPES.includes(mimeType);
    const isWithinSizeLimit = (asset.size ?? 0) <= MAX_CERTIFICATE_SIZE_BYTES;

    if (!isAllowedExtension && !isAllowedMimeType) {
      throw new Error('KYC document must be a PDF, PNG, JPG, or JPEG file.');
    }

    if (!isWithinSizeLimit) {
      throw new Error('KYC document size must be 5 MB or less.');
    }
  };

  const uploadKYC = async () => {
    const partnerUUID = await loadPartnerProfileId();
    if (!partnerUUID) {
      Alert.alert('Profile not saved', 'Please save personal details before uploading KYC document.');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      validateKycAsset(asset);
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const blobResponse = await fetch(asset.uri);
        const blob = await blobResponse.blob();
        const file = new File([blob], asset.name || 'kyc-document.pdf', {
          type: asset.mimeType || 'application/pdf',
        });
        formData.append('KYCDocument', file);
      } else {
        formData.append('KYCDocument', {
          uri: asset.uri,
          name: asset.name || 'kyc-document.pdf',
          type: asset.mimeType || 'application/pdf',
        } as any);
      }

      const response = await authenticatedFetch(`${BASE}/${partnerUUID}/uploadKYC`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        Alert.alert('KYC document upload failed', errText || 'Please try again.');
        return;
      }

      setKycDocument({
        name: asset.name || 'kyc-document.pdf',
        uri: asset.uri,
        type: asset.mimeType || 'application/pdf',
      });
      Alert.alert('Success', 'KYC document uploaded successfully.');
    } catch (error: any) {
      Alert.alert('Upload error', error?.message || 'Unable to upload KYC document.');
    }
  };

  const uploadPassbook = async () => {
    if (!bankFormValid) {
      setPassbookStatus('uploadDisabled');
      Alert.alert('Incomplete bank details', 'Please complete all required bank details before uploading the passbook document.');
      return;
    }

    try {
      setPassbookStatus('uploading');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) {
        setPassbookStatus(bankFormValid ? 'uploadEnabled' : 'uploadDisabled');
        return;
      }

      const asset = result.assets[0];
      const name = (asset.name || '').toLowerCase();
      const mimeType = (asset.mimeType || '').toLowerCase();
      const allowedExt = name.endsWith('.pdf') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg');
      const allowedMime = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'].includes(mimeType);
      const sizeOk = (asset.size ?? 0) <= MAX_CERTIFICATE_SIZE_BYTES;

      if ((!allowedExt && !allowedMime) || !sizeOk) {
        setPassbookStatus('unreadable');
        Alert.alert('Invalid passbook document', 'Please upload a clear PDF or image file up to 5 MB.');
        return;
      }

      setPassbookDocument({
        name: asset.name || 'passbook-front-page.pdf',
        uri: asset.uri,
        type: asset.mimeType || 'application/pdf',
      });
      setPassbookStatus('uploadEnabled');
      Alert.alert('Passbook uploaded', 'Your passbook document is ready for verification when you continue.');
    } catch (error: any) {
      setPassbookStatus('unreadable');
      Alert.alert('Upload error', error?.message || 'Unable to process the passbook document.');
    }
  };

  const validatePassbookDocument = async () => {
    if (!bankFormValid) {
      Alert.alert('Incomplete bank details', 'Please complete all required bank details before continuing.');
      return false;
    }

    if (!passbookDocument) {
      Alert.alert('Passbook required', 'Please upload the passbook front page before continuing.');
      return false;
    }

    try {
      setPassbookStatus('processing');
      setSaving(true);

      const formData = new FormData();
      const file = await buildMultipartFile(passbookDocument);
      formData.append('bankDocument', file as any);

      const res = await authenticatedFetch(`${BASE}/${encodeURIComponent(normalizeAccountNumber(accountNumber))}/validateBankDocument`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        setPassbookStatus('mismatch');
        Alert.alert('Validation failed', text || 'Bank document validation failed.');
        return false;
      }

      const data = await res.json();
      const isValid = Boolean(data?.isValidDocument ?? data?.validDocument ?? false);

      if (!isValid) {
        setPassbookStatus('mismatch');
        Alert.alert('Account number mismatch', 'The account number entered does not match the account number on the uploaded passbook. Please check your details and upload the correct passbook page.');
        return false;
      }

      setPassbookStatus('verified');
      return true;
    } catch (error: any) {
      setPassbookStatus('unreadable');
      Alert.alert('Couldn\'t verify account number', 'We couldn\'t clearly read the account number from this document. Please upload a clear image of the passbook front page.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const createKYC = async () => {
    const partnerUUID = await loadPartnerProfileId();
    if (!partnerUUID) throw new Error('Partner profile ID not found.');

    const payload = {
      partnerUUID,
      aadhaarNumber: kycType === 'aadhaar' ? kycNumber : null,
      panNumber: kycType === 'pan' ? kycNumber : null,
    };

    const res = await authenticatedFetch(`${BASE}/createPartnerKYC`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status !== 201) {
      const text = await res.text();
      throw new Error(text || 'KYC save failed');
    }
  };

  const createBankDetails = async () => {
    const partnerUUID = await loadPartnerProfileId();
    if (!partnerUUID) throw new Error('Partner profile ID not found.');

    const payload = {
      partnerUUID,
      bankName,
      accountHolderName: accountHolder,
      ifscCode: ifsc,
      accountNumber,
      confirmAccountNumber: confirmAccount,
    };

    const res = await authenticatedFetch(`${BASE}/createPartnerBankDetails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status !== 201) {
      const text = await res.text();
      throw new Error(text || 'Bank details save failed');
    }
  };

  const submit = async () => {
    try {
      setSaving(true);
      const partnerUUID = await loadPartnerProfileId();
      if (!partnerUUID) throw new Error('Partner profile ID not found.');

      const res = await authenticatedFetch(`${BASE}/${partnerUUID}/submitForVerification`, {
        method: 'POST',
      });

      if (res.status !== 201) {
        const text = await res.text();
        throw new Error(text || 'Submit for verification failed');
      }

      router.replace('/verification-pending');
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to submit for verification');
    } finally { setSaving(false); }
  };

  const handlePrimaryAction = async () => {
    if (step === 0) {
      try {
        setSaving(true);
        await createProfile();
        setStep(1);
      } catch (e: any) {
        console.error(e);
        alert(e.message || 'Unable to save profile');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (step === 1) {
      try {
        setSaving(true);
        await createServices();
        setStep(2);
      } catch (e: any) {
        console.error(e);
        alert(e.message || 'Unable to save services');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (step === 2) {
      setStep(3);
      return;
    }

    if (step === 3) {
      const validKycNumber = kycType === 'aadhaar' ? isValidAadhaar(kycNumber) : isValidPan(kycNumber);
      if (!validKycNumber) {
        Alert.alert('Invalid KYC', kycType === 'aadhaar' ? 'Enter a valid 12-digit Aadhaar number.' : 'Enter a valid 10-character PAN number.');
        return;
      }
      if (!kycDocument) {
        Alert.alert('KYC document required', 'Please upload your Aadhaar or PAN document before continuing.');
        return;
      }
      try {
        setSaving(true);
        await createKYC();
        setStep(4);
      } catch (e: any) {
        console.error(e);
        alert(e.message || 'Unable to save KYC');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (step === 4) {
      try {
        const validated = await validatePassbookDocument();
        if (!validated) return;
        await createBankDetails();
        setStep(5);
      } catch (e: any) {
        console.error(e);
        alert(e.message || 'Unable to save bank details');
      }
      return;
    }

    if (step === STEPS.length - 1) {
      await submit();
      return;
    }

    setStep(step + 1);
  };

  return (
    <SafeAreaView style={styles.c} testID="partner-register">
      <View style={styles.header}>
        <View style={{ width: 40 }} />
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.step}>STEP {step + 1} / {STEPS.length}</Text>
          <Text style={styles.hTitle}>{STEPS[step]}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.progressRow}>
        {STEPS.map((_, i) => <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />)}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: pSpacing.xl, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <View style={{ gap: pSpacing.lg }}>
              <View style={{ alignItems: 'center' }}>
                <Image source={profilePicture} style={styles.avatar} contentFit="cover" />
                <Pressable style={styles.avatarBtn}><Feather name="camera" size={14} color={pColors.ink} /><Text style={styles.avatarBtnTxt}>Upload photo</Text></Pressable>
              </View>
              <Field label="Full name" value={fullName} onChange={setFullName} testID="reg-name" />
              <Field label="Email address" value={email} onChange={setEmail} kb="email-address" testID="reg-email" />
              <Field label="Full address" value={address} onChange={setAddress} multi testID="reg-address" />
              <View style={styles.twoCol}>
                <View style={styles.col}><Field label="City" value={city} onChange={setCity} testID="reg-city" /></View>
                <View style={styles.col}><Field label="State" value={stateName} onChange={setStateName} testID="reg-state" /></View>
              </View>
              <Field label="Pincode" value={pincode} onChange={setPincode} kb="number-pad" maxLen={6} testID="reg-pin" />
            </View>
          )}

          {step === 1 && (
            <View>
              <Text style={styles.helper}>Select all services you offer. You can configure pricing later.</Text>
              <View style={styles.services}>
                {SERVICE_CATALOG.map((s) => {
                  const on = selected.includes(s.id);
                  return (
                    <Pressable key={s.id} onPress={() => toggleService(s.id)} style={[styles.svcTile, on && styles.svcTileOn]} testID={`svc-${s.id}`}>
                      <View style={[styles.svcIcon, on && { backgroundColor: pColors.gold }]}><Feather name={s.icon as any} size={20} color={on ? pColors.ink : pColors.goldDeep} /></View>
                      <Text style={[styles.svcName, on && { color: pColors.ink }]}>{s.name}</Text>
                      {on && <Feather name="check-circle" size={18} color={pColors.ink} style={{ marginLeft: 'auto' }} />}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={{ gap: pSpacing.md }}>
              <Text style={styles.uploadHint}>Upload a Training certificate</Text>
              <Text style={styles.optionalHint}>Certificates are optional during onboarding. You can upload one now or later to unlock Makeup services.</Text>

              <Pressable style={styles.upload} onPress={addCert}>
                <Feather name="upload-cloud" size={22} color={pColors.goldDeep} />
                <Text style={styles.uploadTitle}>Upload certificate</Text>
                <Text style={styles.uploadSub}>{certificateFile ? certificateFile.name : 'PDF or image, up to 5 MB'}</Text>
              </Pressable>

              <Pressable style={styles.skipBtn} onPress={() => setStep(3)}>
                <Text style={styles.skipBtnTxt}>Skip for now</Text>
              </Pressable>

              {certs.map((c, i) => (
                <View key={i} style={styles.certCard}>
                  <Feather name="award" size={18} color={pColors.goldDeep} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.certName}>{c.name}</Text>
                    <Text style={styles.certMeta}>{c.institute} · {c.issue_date}</Text>
                  </View>
                  <Pressable onPress={() => setCerts(certs.filter((_, x) => x !== i))}><Feather name="x" size={16} color={pColors.inkMuted} /></Pressable>
                </View>
              ))}
            </View>
          )}

          {step === 3 && (
            <View style={{ gap: pSpacing.lg }}>
              <Text style={styles.helper}>Verify your identity with either Aadhaar or PAN.</Text>
              <View style={{ flexDirection: 'row', gap: pSpacing.sm }}>
                {(['aadhaar', 'pan'] as const).map((t) => (
                  <Pressable key={t} onPress={() => setKycType(t)} style={[styles.pickBtn, kycType === t && styles.pickBtnOn]} testID={`kyc-${t}`}>
                    <Text style={[styles.pickTxt, kycType === t && { color: pColors.ink }]}>{t === 'aadhaar' ? 'Aadhaar' : 'PAN'}</Text>
                  </Pressable>
                ))}
              </View>
              <Field
                label={kycType === 'aadhaar' ? '12-digit Aadhaar number' : '10-char PAN number'}
                value={kycNumber}
                onChange={(value: string) => setKycNumber(kycType === 'aadhaar' ? value.replace(/\D/g, '').slice(0, 12) : value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                maxLen={kycType === 'aadhaar' ? 12 : 10}
                kb={kycType === 'aadhaar' ? 'number-pad' : 'default'}
                testID="kyc-number"
              />
              <Pressable style={styles.upload} onPress={uploadKYC}>
                <Feather name="upload-cloud" size={22} color={pColors.goldDeep} />
                <Text style={styles.uploadTitle}>Upload {kycType === 'aadhaar' ? 'Aadhaar' : 'PAN'} document</Text>
                <Text style={styles.uploadSub}>{kycDocument ? kycDocument.name : 'PDF or image, up to 5 MB'}</Text>
              </Pressable>
            </View>
          )}

          {step === 4 && (
            <View style={{ gap: pSpacing.lg }}>
              <Text style={styles.helper}>Payouts are transferred here within 24 hours of job completion.</Text>
              <Field label="Bank name" value={bankName} onChange={setBankName} testID="bank-name" />
              <Field label="Account holder name" value={accountHolder} onChange={setAccountHolder} testID="acc-holder" />
              <View style={{ flexDirection: 'row', gap: pSpacing.md }}>
                <View style={{ flex: 1 }}><Field label="IFSC code" value={ifsc} onChange={(v: string) => setIfsc(v.toUpperCase())} maxLen={11} testID="ifsc" /></View>
                <View style={{ flex: 1 }}><Field label="Account number" value={accountNumber} onChange={setAccountNumber} kb="number-pad" testID="acc-num" /></View>
              </View>
              <Field label="Confirm account number" value={confirmAccount} onChange={setConfirmAccount} kb="number-pad" testID="acc-confirm" />

              {!bankName.trim() && <Text style={styles.err}>Bank name is required.</Text>}
              {!accountHolder.trim() && <Text style={styles.err}>Account holder name is required.</Text>}
              {!!ifsc && !isValidIfsc(ifsc) && <Text style={styles.err}>Enter a valid IFSC code.</Text>}
              {!!accountNumber && !isValidBankAccountNumber(accountNumber) && <Text style={styles.err}>Enter a valid account number.</Text>}
              {!!accountNumber && !!confirmAccount && normalizeAccountNumber(accountNumber) !== normalizeAccountNumber(confirmAccount) && <Text style={styles.err}>Account numbers do not match.</Text>}

              <Pressable
                style={[
                  styles.upload,
                  (!bankFormValid || passbookStatus === 'uploading' || passbookStatus === 'processing') && styles.uploadDisabled,
                ]}
                onPress={uploadPassbook}
                disabled={!bankFormValid || passbookStatus === 'uploading' || passbookStatus === 'processing'}
              >
                <Feather name="upload-cloud" size={22} color={bankFormValid ? pColors.goldDeep : pColors.inkFaint} />
                <Text style={[styles.uploadTitle, !bankFormValid && { color: pColors.inkFaint }]}>{passbookDocument ? 'Upload passbook front page again' : 'Upload passbook front page'}</Text>
                <Text style={[styles.uploadSub, !bankFormValid && { color: pColors.inkFaint }]}>
                  {bankFormValid
                    ? (passbookStatus === 'verified' ? 'Verified and matched' : passbookStatus === 'mismatch' ? 'Needs correction' : passbookStatus === 'unreadable' ? 'Upload a clear image of the passbook front page' : 'Upload a clear image of your passbook front page')
                    : 'Complete all bank details above to enable document upload.'}
                </Text>
              </Pressable>

              {passbookStatus === 'verified' && (
                <View style={styles.verificationSuccess}>
                  <Feather name="check-circle" size={16} color="#1B7F5A" />
                  <Text style={styles.verificationSuccessText}>✓ Bank account verified</Text>
                </View>
              )}

              {passbookStatus === 'mismatch' && (
                <View style={styles.verificationError}>
                  <Feather name="alert-circle" size={16} color="#B42318" />
                  <Text style={styles.verificationErrorText}>Account number mismatch</Text>
                </View>
              )}

              {passbookStatus === 'unreadable' && (
                <View style={styles.verificationError}>
                  <Feather name="alert-circle" size={16} color="#B42318" />
                  <Text style={styles.verificationErrorText}>Couldn\'t verify account number</Text>
                </View>
              )}

              <Field label="UPI ID (optional)" value={upi} onChange={setUpi} testID="upi" />
            </View>
          )}

          {step === 5 && (
            <View style={{ gap: pSpacing.md }}>
              <Text style={styles.helper}>Review your details before submitting. Our team verifies within 24–48 hours.</Text>
              <ReviewSection title="Personal">
                <Kv k="Name" v={fullName} /><Kv k="Email" v={email} /><Kv k="City" v={`${city}, ${stateName}`} /><Kv k="Pincode" v={pincode} last />
              </ReviewSection>
              <ReviewSection title="Services">
                <Text style={styles.chipRow}>{selected.map((id) => SERVICE_CATALOG.find(s => s.id === id)?.name).filter(Boolean).join(' · ')}</Text>
              </ReviewSection>
              <ReviewSection title="KYC">
                <Kv k="Type" v={kycType.toUpperCase()} /><Kv k="Number" v={kycNumber} last />
              </ReviewSection>
              <ReviewSection title="Bank">
                <Kv k="Bank" v={bankName} /><Kv k="Holder" v={accountHolder} /><Kv k="IFSC" v={ifsc} /><Kv k={'A/c'} v={`XXXX${accountNumber.slice(-4)}`} last />
              </ReviewSection>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.cta, (!canNext() || saving) && { opacity: 0.5 }]}
            disabled={!canNext() || saving}
            onPress={handlePrimaryAction}
            testID="reg-next"
          >
            {saving ? (
              <View style={styles.ctaLoading}>
                <ActivityIndicator size="small" color={pColors.ink} />
                <Text style={styles.ctaTxt}>{step === 4 ? 'Validating…' : step === STEPS.length - 1 ? 'Submitting…' : 'Saving…'}</Text>
              </View>
            ) : (
              <Text style={styles.ctaTxt}>{step === STEPS.length - 1 ? 'Submit for verification' : 'Save & continue'}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, multi, kb, maxLen, testID }: any) {
  return (
    <View>
      <Text style={styles.label} numberOfLines={1}>{label.toUpperCase()}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        multiline={multi}
        keyboardType={kb || 'default'}
        maxLength={maxLen}
        placeholderTextColor={pColors.inkFaint}
        selectionColor="transparent"
        underlineColorAndroid="transparent"
        cursorColor={pColors.goldDeep}
        selectTextOnFocus={false}
        style={[styles.input, multi && { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }]}
      />
    </View>
  );
}
function ReviewSection({ title, children }: any) {
  return (
    <View style={styles.rev}>
      <Text style={styles.revTitle}>{title}</Text>
      <View style={{ marginTop: 8 }}>{children}</View>
    </View>
  );
}
function Kv({ k, v, last }: any) {
  return <View style={[{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: pColors.divider }]}><Text style={{ color: pColors.inkMuted, fontSize: 13 }}>{k}</Text><Text style={{ color: pColors.ink, fontWeight: '600', fontSize: 13, maxWidth: '60%', textAlign: 'right' }}>{v || '—'}</Text></View>;
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: pColors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: pSpacing.xl, paddingTop: pSpacing.md, paddingBottom: pSpacing.md },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  step: { fontSize: 10, letterSpacing: 2, color: pColors.goldDeep, fontWeight: '800' },
  hTitle: { ...pType.h3, color: pColors.ink },
  progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: pSpacing.xl, marginBottom: pSpacing.md },
  progressDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: pColors.border },
  progressDotActive: { backgroundColor: pColors.gold },
  helper: { color: pColors.inkMuted, ...pType.body, marginBottom: pSpacing.lg },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: pColors.gold },
  twoCol: { flexDirection: 'row', gap: pSpacing.md, alignItems: 'flex-start' },
  col: { flex: 1, minWidth: 0 },
  avatarBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: pSpacing.md, paddingHorizontal: 12, paddingVertical: 8, borderRadius: pRadii.pill, backgroundColor: pColors.surface, borderWidth: 1, borderColor: pColors.border },
  avatarBtnTxt: { color: pColors.ink, fontSize: 12, fontWeight: '600' },
  label: { color: pColors.inkMuted, fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },
  input: { marginTop: 6, backgroundColor: pColors.surface, borderWidth: 1, borderColor: pColors.border, borderRadius: pRadii.md, paddingHorizontal: pSpacing.lg, height: 52, fontSize: 15, color: pColors.ink, outline: 'none', shadowOpacity: 0, shadowColor: 'transparent', elevation: 0, textDecorationLine: 'none' },
  err: { color: pColors.error, fontSize: 12 },
  services: { gap: pSpacing.sm },
  svcTile: { flexDirection: 'row', gap: pSpacing.md, alignItems: 'center', backgroundColor: pColors.surface, borderWidth: 1, borderColor: pColors.border, borderRadius: pRadii.md, paddingHorizontal: pSpacing.lg, paddingVertical: 14 },
  svcTileOn: { borderColor: pColors.gold, backgroundColor: '#FFFDF6', borderWidth: 2 },
  svcIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: pColors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  svcName: { color: pColors.ink, fontWeight: '600', fontSize: 15 },
  certCard: { flexDirection: 'row', gap: pSpacing.md, backgroundColor: pColors.surface, borderRadius: pRadii.md, borderWidth: 1, borderColor: pColors.border, padding: pSpacing.md, alignItems: 'center' },
  certName: { color: pColors.ink, fontWeight: '600' },
  certMeta: { color: pColors.inkMuted, fontSize: 12, marginTop: 2 },
  certForm: { backgroundColor: pColors.surfaceMuted, borderRadius: pRadii.md, padding: pSpacing.lg, gap: pSpacing.md, borderWidth: 1, borderColor: pColors.border },
  smallBtn: { flexDirection: 'row', gap: 6, alignSelf: 'flex-start', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: pRadii.pill, backgroundColor: pColors.gold },
  smallBtnTxt: { color: pColors.ink, fontWeight: '700', fontSize: 13 },
  pickBtn: { flex: 1, paddingVertical: 14, borderRadius: pRadii.md, borderWidth: 1, borderColor: pColors.border, backgroundColor: pColors.surface, alignItems: 'center' },
  pickBtnOn: { borderColor: pColors.gold, borderWidth: 2, backgroundColor: '#FFFDF6' },
  pickTxt: { color: pColors.inkMuted, fontWeight: '700' },
  upload: { padding: pSpacing.xl, borderRadius: pRadii.md, backgroundColor: pColors.surface, borderWidth: 1, borderColor: pColors.border, borderStyle: 'dashed' as any, alignItems: 'center', gap: 4 },
  uploadDisabled: { opacity: 0.5, backgroundColor: pColors.surfaceMuted },
  uploadTitle: { color: pColors.ink, fontWeight: '600', marginTop: 6 },
  uploadSub: { color: pColors.inkMuted, fontSize: 12 },
  uploadHint: { color: pColors.goldDeep, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  optionalHint: { color: pColors.inkMuted, fontSize: 13, lineHeight: 18 },
  skipBtn: { paddingVertical: 12, borderRadius: pRadii.pill, borderWidth: 1, borderColor: pColors.border, backgroundColor: pColors.surface, alignItems: 'center' },
  skipBtnTxt: { color: pColors.ink, fontWeight: '700' },
  verificationSuccess: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E7F9F1', borderWidth: 1, borderColor: '#1B7F5A', borderRadius: pRadii.md, padding: pSpacing.md },
  verificationSuccessText: { color: '#1B7F5A', fontWeight: '700' },
  verificationError: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FDECEC', borderWidth: 1, borderColor: '#B42318', borderRadius: pRadii.md, padding: pSpacing.md },
  verificationErrorText: { color: '#B42318', fontWeight: '700' },
  rev: { backgroundColor: pColors.surface, borderRadius: pRadii.md, borderWidth: 1, borderColor: pColors.border, padding: pSpacing.md },
  revTitle: { color: pColors.goldDeep, fontSize: 11, letterSpacing: 2, fontWeight: '800' },
  chipRow: { color: pColors.ink, fontSize: 14, marginTop: 6 },
  footer: { padding: pSpacing.xl, paddingTop: pSpacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: pColors.divider, backgroundColor: pColors.bg },
  cta: { backgroundColor: pColors.ink, borderRadius: pRadii.pill, paddingVertical: 18, alignItems: 'center' },
  ctaLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaTxt: { color: pColors.gold, fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
});
