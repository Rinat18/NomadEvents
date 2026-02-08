import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import React from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VibeBadge } from '@/components/vibe-badge';
import {
    getProfile,
    updateProfile,
    type FavoriteSpot,
    type LocalProfile,
    type VibeIntent,
} from '@/lib/local-profile';
import { useTheme } from '@/lib/theme';

const INTEREST_OPTIONS = [
  'Путешествия',
  'Еда',
  'Спорт',
  'Музыка',
  'Искусство',
  'Технологии',
  'Природа',
  'Фотография',
  'Книги',
  'Кино',
  'Танцы',
  'Йога',
  'Фитнес',
  'Готовка',
  'Настольные игры',
];

const LANGUAGE_OPTIONS = [
  { code: 'ru', label: '🇷🇺 Русский' },
  { code: 'en', label: '🇬🇧 English' },
  { code: 'ky', label: '🇰🇬 Кыргызча' },
];

const VIBE_OPTIONS: VibeIntent[] = [
  'just-coffee',
  'networking',
  'romantic-date',
  'language-practice',
  'friendship',
  'adventure',
];

const CONVERSATION_STARTER_EXAMPLES = [
  'Любимое место в Бишкеке?',
  'Какой фильм посоветуешь?',
  'Где лучший кофе в городе?',
  'Твоё хобби?',
  'Планы на выходные?',
];

const POPULAR_SPOTS: Omit<FavoriteSpot, 'id'>[] = [
  { name: 'Центральный парк', address: 'ул. Чуй, Бишкек', lat: 42.8746, lng: 74.589 },
  { name: 'Кафе "Анна"', address: 'пр. Чуй, Бишкек', lat: 42.875, lng: 74.59 },
  { name: 'Ресторан "Арзу"', address: 'ул. Ибраимова, Бишкек', lat: 42.876, lng: 74.591 },
];

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [profile, setProfile] = React.useState<LocalProfile | null>(null);
  const [name, setName] = React.useState('');
  const [bio, setBio] = React.useState('');
  const [age, setAge] = React.useState('');
  const [gender, setGender] = React.useState<'male' | 'female' | 'other' | null>(null);
  const [interests, setInterests] = React.useState<string[]>([]);
  const [languages, setLanguages] = React.useState<string[]>([]);
  const [vibeIntent, setVibeIntent] = React.useState<VibeIntent | null>(null);
  const [conversationStarters, setConversationStarters] = React.useState<string[]>([]);
  const [newStarter, setNewStarter] = React.useState('');
  const [favoriteSpots, setFavoriteSpots] = React.useState<FavoriteSpot[]>([]);
  const [privacy, setPrivacy] = React.useState({ ghostMode: false, showExactLocation: false, allowCheckIns: true });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    void loadProfile();
  }, []);

  async function loadProfile() {
    const p = await getProfile();
    setProfile(p);
    setName(p.name);
    setBio(p.bio || '');
    setAge(p.age ? String(p.age) : '');
    setGender(p.gender);
    setInterests([...p.interests]);
    setLanguages([...p.languages]);
    setVibeIntent(p.vibeIntent);
    setConversationStarters([...p.conversationStarters]);
    setFavoriteSpots([...p.favoriteSpots]);
    setPrivacy({ ...p.privacy, ghostMode: p.is_ghost ?? p.privacy.ghostMode });
  }

  function toggleInterest(interest: string) {
    setInterests((prev) => (prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]));
  }

  function toggleLanguage(langCode: string) {
    setLanguages((prev) => (prev.includes(langCode) ? prev.filter((l) => l !== langCode) : [...prev, langCode]));
  }

  function addConversationStarter() {
    if (newStarter.trim() && !conversationStarters.includes(newStarter.trim())) {
      setConversationStarters([...conversationStarters, newStarter.trim()]);
      setNewStarter('');
    }
  }

  function removeConversationStarter(starter: string) {
    setConversationStarters(conversationStarters.filter((s) => s !== starter));
  }

  function addFavoriteSpot(spot: Omit<FavoriteSpot, 'id'>) {
    const newSpot: FavoriteSpot = {
      ...spot,
      id: Math.random().toString(16).slice(2) + Date.now().toString(16),
    };
    setFavoriteSpots([...favoriteSpots, newSpot]);
  }

  function removeFavoriteSpot(spotId: string) {
    setFavoriteSpots(favoriteSpots.filter((s) => s.id !== spotId));
  }

  async function onSave() {
    if (!name.trim()) {
      Alert.alert('Ошибка', 'Имя не может быть пустым');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        bio: bio.trim() || null,
        age: age ? parseInt(age, 10) : null,
        gender,
        interests,
        languages: languages.length > 0 ? languages : ['ru'],
        vibeIntent,
        conversationStarters,
        favoriteSpots,
        privacy,
        is_ghost: privacy.ghostMode,
        ...(privacy.ghostMode ? { latitude: null, longitude: null } : {}),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Готово', 'Профиль успешно сохранён', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      console.error('Ошибка сохранения:', e);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Ошибка', 'Не удалось сохранить профиль. Попробуйте ещё раз.');
    }
    setSaving(false);
  }

  if (!profile) {
    return (
      <ThemedView style={[styles.container, { paddingTop: 16 + insets.top }]}>
        <ThemedText>Загрузка...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Редактировать профиль',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.headerBack}>
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </TouchableOpacity>
          ),
        }}
      />
    <KeyboardAvoidingView
      style={[styles.keyboardAvoid, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { paddingTop: 16 + insets.top, paddingBottom: 100 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* White Card Container */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
            Редактировать профиль
          </ThemedText>

      {/* Имя */}
      <View style={styles.field}>
        <ThemedText type="defaultSemiBold" style={[styles.fieldLabel, { color: colors.text }]}>Имя *</ThemedText>
        <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="person-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ваше имя"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.text }]}
          />
        </View>
      </View>

      {/* О себе */}
      <View style={styles.field}>
        <ThemedText type="defaultSemiBold" style={[styles.fieldLabel, { color: colors.text }]}>О себе</ThemedText>
        <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Расскажите о себе..."
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.textarea, { color: colors.text }]}
            multiline
            numberOfLines={4}
          />
        </View>
      </View>

      {/* Возраст */}
      <View style={styles.field}>
        <ThemedText type="defaultSemiBold" style={[styles.fieldLabel, { color: colors.text }]}>Возраст</ThemedText>
        <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="calendar-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            value={age}
            onChangeText={setAge}
            placeholder="25"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            style={[styles.input, { color: colors.text }]}
          />
        </View>
      </View>

      {/* Пол */}
      <View style={styles.field}>
        <ThemedText type="defaultSemiBold" style={[styles.fieldLabel, { color: colors.text }]}>Пол</ThemedText>
        <View style={styles.genderRow}>
          {(['male', 'female', 'other'] as const).map((g) => (
            <Pressable
              key={g}
              style={[styles.genderButton, { borderColor: colors.border }, gender === g && [styles.genderButtonActive, { backgroundColor: colors.accent, borderColor: colors.accent }]]}
              onPress={() => setGender(gender === g ? null : g)}>
              <ThemedText type="defaultSemiBold" style={gender === g ? [styles.genderButtonTextActive, { color: colors.card }] : { color: colors.text }}>
                {g === 'male' ? 'Мужской' : g === 'female' ? 'Женский' : 'Другое'}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Vibe/Intent */}
      <View style={styles.field}>
        <ThemedText type="defaultSemiBold" style={[styles.fieldLabel, { color: colors.text }]}>Что ищу</ThemedText>
        <View style={styles.vibeRow}>
          {VIBE_OPTIONS.map((vibe) => (
            <Pressable
              key={vibe}
              style={[styles.vibeButton, { borderColor: colors.border }, vibeIntent === vibe && [styles.vibeButtonActive, { backgroundColor: colors.accent, borderColor: colors.accent }]]}
              onPress={() => setVibeIntent(vibeIntent === vibe ? null : vibe)}>
              {vibeIntent === vibe && <VibeBadge vibe={vibe} size="small" />}
              {vibeIntent !== vibe && (
                <ThemedText style={[styles.vibeButtonText, { color: colors.textMuted }]}>
                  {vibe === 'just-coffee'
                    ? '☕'
                    : vibe === 'networking'
                      ? '🤝'
                      : vibe === 'romantic-date'
                        ? '💕'
                        : vibe === 'language-practice'
                          ? '🗣️'
                          : vibe === 'friendship'
                            ? '👫'
                            : '🌍'}
                </ThemedText>
              )}
            </Pressable>
          ))}
        </View>
        {vibeIntent && (
          <View style={styles.selectedVibe}>
            <VibeBadge vibe={vibeIntent} size="medium" />
          </View>
        )}
      </View>

      {/* Conversation Starters */}
      <View style={styles.field}>
        <ThemedText type="defaultSemiBold" style={[styles.fieldLabel, { color: colors.text }]}>Темы для разговора</ThemedText>
        <View style={[styles.startersInputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <TextInput
            value={newStarter}
            onChangeText={setNewStarter}
            placeholder="Добавить тему..."
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.starterInput, { color: colors.text }]}
            onSubmitEditing={addConversationStarter}
          />
          <Pressable style={[styles.addButton, { backgroundColor: colors.accent }]} onPress={addConversationStarter}>
            <ThemedText style={[styles.addButtonText, { color: colors.card }]}>+</ThemedText>
          </Pressable>
        </View>
        <View style={styles.startersList}>
          {conversationStarters.map((starter, idx) => (
            <View key={idx} style={[styles.starterChip, { backgroundColor: colors.border }]}>
              <ThemedText style={[styles.starterText, { color: colors.text }]}>{starter}</ThemedText>
              <Pressable onPress={() => removeConversationStarter(starter)} style={styles.removeButton}>
                <ThemedText style={[styles.removeButtonText, { color: colors.text }]}>×</ThemedText>
              </Pressable>
            </View>
          ))}
        </View>
        <View style={styles.examplesRow}>
          {CONVERSATION_STARTER_EXAMPLES.slice(0, 3).map((example, idx) => (
            <Pressable key={idx} style={[styles.exampleChip, { backgroundColor: colors.border }]} onPress={() => setNewStarter(example)}>
              <ThemedText style={[styles.exampleText, { color: colors.textMuted }]}>{example}</ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Интересы */}
      <View style={styles.field}>
        <ThemedText type="defaultSemiBold" style={[styles.fieldLabel, { color: colors.text }]}>Интересы</ThemedText>
        <View style={styles.chipsRow}>
          {INTEREST_OPTIONS.map((interest) => (
            <Pressable
              key={interest}
              style={[styles.chip, { borderColor: colors.border }, interests.includes(interest) && [styles.chipActive, { backgroundColor: colors.accent, borderColor: colors.accent }]]}
              onPress={() => toggleInterest(interest)}>
              <ThemedText type="defaultSemiBold" style={interests.includes(interest) ? [styles.chipTextActive, { color: colors.card }] : { color: colors.text }}>
                {interest}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Языки */}
      <View style={styles.field}>
        <ThemedText type="defaultSemiBold" style={[styles.fieldLabel, { color: colors.text }]}>Языки</ThemedText>
        <View style={styles.chipsRow}>
          {LANGUAGE_OPTIONS.map((lang) => (
            <Pressable
              key={lang.code}
              style={[styles.chip, { borderColor: colors.border }, languages.includes(lang.code) && [styles.chipActive, { backgroundColor: colors.accent, borderColor: colors.accent }]]}
              onPress={() => toggleLanguage(lang.code)}>
              <ThemedText type="defaultSemiBold" style={languages.includes(lang.code) ? [styles.chipTextActive, { color: colors.card }] : { color: colors.text }}>
                {lang.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Favorite Spots */}
      <View style={styles.field}>
        <ThemedText type="defaultSemiBold" style={[styles.fieldLabel, { color: colors.text }]}>Любимые места</ThemedText>
        <View style={styles.spotsList}>
          {favoriteSpots.map((spot) => (
            <View key={spot.id} style={[styles.spotItem, { backgroundColor: colors.border }]}>
              <View style={styles.spotInfo}>
                <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>{spot.name}</ThemedText>
                <ThemedText style={[styles.spotAddress, { color: colors.textMuted }]}>{spot.address}</ThemedText>
              </View>
              <Pressable onPress={() => removeFavoriteSpot(spot.id)} style={styles.removeSpotButton}>
                <ThemedText style={[styles.removeButtonText, { color: colors.text }]}>×</ThemedText>
              </Pressable>
            </View>
          ))}
        </View>
        <View style={styles.popularSpotsRow}>
          {POPULAR_SPOTS.filter((spot) => !favoriteSpots.some((fs) => fs.name === spot.name)).map((spot, idx) => (
            <Pressable key={idx} style={[styles.addSpotButton, { backgroundColor: colors.border }]} onPress={() => addFavoriteSpot(spot)}>
              <ThemedText style={[styles.addSpotText, { color: colors.text }]}>+ {spot.name}</ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Privacy Settings */}
      <View style={styles.field}>
        <ThemedText type="defaultSemiBold" style={[styles.fieldLabel, { color: colors.text }]}>Настройки приватности</ThemedText>
        <View style={styles.privacyRow}>
          <View style={styles.privacyItem}>
            <View style={styles.privacyLabel}>
              <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>👻 Режим невидимки</ThemedText>
              <ThemedText style={[styles.privacyHint, { color: colors.textMuted }]}>Скрыть меня на карте</ThemedText>
            </View>
            <Switch
              value={privacy.ghostMode}
              onValueChange={(v) => setPrivacy({ ...privacy, ghostMode: v })}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={privacy.ghostMode ? colors.card : colors.textMuted}
            />
          </View>
          <View style={styles.privacyItem}>
            <View style={styles.privacyLabel}>
              <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>📍 Точное местоположение</ThemedText>
              <ThemedText style={[styles.privacyHint, { color: colors.textMuted }]}>Показывать только приблизительное расстояние</ThemedText>
            </View>
            <Switch
              value={!privacy.showExactLocation}
              onValueChange={(v) => setPrivacy({ ...privacy, showExactLocation: !v })}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={!privacy.showExactLocation ? colors.card : colors.textMuted}
            />
          </View>
          <View style={styles.privacyItem}>
            <View style={styles.privacyLabel}>
              <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>✅ Чек-ины</ThemedText>
              <ThemedText style={[styles.privacyHint, { color: colors.textMuted }]}>Разрешить чек-ины в местах</ThemedText>
            </View>
            <Switch
              value={privacy.allowCheckIns}
              onValueChange={(v) => setPrivacy({ ...privacy, allowCheckIns: v })}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={privacy.allowCheckIns ? colors.card : colors.textMuted}
            />
          </View>
        </View>
      </View>

        </View>
        {/* End Card */}

        {/* Floating Save Button */}
        <View style={[styles.saveButtonWrap, { paddingBottom: 20 + insets.bottom }]}>
          <Pressable
            style={[styles.saveButton, { backgroundColor: colors.accent }, (!name.trim() || saving) && styles.saveButtonDisabled]}
            disabled={!name.trim() || saving}
            onPress={onSave}>
            <ThemedText type="defaultSemiBold" style={[styles.saveButtonText, { color: colors.card }]}>
              {saving ? 'Сохранение...' : 'Save Changes'}
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFF5F0',
  },
  content: {
    padding: 16,
    gap: 20,
  },
  headerBack: {
    padding: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
    gap: 20,
  },
  title: {
    marginBottom: 4,
    color: '#2D1B3D',
    fontSize: 22,
  },
  field: {
    gap: 10,
  },
  fieldLabel: {
    color: '#2D1B3D',
    fontSize: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 0,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 0,
    fontSize: 16,
    color: '#2D1B3D',
    backgroundColor: 'transparent',
  },
  textarea: {
    minHeight: 90,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  saveButtonWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  saveButton: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: '#FF9F66',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
  },
  genderButtonActive: {
    backgroundColor: '#FFE5D4',
  },
  genderButtonTextActive: {
    color: '#FF6B35',
  },
  vibeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  vibeButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5E6E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vibeButtonActive: {
    backgroundColor: '#FFE5D4',
    borderWidth: 2,
    borderColor: '#FF9F66',
  },
  vibeButtonText: {
    fontSize: 20,
  },
  selectedVibe: {
    marginTop: 8,
  },
  startersInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  starterInput: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FF9F66',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  startersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  starterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFF0E6',
  },
  starterText: {
    fontSize: 13,
    color: '#FF6B35',
  },
  removeButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF9F66',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  examplesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  exampleChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F5E6E0',
  },
  exampleText: {
    fontSize: 11,
    color: '#8B7A9B',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  chipActive: {
    backgroundColor: '#FFE5D4',
  },
  chipTextActive: {
    color: '#FF6B35',
  },
  spotsList: {
    gap: 10,
    marginBottom: 10,
  },
  spotItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F5E6E0',
  },
  spotInfo: {
    flex: 1,
    gap: 4,
  },
  spotAddress: {
    fontSize: 12,
    color: '#8B7A9B',
  },
  removeSpotButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF9F66',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popularSpotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  addSpotButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFE5D4',
  },
  addSpotText: {
    fontSize: 13,
    color: '#FF6B35',
  },
  privacyRow: {
    gap: 16,
  },
  privacyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  privacyLabel: {
    flex: 1,
    gap: 4,
  },
  privacyHint: {
    fontSize: 12,
    color: '#8B7A9B',
  },
});
