import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { VibeIntent } from '@/lib/local-profile';

type VibeBadgeProps = {
  vibe: VibeIntent;
  size?: 'small' | 'medium' | 'large';
};

const VIBE_LABELS: Record<VibeIntent, { label: string; emoji: string; color: string }> = {
  'just-coffee': { label: 'Просто кофе', emoji: '☕', color: '#FF9F66' },
  networking: { label: 'Нетворкинг', emoji: '🤝', color: '#FF6B9D' },
  'romantic-date': { label: 'Романтическая встреча', emoji: '💕', color: '#C77DFF' },
  'language-practice': { label: 'Практика языка', emoji: '🗣️', color: '#4ECDC4' },
  friendship: { label: 'Дружба', emoji: '👫', color: '#FFD93D' },
  adventure: { label: 'Приключения', emoji: '🌍', color: '#6BCF7F' },
};

export function VibeBadge({ vibe, size = 'medium' }: VibeBadgeProps) {
  const config = VIBE_LABELS[vibe];
  const sizeStyles = {
    small: { padding: 6, fontSize: 11 },
    medium: { padding: 8, fontSize: 13 },
    large: { padding: 10, fontSize: 15 },
  };

  return (
    <View style={[styles.badge, { backgroundColor: config.color + '20' }, { padding: sizeStyles[size].padding }]}>
      <ThemedText style={[styles.emoji, { fontSize: sizeStyles[size].fontSize + 2 }]}>{config.emoji}</ThemedText>
      <ThemedText type="defaultSemiBold" style={[styles.label, { fontSize: sizeStyles[size].fontSize }]}>
        {config.label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  emoji: {
    fontSize: 15,
  },
  label: {
    fontSize: 13,
  },
});
