import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VibeBadge } from '@/components/vibe-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { VibeIntent } from '@/lib/local-profile';

// Mock interests based on vibe
function getMockInterests(vibe: string | null): string[] {
  const interestSets: Record<string, string[]> = {
    networking: ['Стартапы', 'Бизнес', 'Инвестиции', 'Tech', 'Коворкинги'],
    'just-coffee': ['Кофе', 'Чай', 'Книги', 'Музыка', 'Фильмы'],
    friendship: ['Путешествия', 'Hiking', 'Настолки', 'Концерты', 'Фото'],
    'language-practice': ['Языки', 'Культура', 'Путешествия', 'Книги', 'Кино'],
    'romantic-date': ['Рестораны', 'Кино', 'Прогулки', 'Искусство', 'Музыка'],
    adventure: ['Горы', 'Походы', 'Велосипед', 'Путешествия', 'Экстрим'],
  };
  
  const defaultInterests = ['Кофе', 'Путешествия', 'Музыка', 'Фото'];
  const interests = vibe ? interestSets[vibe] : null;
  
  // Pick 3-4 random interests
  const source = interests || defaultInterests;
  const shuffled = [...source].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.floor(Math.random() * 2) + 3);
}

// Mock bio based on vibe
function getMockBio(vibe: string | null): string {
  const bios: Record<string, string[]> = {
    networking: [
      'Ищу интересных людей для новых проектов и идей.',
      'Предприниматель, люблю обсуждать стартапы и инновации.',
      'Строю свой бизнес, открыт к новым знакомствам.',
    ],
    'just-coffee': [
      'Просто хочу выпить кофе и поболтать.',
      'Люблю хороший кофе и интересные разговоры.',
      'Ищу компанию для утреннего капучино ☕',
    ],
    friendship: [
      'Всегда рад новым друзьям и приключениям!',
      'Ищу людей для совместных активностей и тусовок.',
      'Открыт к новым знакомствам и интересным людям.',
    ],
    'language-practice': [
      'Практикую английский, помогу с русским.',
      'Люблю изучать языки и культуры.',
      'Let\'s practice English together! 🗣️',
    ],
    'romantic-date': [
      'Ищу интересного человека для встреч.',
      'Люблю романтические вечера и хорошие рестораны.',
      'Открыт(а) к новым знакомствам ❤️',
    ],
    adventure: [
      'Обожаю горы, походы и приключения!',
      'Ищу компанию для треккинга и путешествий.',
      'Жизнь — это приключение! 🏔️',
    ],
  };
  
  const defaultBios = [
    'Просто здесь, чтобы познакомиться с интересными людьми.',
    'Открыт(а) к новым знакомствам и идеям.',
    'Ищу компанию для интересного времяпрепровождения.',
  ];
  
  const vibesBios = vibe ? bios[vibe] : null;
  const source = vibesBios || defaultBios;
  return source[Math.floor(Math.random() * source.length)];
}

export default function PublicProfileScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string;
    name: string;
    avatar: string;
    vibe: string;
  }>();

  const userId = params.id || 'unknown';
  const name = params.name || 'Пользователь';
  const avatarUrl = params.avatar || null;
  const vibe = (params.vibe as VibeIntent) || null;

  // Generate mock data (memoized to prevent re-renders)
  const [mockData] = React.useState(() => ({
    interests: getMockInterests(vibe),
    bio: getMockBio(vibe),
    location: 'Бишкек, Кыргызстан',
  }));

  return (
    <>
      <Stack.Screen
        options={{
          title: name,
          headerStyle: { backgroundColor: '#FFF5F0' },
          headerTintColor: '#2D1B3D',
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        {/* Card 1: Photo & Basic Info */}
        <ThemedView style={styles.card}>
          <View style={styles.photoContainer}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.mainPhoto} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <ThemedText type="title" style={styles.photoPlaceholderText}>
                  {name.charAt(0).toUpperCase()}
                </ThemedText>
              </View>
            )}
          </View>

          <View style={styles.nameSection}>
            <ThemedText type="title" style={styles.name}>
              {name}
            </ThemedText>
            <ThemedText style={styles.location}>📍 {mockData.location}</ThemedText>
          </View>
        </ThemedView>

        {/* Card 2: Vibe/Intent */}
        {vibe && (
          <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
              Что ищет
            </ThemedText>
            <VibeBadge vibe={vibe} size="large" />
          </ThemedView>
        )}

        {/* Card 3: Bio */}
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
            О себе
          </ThemedText>
          <ThemedText style={styles.bioText}>{mockData.bio}</ThemedText>
        </ThemedView>

        {/* Card 4: Interests */}
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
            Интересы
          </ThemedText>
          <View style={styles.chipsRow}>
            {mockData.interests.map((interest, idx) => (
              <View key={idx} style={styles.interestChip}>
                <ThemedText style={styles.interestText}>{interest}</ThemedText>
              </View>
            ))}
          </View>
        </ThemedView>

        {/* Action Button */}
        <Pressable
          style={styles.actionButton}
          onPress={() => {
            router.push({
              pathname: '/dm/[id]',
              params: {
                id: userId,
                name: name,
                avatar: avatarUrl || '',
                vibe: vibe || 'just-coffee',
              },
            });
          }}>
          <ThemedText type="defaultSemiBold" style={styles.actionButtonText}>
            💬 Написать сообщение
          </ThemedText>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F0',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#FF9F66',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  mainPhoto: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: '#FF9F66',
  },
  photoPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FFE5D4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FF9F66',
  },
  photoPlaceholderText: {
    fontSize: 50,
    color: '#FF9F66',
  },
  nameSection: {
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 26,
    color: '#2D1B3D',
  },
  location: {
    fontSize: 14,
    color: '#8B7A9B',
  },
  cardTitle: {
    fontSize: 16,
    color: '#2D1B3D',
    marginBottom: 12,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4A3A5A',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFE5D4',
  },
  interestText: {
    fontSize: 13,
    color: '#FF6B35',
  },
  actionButton: {
    marginTop: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#FF9F66',
    alignItems: 'center',
    shadowColor: '#FF9F66',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
