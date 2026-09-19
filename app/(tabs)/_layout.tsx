import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { pColors } from '@/src/theme';

export default function PartnerTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: pColors.gold,
        tabBarInactiveTintColor: pColors.inkFaint,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },
        tabBarStyle: {
          height: 82,
          paddingTop: 10,
          paddingBottom: 24,
          backgroundColor: pColors.ink,
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Home', tabBarIcon: ({ color }) => <Feather name="grid" size={22} color={color} /> }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: ({ color }) => <Feather name="briefcase" size={22} color={color} /> }} />
      <Tabs.Screen name="services" options={{ title: 'Services', tabBarIcon: ({ color }) => <Feather name="layers" size={22} color={color} /> }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings', tabBarIcon: ({ color }) => <Feather name="trending-up" size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }} />
    </Tabs>
  );
}
