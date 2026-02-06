import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/LoadingScreen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VibeBadge } from '@/components/vibe-badge';
import { getMyFriends } from '@/lib/friends';
import { listEvents } from '@/lib/local-events';
import { getProfile, updateProfile, type LocalProfile, type VibeIntent } from '@/lib/local-profile';
import { supabase, type Profile as SupabaseProfile } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

function usernameFromName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-zа-яё0-9]/gi, '')
    .slice(0, 20);
  return slug ? `@${slug}` : '@nomad';
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme, wallpaperUri, setWallpaper } = useTheme();
  const [profile, setProfile] = React.useState<LocalProfile | null>(null);
  const [supabaseProfile, setSupabaseProfile] = React.useState<SupabaseProfile | null>(null);
  const [eventsCount, setEventsCount] = React.useState(0);
  const [friendsCount, setFriendsCount] = React.useState(0);
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
    const [events, friends] = await Promise.all([listEvents(), getMyFriends()]);
    setEventsCount(events.length);
    setFriendsCount(friends.length);
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

  async function handleChangeWallpaper() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos to set a wallpaper.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setWallpaper(result.assets[0].uri);
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
    return <LoadingScreen />;
  }

  const primaryPhoto = displayProfile.photos[0];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: 16 + insets.top, paddingBottom: 24 + insets.bottom }]}
      showsVerticalScrollIndicator={false}>
      {/* Header Card: Avatar, Name, @username, Vibe */}
      <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
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
          <ThemedText type="title" style={[styles.name, { color: colors.text }]}>
            {displayProfile.name}
            {displayProfile.age != null && displayProfile.age > 0 && (
              <ThemedText style={styles.age}> · {displayProfile.age}</ThemedText>
            )}
          </ThemedText>
          <ThemedText style={[styles.username, { color: colors.textMuted }]}>{usernameFromName(displayProfile.name)}</ThemedText>
          {displayProfile.vibeIntent && (
            <View style={styles.vibeBadgeWrap}>
              <VibeBadge vibe={displayProfile.vibeIntent} size="large" />
            </View>
          )}
        </View>
      </ThemedView>

      {/* Stats Row: Events, Rating, Friends */}
      <View style={styles.statsRow}>
        <View style={[styles.statBlock, { backgroundColor: colors.card }]}>
          <ThemedText type="title" style={[styles.statNumber, { color: colors.text }]}>{eventsCount}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: colors.textMuted }]}>Events</ThemedText>
        </View>
        <View style={[styles.statBlock, { backgroundColor: colors.card }]}>
          <ThemedText type="title" style={[styles.statNumber, { color: colors.text }]}>5.0 ★</ThemedText>
          <ThemedText style={[styles.statLabel, { color: colors.textMuted }]}>Rating</ThemedText>
        </View>
        <TouchableOpacity
          style={[styles.statBlock, { backgroundColor: colors.card }]}
          onPress={() => router.push('/friends')}
          activeOpacity={0.8}>
          <ThemedText type="title" style={[styles.statNumber, { color: colors.text }]}>{friendsCount}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: colors.textMuted }]}>Friends</ThemedText>
        </TouchableOpacity>
      </View>

      {/* Card 3: Bio */}
      {displayProfile.bio && (
        <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
          <ThemedText type="defaultSemiBold" style={[styles.cardTitle, { color: colors.text }]}>
            О себе
          </ThemedText>
          <ThemedText style={[styles.bioText, { color: colors.textMuted }]}>{displayProfile.bio}</ThemedText>
        </ThemedView>
      )}

      {/* Card 4: Conversation Starters */}
      {displayProfile.conversationStarters.length > 0 && (
        <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
          <ThemedText type="defaultSemiBold" style={[styles.cardTitle, { color: colors.text }]}>
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

      {/* Interests Section */}
      <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
        <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { color: colors.text }]}>
          Interests
        </ThemedText>
        {displayProfile.interests.length > 0 ? (
          <View style={styles.chipsRow}>
            {displayProfile.interests.map((interest, idx) => (
              <View key={idx} style={styles.interestChip}>
                <ThemedText style={styles.interestChipText}>{interest}</ThemedText>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText style={[styles.bodyMuted, { color: colors.textMuted }]}>No interests added yet.</ThemedText>
        )}
      </ThemedView>

      {/* Card 6: Languages */}
      {displayProfile.languages.length > 0 && (
        <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
          <ThemedText type="defaultSemiBold" style={[styles.cardTitle, { color: colors.text }]}>
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
        <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
          <ThemedText type="defaultSemiBold" style={[styles.cardTitle, { color: colors.text }]}>
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
      <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
        <ThemedText type="defaultSemiBold" style={[styles.cardTitle, { color: colors.text }]}>
          Настройки приватности
        </ThemedText>
        <View style={styles.privacyRow}>
          <View style={styles.privacyItem}>
            <View style={styles.privacyLabel}>
              <ThemedText type="defaultSemiBold" style={[styles.privacyText, { color: colors.text }]}>
                👻 Режим невидимки
              </ThemedText>
              <ThemedText style={[styles.privacyHint, { color: colors.textMuted }]}>Скрыть меня на карте</ThemedText>
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

      {/* Settings: Appearance */}
      <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
        <ThemedText type="defaultSemiBold" style={[styles.cardTitle, { color: colors.text }]}>
          Settings
        </ThemedText>
        <View style={styles.privacyRow}>
          <View style={styles.privacyItem}>
            <View style={styles.privacyLabel}>
              <Text style={[styles.privacyText, { color: colors.text }]}>🌙 Dark Mode</Text>
              <Text style={[styles.privacyHint, { color: colors.textMuted }]}>Switch app theme</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#E0E0E0', true: colors.accent }}
              thumbColor={isDark ? '#FFFFFF' : '#F4F3F4'}
            />
          </View>
        </View>
        <TouchableOpacity
          style={[styles.wallpaperButton, { borderColor: colors.border }]}
          onPress={handleChangeWallpaper}
          activeOpacity={0.8}>
          <Text style={[styles.wallpaperButtonText, { color: colors.text }]}>🖼️ Change Wallpaper</Text>
          {wallpaperUri ? (
            <Text style={[styles.wallpaperHint, { color: colors.textMuted }]} numberOfLines={1}>
              Custom image set
            </Text>
          ) : null}
        </TouchableOpacity>
      </ThemedView>

      {/* Edit Profile + Friends: side-by-side */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push('/edit-profile')}
          activeOpacity={0.8}>
          <ThemedText type="defaultSemiBold" style={styles.editButtonText}>
            Edit Profile
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.friendsButton}
          onPress={() => router.push('/friends')}
          activeOpacity={0.8}>
          <Ionicons name="people" size={20} color="#FFFFFF" />
          <ThemedText type="defaultSemiBold" style={styles.friendsButtonText}>
            Friends
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Log Out: Small text at bottom */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={[styles.logoutButtonText, { color: colors.textMuted }]}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
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
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  mainPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#FF9F66',
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFE5D4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FF9F66',
  },
  photoPlaceholderText: {
    fontSize: 44,
    color: '#FF9F66',
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: 0,
    right: '32%',
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
    fontSize: 28,
    fontWeight: '700',
    color: '#2D1B3D',
  },
  age: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FF9F66',
  },
  username: {
    fontSize: 15,
    color: '#6E6E73',
  },
  vibeBadgeWrap: {
    marginTop: 8,
  },
  cardTitle: {
    fontSize: 16,
    color: '#2D1B3D',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#2D1B3D',
    marginBottom: 12,
  },
  bodyMuted: {
    fontSize: 15,
    color: '#6E6E73',
  },
  bioText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6E6E73',
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
  interestChipText: {
    fontSize: 13,
    color: '#2D1B3D',
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
    color: '#6E6E73',
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
    color: '#6E6E73',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2D1B3D',
  },
  statLabel: {
    fontSize: 12,
    color: '#6E6E73',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  editButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FF9F66',
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  editButtonText: {
    color: '#FF9F66',
    fontSize: 16,
  },
  friendsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#FF9F66',
  },
  friendsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  wallpaperButton: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  wallpaperButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  wallpaperHint: {
    fontSize: 12,
    marginTop: 4,
  },
  logoutButton: {
    marginTop: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    fontSize: 14,
  },
});
