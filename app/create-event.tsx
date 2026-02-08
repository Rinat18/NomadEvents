import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getEmojiFromPlace, reverseGeocode } from '@/lib/geocoding';
import { createEvent } from '@/lib/local-events';
import { getOrCreateLocalUserId } from '@/lib/local-user';
import { useTheme } from '@/lib/theme';

const EMOJI_OPTIONS = [
  '📍', // Default
  '☕', // Coffee
  '🍷', // Wine/Bar
  '🌳', // Park
  '🏋️', // Gym
  '💻', // Work
  '🍽️', // Restaurant
  '🎵', // Music
  '🎨', // Art
  '🗣️', // Language
  '💕', // Date
  '🤝', // Networking
  '🏃', // Sports
  '🎬', // Cinema
  '📚', // Books
  '🎮', // Games
];

export default function CreateEventScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { lat, lng } = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [meetingPlace, setMeetingPlace] = React.useState('');
  const [placeName, setPlaceName] = React.useState('');
  const [placeCategory, setPlaceCategory] = React.useState<string | null>(null);
  const [emoji, setEmoji] = React.useState('📍');
  const [meetingLat, setMeetingLat] = React.useState(typeof lat === 'string' ? lat : '');
  const [meetingLng, setMeetingLng] = React.useState(typeof lng === 'string' ? lng : '');
  const [saving, setSaving] = React.useState(false);
  const [loadingPlace, setLoadingPlace] = React.useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  /** Require Approval (Face Control): creator must approve guests before they join */
  const [requireApproval, setRequireApproval] = React.useState(false);

  // Auto-fetch place when coordinates are provided
  React.useEffect(() => {
    const parsedLat = meetingLat.trim() ? Number(meetingLat.trim().replace(',', '.')) : null;
    const parsedLng = meetingLng.trim() ? Number(meetingLng.trim().replace(',', '.')) : null;

    if (parsedLat && parsedLng && Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
      setLoadingPlace(true);
      reverseGeocode(parsedLng, parsedLat)
        .then((result) => {
          if (result) {
            setPlaceName(result.place_name);
            setPlaceCategory(result.category);
            const detectedEmoji = getEmojiFromPlace(result.category, result.place_name);
            setEmoji(detectedEmoji);
            // Auto-fill meeting place if empty
            if (!meetingPlace.trim()) {
              setMeetingPlace(result.place_name);
            }
          }
        })
        .catch((error) => {
          console.error('Failed to fetch place:', error);
        })
        .finally(() => {
          setLoadingPlace(false);
        });
    }
  }, [meetingLat, meetingLng]);

  const canSave = title.trim().length >= 3 && !saving;

  const parsedLat = meetingLat.trim() ? Number(meetingLat.trim().replace(',', '.')) : null;
  const parsedLng = meetingLng.trim() ? Number(meetingLng.trim().replace(',', '.')) : null;
  const coordsValid =
    (parsedLat === null && parsedLng === null) ||
    (Number.isFinite(parsedLat) && Number.isFinite(parsedLng));

  async function onCreate() {
    if (!canSave) return;
    setSaving(true);
    
    // Get current user ID as creator
    const creatorId = await getOrCreateLocalUserId();
    
    const ev = await createEvent({
      title: title.trim(),
      description: description.trim() ? description.trim() : null,
      meeting_place: meetingPlace.trim() ? meetingPlace.trim() : null,
      meeting_lat: parsedLat && Number.isFinite(parsedLat) ? parsedLat : null,
      meeting_lng: parsedLng && Number.isFinite(parsedLng) ? parsedLng : null,
      emoji: emoji,
      place_name: placeName || meetingPlace.trim() || '',
      place_category: placeCategory,
      creator_id: creatorId,
      auto_accept: !requireApproval, // false = require approval
    });
    setSaving(false);
    router.back();
    router.push({ pathname: '/event/[id]', params: { id: ev.id } });
  }

  const inputStyle = [styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }];

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background, paddingTop: 16 + insets.top }]}>
      <ThemedText type="title">Создать ивент</ThemedText>

      <ThemedView style={styles.field}>
        <ThemedText type="defaultSemiBold">Название</ThemedText>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Например: Прогулка в парке"
          placeholderTextColor={colors.textMuted}
          style={inputStyle}
          autoCorrect={false}
        />
      </ThemedView>

      <ThemedView style={styles.field}>
        <ThemedText type="defaultSemiBold">Описание</ThemedText>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Коротко: где/когда/что берем с собой"
          placeholderTextColor={colors.textMuted}
          style={[inputStyle, styles.textarea]}
          multiline
        />
      </ThemedView>

      {/* Meeting Point Section */}
      <ThemedView style={styles.field}>
        <ThemedText type="defaultSemiBold">Meeting Point</ThemedText>
        <View style={styles.meetingPointRow}>
          <Pressable style={[styles.emojiButton, { backgroundColor: colors.border, borderColor: colors.accent }]} onPress={() => setShowEmojiPicker(true)}>
            <ThemedText style={styles.emojiButtonText}>{emoji}</ThemedText>
          </Pressable>
          <TextInput
            value={meetingPlace}
            onChangeText={setMeetingPlace}
            placeholder={loadingPlace ? 'Загрузка места...' : 'Название места (например: Sierra Coffee)'}
            placeholderTextColor={colors.textMuted}
            style={[inputStyle, styles.placeInput]}
            autoCorrect={false}
          />
        </View>
        {loadingPlace && (
          <ThemedText style={[styles.loadingText, { color: colors.textMuted }]}>Определяем место...</ThemedText>
        )}
        {placeName && !loadingPlace && (
          <ThemedText style={[styles.placeHint, { color: colors.textMuted }]}>Найдено: {placeName}</ThemedText>
        )}
      </ThemedView>

      <ThemedView style={styles.field}>
        <ThemedText type="defaultSemiBold">Координаты точки (опционально)</ThemedText>
        <ThemedView style={styles.coordsRow}>
          <TextInput
            value={meetingLat}
            onChangeText={setMeetingLat}
            placeholder="lat"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            style={[inputStyle, styles.coordInput]}
          />
          <TextInput
            value={meetingLng}
            onChangeText={setMeetingLng}
            placeholder="lng"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            style={[inputStyle, styles.coordInput]}
          />
        </ThemedView>
        {!coordsValid ? (
          <ThemedText style={styles.warn}>Координаты должны быть числами (или оставь пустыми).</ThemedText>
        ) : null}
      </ThemedView>

      {/* Require Approval (Face Control) */}
      <ThemedView style={styles.field}>
        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <ThemedText type="defaultSemiBold">Face Control (одобрение гостей)</ThemedText>
            <ThemedText style={[styles.switchHint, { color: colors.textMuted }]}>Проверять гостей перед тем, как они смогут присоединиться.</ThemedText>
          </View>
          <Switch
            value={requireApproval}
            onValueChange={setRequireApproval}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={requireApproval ? colors.card : colors.textMuted}
          />
        </View>
      </ThemedView>

      <Pressable
        style={[styles.button, { backgroundColor: colors.accent }, !canSave ? styles.buttonDisabled : null]}
        disabled={!canSave}
        onPress={onCreate}>
        <ThemedText type="defaultSemiBold" style={{ color: colors.card }}>{saving ? 'Создаю…' : 'Создать'}</ThemedText>
      </Pressable>

      <ThemedText style={[styles.hint, { color: colors.textMuted }]}>
        Сейчас ивенты сохраняются локально (для 1 пользователя). Позже подключим "общие" ивенты по
        серверу и добавим выбор точки на карте.
      </ThemedText>

      {/* Emoji Picker Modal */}
      <Modal
        visible={showEmojiPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmojiPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowEmojiPicker(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <ThemedText type="defaultSemiBold" style={[styles.modalTitle, { color: colors.text }]}>
              Выбери эмодзи
            </ThemedText>
            <ScrollView contentContainerStyle={styles.emojiGrid}>
              {EMOJI_OPTIONS.map((emojiOption) => (
                <Pressable
                  key={emojiOption}
                  style={[
                    styles.emojiOption,
                    { backgroundColor: colors.background },
                    emoji === emojiOption && { borderColor: colors.accent, backgroundColor: colors.border },
                  ]}
                  onPress={() => {
                    setEmoji(emojiOption);
                    setShowEmojiPicker(false);
                  }}>
                  <ThemedText style={styles.emojiOptionText}>{emojiOption}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 14,
  },
  field: {
    gap: 8,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  meetingPointRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  emojiButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFE5D4',
    borderWidth: 2,
    borderColor: '#FF9F66',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiButtonText: {
    fontSize: 28,
  },
  placeInput: {
    flex: 1,
  },
  loadingText: {
    fontSize: 12,
    color: '#8B7A9B',
    fontStyle: 'italic',
  },
  placeHint: {
    fontSize: 12,
    color: '#8B7A9B',
  },
  coordsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  coordInput: {
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  switchLabel: {
    flex: 1,
    gap: 4,
    marginRight: 12,
  },
  switchHint: {
    fontSize: 12,
    color: '#8B7A9B',
  },
  warn: {
    opacity: 0.8,
  },
  textarea: {
    minHeight: 90,
  },
  button: {
    marginTop: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#FF9F66',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  hint: {
    opacity: 0.7,
  },
  // Emoji Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    color: '#2D1B3D',
    marginBottom: 16,
    textAlign: 'center',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  emojiOption: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF5F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiOptionSelected: {
    borderColor: '#FF9F66',
    backgroundColor: '#FFE5D4',
  },
  emojiOptionText: {
    fontSize: 28,
  },
});
