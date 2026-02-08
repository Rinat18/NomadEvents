import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { uploadImage } from '@/lib/image-upload';
import { upsertProfile } from '@/lib/local-profile';
import { useTheme } from '@/lib/theme';

const VIBE_PLACEHOLDER = 'Например: кофе, нетворкинг, путешествия';

export default function CreateProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [avatarUri, setAvatarUri] = React.useState<string | null>(null);
  const [displayName, setDisplayName] = React.useState('');
  const [vibe, setVibe] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Доступ', 'Разрешите доступ к фото для выбора аватара.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    setUploadingAvatar(true);
    try {
      const url = await uploadImage(result.assets[0].uri);
      if (url) setAvatarUri(url);
      else Alert.alert('Ошибка', 'Не удалось загрузить фото.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleComplete() {
    const name = displayName.trim();
    if (!name) {
      Alert.alert('Нужно имя', 'Введите отображаемое имя.');
      return;
    }

    setSaving(true);
    try {
      await upsertProfile({
        name,
        avatar_url: avatarUri,
        vibe: vibe.trim() || null,
      });
      router.replace('/(tabs)');
    } catch (e) {
      console.error('Create profile error:', e);
      Alert.alert('Ошибка', 'Не удалось сохранить профиль. Попробуйте снова.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
        Создай свой паспорт
      </ThemedText>
      <ThemedText style={[styles.subtitle, { color: colors.textMuted }]}>
        Заполни профиль, чтобы другие могли тебя найти
      </ThemedText>

      <Pressable
        onPress={pickAvatar}
        style={styles.avatarWrap}
        disabled={uploadingAvatar}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.border, borderColor: colors.accent }]}>
            {uploadingAvatar ? (
              <ActivityIndicator size="large" color={colors.accent} />
            ) : (
              <>
                <Ionicons name="camera" size={48} color={colors.textMuted} />
                <ThemedText style={[styles.avatarHint, { color: colors.textMuted }]}>Добавить фото</ThemedText>
              </>
            )}
          </View>
        )}
      </Pressable>

      <View style={styles.field}>
        <ThemedText type="defaultSemiBold" style={[styles.label, { color: colors.text }]}>
          Display Name
        </ThemedText>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Как к тебе обращаться"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          autoCorrect={false}
          editable={!saving}
        />
      </View>

      <View style={styles.field}>
        <ThemedText type="defaultSemiBold" style={[styles.label, { color: colors.text }]}>
          Your Vibe
        </ThemedText>
        <TextInput
          value={vibe}
          onChangeText={setVibe}
          placeholder={VIBE_PLACEHOLDER}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.inputMultiline, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          multiline
          numberOfLines={2}
          editable={!saving}
        />
      </View>

      <Pressable
        style={[styles.submitButton, { backgroundColor: colors.accent }, saving && styles.submitButtonDisabled]}
        onPress={handleComplete}
        disabled={saving}>
        {saving ? (
          <ActivityIndicator color={colors.card} />
        ) : (
          <ThemedText type="defaultSemiBold" style={[styles.submitButtonText, { color: colors.card }]}>
            Complete Setup
          </ThemedText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  title: { fontSize: 28, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 32 },
  avatarWrap: { alignSelf: 'center', marginBottom: 24 },
  avatarImage: { width: 120, height: 120, borderRadius: 60 },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderStyle: 'dashed',
  },
  avatarHint: { fontSize: 12, marginTop: 8 },
  field: { marginBottom: 20 },
  label: { fontSize: 14, marginBottom: 8 },
  input: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  submitButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    minHeight: 52,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { fontSize: 16 },
});
