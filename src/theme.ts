import { Platform } from 'react-native';

// Partner (Artist) design system — business-luxe.
// Deep charcoal + champagne gold + clean surfaces. Sans-serif dominant, no serif.
// Intentionally different from customer editorial theme.

export const pColors = {
  bg: '#F6F5F1',
  surface: '#FFFFFF',
  surfaceMuted: '#EDEBE4',
  ink: '#0F1114',
  inkSoft: '#3A3D42',
  inkMuted: '#6B6F76',
  inkFaint: '#9CA1A8',
  gold: '#C9A24B',
  goldSoft: '#EBD9A7',
  goldDeep: '#8F6E1C',
  accent: '#0F1114',
  success: '#1F5C34',
  warning: '#B25E00',
  error: '#8A1F1F',
  border: '#E1DED6',
  borderStrong: '#C8C4B8',
  divider: '#EDEBE4',
  overlay: 'rgba(15,17,20,0.55)',
};

export const pSpacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const pRadii = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const pFont = {
  body: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) as string,
  bodyMedium: Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'System' }) as string,
};

export const pType = {
  displayLg: { fontSize: 40, lineHeight: 44, fontWeight: '700' as const, letterSpacing: -1.2 },
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' as const, letterSpacing: -0.8 },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const, letterSpacing: -0.2 },
  h3: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  caption: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const, letterSpacing: 1.5 },
  mono: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const, letterSpacing: 0.5, fontVariant: ['tabular-nums' as any] },
};

export const pShadow = {
  card: {
    shadowColor: '#0F1114',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  float: {
    shadowColor: '#0F1114',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
};

export const inr = (n: number) => `\u20B9${(n || 0).toLocaleString('en-IN')}`;

export const SERVICE_CATALOG = [
  { id: 'bridal', name: 'Bridal Makeup', icon: 'award' },
  { id: 'reception', name: 'Reception Makeup', icon: 'star' },
  { id: 'party', name: 'Party Makeup', icon: 'zap' },
  { id: 'hair', name: 'Hair Styling', icon: 'scissors' },
  { id: 'saree', name: 'Saree Draping', icon: 'wind' },
  { id: 'nail', name: 'Nail Art', icon: 'feather' },
  { id: 'mehendi', name: 'Mehendi', icon: 'droplet' },
];
