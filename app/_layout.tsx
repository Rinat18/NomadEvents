import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

import { LoadingScreen } from '@/components/LoadingScreen';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { checkAndSeedData } from '@/lib/seed-data';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(true);
  const [session, setSession] = React.useState<Session | null>(null);

  // Listen to Supabase auth state changes
  React.useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setIsLoading(false);
    });

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Seed demo data if needed (only when authenticated)
  React.useEffect(() => {
    if (isLoading) return;
    if (!session) return;

    // Seed data in the background - don't wait for it
    void checkAndSeedData();
  }, [isLoading, session]);

  // Handle navigation after auth check is done
  React.useEffect(() => {
    if (isLoading) return;

    const inOnboarding = segments[0] === 'onboarding';
    const inTabs = segments[0] === '(tabs)';
    const isAuthenticated = !!session;

    if (!isAuthenticated && !inOnboarding) {
      // Not authenticated and not on onboarding - go to onboarding
      router.replace('/onboarding');
    } else if (isAuthenticated && inOnboarding) {
      // Authenticated but on onboarding - go to tabs
      router.replace('/(tabs)');
    }
    // If authenticated and in tabs, or not authenticated and in onboarding - do nothing
  }, [isLoading, session, segments, router]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="create-event" options={{ presentation: 'modal', title: 'Создать ивент' }} />
          <Stack.Screen name="edit-profile" options={{ presentation: 'modal', title: 'Редактировать профиль' }} />
          <Stack.Screen name="event/[id]" options={{ title: 'Ивент' }} />
          <Stack.Screen name="user/[id]" options={{ title: 'Профиль' }} />
          <Stack.Screen name="friends" options={{ title: 'Friends' }} />
          <Stack.Screen name="dm/[id]" options={{ title: 'Чат' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
