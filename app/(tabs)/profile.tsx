import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VibeBadge } from '@/components/vibe-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { listEvents } from '@/lib/local-events';
import { getProfile, updateProfile, type LocalProfile, type VibeIntent } from '@/lib/local-profile';
import { supabase, type Profile as SupabaseProfile } from '@/lib/supabase';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = React.useState<LocalProfile | null>(null);
  const [supabaseProfile, setSupabaseProfile] = React.useState<SupabaseProfile | null>(null);
  const [eventsCount, setEventsCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  // Load profile on focus
  useFocusEffect(
    React.useCallback(() => {
      void loadAllData();
    }, [])
  );

  async function loadAllData() {
    setLoading(true);
    await Promise.all([loadSupabaseProfile(), loadLocalProfile(), loadStats()]);
    setLoading(false);
  }

  // Fetch profile from Supabase
  async function loadSupabaseProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.log('Supabase profile not found, using local:', error.message);
        return;
      }

      if (data) {
        setSupabaseProfile(data);
      }
    } catch (e) {
      console.error('Error fetching Supabase profile:', e);
    }
  }

  // Fallback to local profile
  async function loadLocalProfile() {
    const p = await getProfile();
    setProfile(p);
  }

  async function loadStats() {
    const events = await listEvents();
    setEventsCount(events.length);
  }

  async function toggleGhostMode(value: boolean) {
    if (!profile) return;
    const updated = await updateProfile({
      privacy: { ...profile.privacy, ghostMode: value },
    });
    setProfile(updated);
  }

  async function handleLogout() {
    try {
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
      }
      // The auth state change listener in _layout.tsx will handle redirect
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  }

  // Merge Supabase profile with local profile
  const displayProfile = React.useMemo(() => {
    if (!profile) return null;

    // If we have Supabase profile, merge it with local
    if (supabaseProfile) {
      return {
        ...profile,
        name: supabaseProfile.name || profile.name,
        photos: supabaseProfile.avatar_url ? [supabaseProfile.avatar_url, ...profile.photos.slice(1)] : profile.photos,
        vibeIntent: (supabaseProfile.vibe as VibeIntent) || profile.vibeIntent,
        bio: supabaseProfile.bio || profile.bio,
      };
    }

    return profile;
  }, [profile, supabaseProfile]);

  if (!displayProfile || loading) {
    return (
      <ThemedView style={[styles.container, { paddingTop: 16 + insets.top }]}>
        <ThemedText>Загрузка...</ThemedText>
      </ThemedView>
    );
  }

  const primaryPhoto = displayProfile.photos[0];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: 16 + insets.top }]}
      showsVerticalScrollIndicator={false}>
      {/* Card 1: Photo & Basic Info */}
      <ThemedView style={styles.card}>
        <View style={styles.photoContainer}>
          {primaryPhoto ? (
            <Image source={{ uri: primaryPhoto }} style={styles.mainPhoto} contentFit="cover" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <ThemedText type="title" style={styles.photoPlaceholderText}>
                {displayProfile.name.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
          )}
          {displayProfile.photos.length > 1 && (
            <View style={styles.photoCountBadge}>
              <ThemedText style={styles.photoCountText}>+{displayProfile.photos.length - 1}</ThemedText>
            </View>
          )}
        </View>

        <View style={styles.nameSection}>
          <ThemedText type="title" style={styles.name}>
            {displayProfile.name}
            {displayProfile.age && <ThemedText style={styles.age}> • {displayProfile.age}</ThemedText>}
          </ThemedText>
          {displayProfile.location && (
            <ThemedText style={styles.location}>📍 {displayProfile.location}</ThemedText>
          )}
        </View>
      </ThemedView>

      {/* Card 2: Vibe/Intent */}
      {displayProfile.vibeIntent && (
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
            Что ищу
          </ThemedText>
          <VibeBadge vibe={displayProfile.vibeIntent} size="large" />
        </ThemedView>
      )}

      {/* Card 3: Bio */}
      {displayProfile.bio && (
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
            О себе
          </ThemedText>
          <ThemedText style={styles.bioText}>{displayProfile.bio}</ThemedText>
        </ThemedView>
      )}

      {/* Card 4: Conversation Starters */}
      {displayProfile.conversationStarters.length > 0 && (
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
            Темы для разговора
          </ThemedText>
          <View style={styles.startersList}>
            {displayProfile.conversationStarters.map((starter, idx) => (
              <View key={idx} style={styles.starterChip}>
                <ThemedText style={styles.starterText}>💬 {starter}</ThemedText>
              </View>
            ))}
          </View>
        </ThemedView>
      )}

      {/* Card 5: Interests */}
      {displayProfile.interests.length > 0 && (
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
            Интересы
          </ThemedText>
          <View style={styles.chipsRow}>
            {displayProfile.interests.map((interest, idx) => (
              <View key={idx} style={styles.interestChip}>
                <ThemedText style={styles.interestText}>{interest}</ThemedText>
              </View>
            ))}
          </View>
        </ThemedView>
      )}

      {/* Card 6: Languages */}
      {displayProfile.languages.length > 0 && (
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
            Языки
          </ThemedText>
          <View style={styles.chipsRow}>
            {displayProfile.languages.map((lang, idx) => (
              <View key={idx} style={styles.langChip}>
                <ThemedText style={styles.langText}>
                  {lang === 'ru' ? '🇷🇺 Русский' : lang === 'en' ? '🇬🇧 English' : lang === 'ky' ? '🇰🇬 Кыргызча' : lang}
                </ThemedText>
              </View>
            ))}
          </View>
        </ThemedView>
      )}

      {/* Card 7: Favorite Spots */}
      {displayProfile.favoriteSpots.length > 0 && (
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
            Любимые места
          </ThemedText>
          <View style={styles.spotsList}>
            {displayProfile.favoriteSpots.map((spot) => (
              <View key={spot.id} style={styles.spotItem}>
                <ThemedText type="defaultSemiBold" style={styles.spotName}>
                  📍 {spot.name}
                </ThemedText>
                <ThemedText style={styles.spotAddress}>{spot.address}</ThemedText>
              </View>
            ))}
          </View>
        </ThemedView>
      )}

      {/* Card 8: Privacy Settings */}
      <ThemedView style={styles.card}>
        <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
          Настройки приватности
        </ThemedText>
        <View style={styles.privacyRow}>
          <View style={styles.privacyItem}>
            <View style={styles.privacyLabel}>
              <ThemedText type="defaultSemiBold" style={styles.privacyText}>
                👻 Режим невидимки
              </ThemedText>
              <ThemedText style={styles.privacyHint}>Скрыть меня на карте</ThemedText>
            </View>
            <Switch
              value={displayProfile.privacy.ghostMode}
              onValueChange={toggleGhostMode}
              trackColor={{ false: '#E0E0E0', true: '#FF9F66' }}
              thumbColor={displayProfile.privacy.ghostMode ? '#FFFFFF' : '#F4F3F4'}
            />
          </View>
        </View>
      </ThemedView>

      {/* Card 9: Stats */}
      <ThemedView style={styles.card}>
        <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
          Статистика
        </ThemedText>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ThemedText type="title" style={styles.statNumber}>
              {eventsCount}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Созданных встреч</ThemedText>
          </View>
        </View>
      </ThemedView>

      {/* Edit Button */}
      <Pressable style={styles.editButton} onPress={() => router.push('/edit-profile')}>
        <ThemedText type="defaultSemiBold" style={styles.editButtonText}>
          ✏️ Редактировать профиль
        </ThemedText>
      </Pressable>

      {/* Log Out Button */}
      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <ThemedText style={styles.logoutButtonText}>Выйти</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F0', // Warm peach background
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 100, // Extra padding for tab bar + logout button
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
    position: 'relative',
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
  photoCountBadge: {
    position: 'absolute',
    bottom: 0,
    right: '35%',
    backgroundColor: '#C77DFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  photoCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  nameSection: {
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 26,
    color: '#2D1B3D',
  },
  age: {
    fontSize: 26,
    color: '#FF9F66',
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
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0E6FF',
  },
  langText: {
    fontSize: 13,
    color: '#8B4CBF',
  },
  startersList: {
    gap: 8,
  },
  starterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#FFF0E6',
  },
  starterText: {
    fontSize: 14,
    color: '#FF6B35',
  },
  spotsList: {
    gap: 12,
  },
  spotItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5E6E0',
  },
  spotName: {
    fontSize: 15,
    color: '#2D1B3D',
    marginBottom: 4,
  },
  spotAddress: {
    fontSize: 13,
    color: '#8B7A9B',
  },
  privacyRow: {
    gap: 16,
  },
  privacyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  privacyLabel: {
    flex: 1,
    gap: 4,
  },
  privacyText: {
    fontSize: 15,
    color: '#2D1B3D',
  },
  privacyHint: {
    fontSize: 12,
    color: '#8B7A9B',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFF0E6',
  },
  statNumber: {
    fontSize: 32,
    color: '#FF6B35',
  },
  statLabel: {
    fontSize: 12,
    color: '#8B7A9B',
    marginTop: 4,
  },
  editButton: {
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
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  logoutButton: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '500',
  },
});
