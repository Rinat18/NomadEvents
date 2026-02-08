import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const COLORS = {
  light: {
    background: '#FFF5F0',
    text: '#2D1B3D',
    quote: '#6E6E73',
    accent: '#FF9F66',
  },
  dark: {
    background: '#1A1A2E',
    text: '#FFFFFF',
    quote: '#B0B0B8',
    accent: '#FF9F66',
  },
} as const;

export function BrandedLoading() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? COLORS.dark : COLORS.light;

  const opacity = useSharedValue(0.6);
  const scale = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0.6, { duration: 800 })
      ),
      -1,
      true
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );
  }, [opacity, scale]);

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Animated.Text style={[styles.logo, { color: c.text }, textAnimatedStyle]}>
        NOMAD EVENTS
      </Animated.Text>
      <ActivityIndicator size="large" color={c.accent} style={styles.spinner} />
      <Text style={[styles.quote, { color: c.quote }]}>Discover your city...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  spinner: {
    marginTop: 24,
  },
  quote: {
    fontSize: 13,
    marginTop: 32,
    fontStyle: 'italic',
  },
});
