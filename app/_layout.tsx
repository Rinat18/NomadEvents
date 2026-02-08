import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BrandedLoading } from '@/components/BrandedLoading';
import { ThemeProvider as AppThemeProvider, useTheme } from '@/lib/theme';
import { checkAndSeedData } from '@/lib/seed-data';
import { hasCompleteProfile } from '@/lib/local-profile';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

function RootBackground({ children }: { children: React.ReactNode }) {
  const { colors, wallpaperUri } = useTheme();
  if (wallpaperUri) {
    return (
      <ImageBackground
        source={{ uri: wallpaperUri }}
        style={styles.background}
        resizeMode="cover">
        {children}
      </ImageBackground>
    );
  }
  return <View style={[styles.background, { backgroundColor: colors.background }]}>{children}</View>;
}

function ThemedStack() {
  const { colors, isDark } = useTheme();
  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="create-profile" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="create-event" options={{ presentation: 'modal', title: 'Создать ивент' }} />
        <Stack.Screen name="edit-profile" options={{ presentation: 'modal', title: 'Редактировать профиль' }} />
        <Stack.Screen name="event/[id]" options={{ title: 'Ивент' }} />
        <Stack.Screen name="user/[id]" options={{ title: 'Профиль' }} />
        <Stack.Screen name="friends" options={{ title: 'Friends' }} />
        <Stack.Screen name="dm/[id]" options={{ title: 'Чат' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
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

  // Handle navigation after auth check: session + profile completeness
  const [profileChecked, setProfileChecked] = React.useState(false);
  const [hasProfile, setHasProfile] = React.useState(false);

  React.useEffect(() => {
    if (!session) {
      setProfileChecked(true);
      setHasProfile(false);
      return;
    }
    let cancelled = false;
    setProfileChecked(false);
    hasCompleteProfile()
      .then((ok) => {
        if (!cancelled) {
          setHasProfile(ok);
          setProfileChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasProfile(false);
          setProfileChecked(true);
        }
      });
    return () => { cancelled = true; };
  }, [session, segments[0]]);

  React.useEffect(() => {
    if (isLoading || !profileChecked) return;

    const inOnboarding = segments[0] === 'onboarding';
    const inCreateProfile = segments[0] === 'create-profile';
    const inTabs = segments[0] === '(tabs)';
    const isAuthenticated = !!session;

    if (!isAuthenticated) {
      if (!inOnboarding) router.replace('/onboarding');
      return;
    }

    if (!hasProfile && !inCreateProfile) {
      router.replace('/create-profile');
      return;
    }
    if (hasProfile && (inOnboarding || inCreateProfile)) {
      router.replace('/(tabs)');
    }
  }, [isLoading, session, segments, router, profileChecked, hasProfile]);

  if (isLoading) {
    return <BrandedLoading />;
  }

  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <RootBackground>
          <ThemedStack />
        </RootBackground>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
});
