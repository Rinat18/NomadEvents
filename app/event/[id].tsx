import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { uploadEventImage, uploadImage } from '@/lib/image-upload';
import {
    addMessage,
    deleteEvent,
    getEventById,
    getEventParticipantsWithStatus,
    getMyParticipantStatus,
    joinEvent,
    listMessages,
    updateEvent,
    updateParticipantStatus,
    type LocalEvent,
    type LocalMessage,
    type ParticipantStatus,
} from '@/lib/local-events';
import { getProfile } from '@/lib/local-profile';
import { getOrCreateLocalUserId } from '@/lib/local-user';
import { useTheme } from '@/lib/theme';
import EmojiKeyboard from 'rn-emoji-keyboard';

type ChatRow =
  | { type: 'sep'; id: string; label: string }
  | { type: 'msg'; id: string; msg: LocalMessage };

function formatEventDate(createdAt: string): string {
  const d = new Date(createdAt);
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const HEADER_MIN_HEIGHT = 56;
const AVATAR_SIZE = 32;
const AVATAR_OVERLAP = -10;
const TG_HEADER_AVATAR = 36;

export default function EventDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const eventId = typeof id === 'string' ? id : '';
  const headerHeight = insets.top + HEADER_MIN_HEIGHT;
  const bubbleImageSize = Math.min(200, Math.round(winWidth * 0.55));

  const [event, setEvent] = React.useState<LocalEvent | null>(null);
  const [messages, setMessages] = React.useState<LocalMessage[]>([]);
  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [myUserId, setMyUserId] = React.useState<string | null>(null);
  const [myParticipantStatus, setMyParticipantStatus] = React.useState<ParticipantStatus | null>(null);
  const [participantsWithStatus, setParticipantsWithStatus] = React.useState<
    Array<{ id: string; name: string; avatar_url: string | null; vibe: string | null; status: ParticipantStatus }>
  >([]);
  const [joinLoading, setJoinLoading] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const listRef = React.useRef<FlatList<ChatRow> | null>(null);

  const [isEditing, setIsEditing] = React.useState(false);
  const [editForm, setEditForm] = React.useState<{ title: string; description: string; imageUrl: string | null }>({
    title: '',
    description: '',
    imageUrl: null,
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const [uploadingCover, setUploadingCover] = React.useState(false);

  const goingParticipants = React.useMemo(
    () => participantsWithStatus.filter((p) => p.status === 'approved'),
    [participantsWithStatus]
  );
  const displayAvatars = goingParticipants.slice(0, 4);
  const extraCount = goingParticipants.length > 4 ? goingParticipants.length - 4 : 0;

  const load = React.useCallback(async () => {
    if (!eventId) return;
    setError(null);
    try {
      const [ev, msgs, uid] = await Promise.all([
        getEventById(eventId),
        listMessages(eventId),
        getOrCreateLocalUserId(),
      ]);
      setEvent(ev);
      setMessages(msgs);
      setMyUserId(uid);
      if (uid) {
        const [status, participants] = await Promise.all([
          getMyParticipantStatus(eventId, uid),
          getEventParticipantsWithStatus(eventId),
        ]);
        setMyParticipantStatus(status);
        setParticipantsWithStatus(participants);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    }
  }, [eventId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function onSend() {
    const body = text.trim();
    if (!body || !eventId || sending) return;
    setSending(true);
    const userId = await getOrCreateLocalUserId();
    try {
      const profile = await getProfile();
      const msg = await addMessage({
        event_id: eventId,
        user_id: userId,
        body,
        author: {
          name: profile.name || 'Guest',
          avatar_url: profile.photos?.[0] ?? null,
          vibe: profile.vibeIntent ?? null,
        },
      });
      setMessages((prev) => [...prev, msg]);
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка отправки');
    }
    setSending(false);
  }

  function isImageUrl(body: string): boolean {
    const t = body.trim().toLowerCase();
    if (!(t.startsWith('http://') || t.startsWith('https://'))) return false;
    return (
      t.endsWith('.jpg') ||
      t.endsWith('.jpeg') ||
      t.endsWith('.png') ||
      t.includes('.jpg?') ||
      t.includes('.jpeg?') ||
      t.includes('.png?')
    );
  }

  async function handlePickImage() {
    try {
      Keyboard.dismiss();
      setIsEmojiOpen(false);

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Доступ к фото', 'Разреши доступ к галерее, чтобы отправлять фото.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
        allowsEditing: false,
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert('Ошибка', 'Не удалось получить изображение.');
        return;
      }

      setUploading(true);
      const url = await uploadImage(asset.uri);
      if (!url) {
        Alert.alert('Ошибка', 'Не удалось загрузить фото.');
        return;
      }

      const userId = await getOrCreateLocalUserId();
      const profile = await getProfile();
      const msg = await addMessage({
        event_id: eventId,
        user_id: userId,
        body: url,
        author: {
          name: profile.name || 'Guest',
          avatar_url: profile.photos?.[0] ?? null,
          vibe: profile.vibeIntent ?? null,
        },
      });
      setMessages((prev) => [...prev, msg]);
    } catch (e) {
      console.error('Pick/upload image error:', e);
      Alert.alert('Ошибка', 'Не удалось отправить фото.');
    } finally {
      setUploading(false);
    }
  }

  function dateKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function dateLabel(d: Date) {
    const now = new Date();
    const todayKey = dateKey(now);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const k = dateKey(d);
    if (k === todayKey) return 'Today';
    if (k === dateKey(yesterday)) return 'Yesterday';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }

  const rows: ChatRow[] = React.useMemo(() => {
    const out: ChatRow[] = [];
    let lastDay: string | null = null;
    for (const m of messages) {
      const d = new Date(m.created_at);
      const k = dateKey(d);
      if (k !== lastDay) {
        out.push({ type: 'sep', id: `sep:${k}`, label: dateLabel(d) });
        lastDay = k;
      }
      out.push({ type: 'msg', id: `msg:${m.id}`, msg: m });
    }
    return out;
  }, [messages]);

  const rowsReversed = React.useMemo(() => [...rows].reverse(), [rows]);

  const isCreator = myUserId && event?.creator_id && myUserId === event.creator_id;

  const handleDelete = React.useCallback(() => {
    Alert.alert(
      'Удалить ивент?',
      'Это действие нельзя отменить.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await deleteEvent(eventId);
              router.replace('/(tabs)/explore');
            } catch (e) {
              Alert.alert('Ошибка', 'Не удалось удалить ивент');
            }
          },
        },
      ]
    );
  }, [eventId]);

  const hasText = text.trim().length > 0;

  async function handleCopyLink() {
    const link = `nomadtable://event/${eventId}`;
    try {
      await Share.share({
        message: link,
        title: event?.title ?? 'Event',
      });
    } catch {
      Alert.alert('Link', link, [{ text: 'OK' }]);
    }
  }

  function startEditing() {
    if (!event) return;
    setEditForm({
      title: event.title,
      description: event.description ?? '',
      imageUrl: event.cover_image_url ?? null,
    });
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditForm({ title: '', description: '', imageUrl: null });
  }

  async function handleSaveEvent() {
    if (!event || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const nextTitle = editForm.title.trim() || event.title;
      const nextDescription = editForm.description.trim() || null;

      await updateEvent(eventId, {
        title: nextTitle,
        description: nextDescription,
        cover_image_url: editForm.imageUrl,
      });

      // Optimistically update local event so UI reflects changes immediately
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              title: nextTitle,
              description: nextDescription,
              cover_image_url: editForm.imageUrl ?? prev.cover_image_url ?? null,
            }
          : prev
      );

      setIsEditing(false);
      setEditForm({ title: '', description: '', imageUrl: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
    setIsSaving(false);
  }

  async function pickAndUploadImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission', 'Allow access to photos to set a cover image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    setUploadingCover(true);
    try {
      const url = await uploadEventImage(result.assets[0].uri);
      if (url) setEditForm((prev) => ({ ...prev, imageUrl: url }));
      else Alert.alert('Error', 'Failed to upload image.');
    } catch {
      Alert.alert('Error', 'Failed to upload image.');
    } finally {
      setUploadingCover(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={[styles.safe, { width: winWidth, backgroundColor: colors.background }]} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + HEADER_MIN_HEIGHT + 24 : 0}>
          {/* Telegram-style Header: Back | Title+Subtitle (tap -> details) | Avatar */}
          <View style={[styles.tgHeader, { paddingTop: 8, backgroundColor: colors.background }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.tgHeaderBack}
              activeOpacity={0.8}>
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tgHeaderCenter}
              onPress={() => setShowDetails(true)}
              activeOpacity={0.8}>
              <Text style={[styles.tgTitle, { color: colors.text }]} numberOfLines={1}>
                {event?.title ?? 'Event'}
              </Text>
              <Text style={[styles.tgSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {goingParticipants.length} participants
              </Text>
            </TouchableOpacity>

            <View style={styles.tgHeaderRight}>
              {goingParticipants[0]?.avatar_url ? (
                <Image source={{ uri: goingParticipants[0].avatar_url }} style={styles.tgHeaderAvatar} />
              ) : (
                <View style={styles.tgHeaderAvatarPlaceholder}>
                  <Text style={styles.tgHeaderAvatarEmoji}>{event?.emoji ?? '📍'}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Message List (inverted) */}
          <FlatList
            ref={(r) => {
              (listRef as React.MutableRefObject<FlatList<ChatRow> | null>).current = r;
            }}
            data={rowsReversed}
            keyExtractor={(r) => r.id}
            inverted
            style={styles.chatList}
            contentContainerStyle={[styles.chatContent, { paddingBottom: 12 }]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              if (item.type === 'sep') {
                return (
                  <View style={styles.sepWrap}>
                    <View style={styles.sepPill}>
                      <Text style={[styles.sepText, { color: colors.textMuted }]}>{item.label}</Text>
                    </View>
                  </View>
                );
              }

              const msg = item.msg;
              const mine = myUserId != null && msg.user_id === myUserId;
              const isImg = isImageUrl(msg.body);

              const handleAvatarPress = () => {
                router.push({
                  pathname: '/user/[id]',
                  params: {
                    id: msg.user_id,
                    name: msg.author.name,
                    avatar: msg.author.avatar_url || '',
                    vibe: msg.author.vibe || 'just-coffee',
                  },
                });
              };

              return (
                <View style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowOther]}>
                  {!mine ? (
                    <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.7}>
                      <View style={styles.avatarContainer}>
                        {msg.author.avatar_url ? (
                          <Image source={{ uri: msg.author.avatar_url }} style={styles.avatar} />
                        ) : (
                          <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarPlaceholderText}>
                              {msg.author.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  ) : null}
                  <View style={styles.msgContent}>
                    {!mine ? (
                      <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.7}>
                        <Text style={[styles.sender, { color: colors.textMuted }]}>{msg.author.name}</Text>
                      </TouchableOpacity>
                    ) : null}
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther, !mine && { backgroundColor: colors.card }]}>
                      {mine ? (
                        <LinearGradient
                          colors={['#FF9F66', '#FF8C50']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.bubbleGradient}>
                          {isImg ? (
                            <Image
                              source={{ uri: msg.body }}
                              style={[styles.bubbleImage, { width: bubbleImageSize, height: bubbleImageSize }]}
                            />
                          ) : (
                            <Text style={styles.bubbleTextMine}>{msg.body}</Text>
                          )}
                          <View style={styles.bubbleMeta}>
                            <Text style={styles.bubbleTimeMine}>
                              {new Date(msg.created_at).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>
                            <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.9)" />
                          </View>
                        </LinearGradient>
                      ) : (
                        <>
                          {isImg ? (
                            <Image
                              source={{ uri: msg.body }}
                              style={[styles.bubbleImage, { width: bubbleImageSize, height: bubbleImageSize }]}
                            />
                          ) : (
                            <Text style={[styles.bubbleTextOther, { color: colors.text }]}>{msg.body}</Text>
                          )}
                          <View style={styles.bubbleMeta}>
                            <Text style={[styles.bubbleTimeOther, { color: colors.textMuted }]}>
                              {new Date(msg.created_at).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>
                          </View>
                        </>
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
          />

          {/* Advanced Input Bar */}
          <View style={[styles.inputBar, { paddingBottom: 10 + insets.bottom, backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.attachButton, !uploading && !sending && styles.attachButtonActive]}
              onPress={handlePickImage}
              disabled={sending || uploading}>
              {uploading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="add" size={26} color={uploading || sending ? colors.textMuted : colors.text} />
              )}
            </TouchableOpacity>

            <View style={[styles.inputWrapper, { backgroundColor: colors.background }]}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Message…"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { color: colors.text }]}
                multiline
                maxLength={2000}
              />
              <TouchableOpacity
                style={styles.emojiButton}
                onPress={() => {
                  Keyboard.dismiss();
                  setIsEmojiOpen((v) => !v);
                }}>
                <Ionicons name="happy-outline" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.sendButton, hasText && !sending && styles.sendButtonActive]}
              onPress={onSend}
              disabled={!hasText || sending}>
              {sending ? (
                <Text style={[styles.sendButtonText, { color: colors.textMuted }]}>…</Text>
              ) : (
                <Ionicons
                  name="send"
                  size={20}
                  color={hasText ? '#FFFFFF' : colors.textMuted}
                />
              )}
            </TouchableOpacity>
          </View>

          <EmojiKeyboard
            open={isEmojiOpen}
            onClose={() => setIsEmojiOpen(false)}
            onEmojiSelected={(e) => setText((prev) => prev + e.emoji)}
            enableSearchBar
            theme={{
              backdrop: 'transparent',
              knob: colors.textMuted,
              container: colors.card,
              header: colors.card,
              category: { icon: colors.textMuted, iconActive: colors.accent },
              search: {
                background: colors.card,
                text: colors.text,
                placeholder: colors.textMuted,
                icon: colors.textMuted,
              },
            }}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Event Details Modal (Telegram Group Info style) */}
      <Modal
        visible={showDetails}
        animationType="slide"
        onRequestClose={() => setShowDetails(false)}>
        <View style={[styles.detailsModalRoot, { paddingTop: insets.top, backgroundColor: colors.background }]}>
          {/* Top bar: Close (left); Edit / Cancel+Save (right, creator only) */}
          <View style={styles.detailsModalBar}>
            <TouchableOpacity
              onPress={() => {
                if (isEditing) cancelEditing();
                setShowDetails(false);
              }}
              style={styles.detailsModalClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            {isCreator && (
              <View style={styles.detailsModalBarRight}>
                {!isEditing ? (
                  <TouchableOpacity onPress={startEditing} style={styles.detailsModalBarBtn} hitSlop={12}>
                    <Ionicons name="pencil" size={24} color={colors.text} />
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity onPress={cancelEditing} style={styles.detailsModalBarBtn} hitSlop={12}>
                      <Ionicons name="close-circle-outline" size={24} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSaveEvent}
                      disabled={isSaving}
                      style={styles.detailsModalBarBtn}
                      hitSlop={12}>
                      {isSaving ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>

          <ScrollView
            style={styles.detailsModalScroll}
            contentContainerStyle={[styles.detailsModalContent, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}>
            {/* Hero: Cover image or placeholder; in edit mode touchable + overlay + camera */}
            {(() => {
              const coverUrl = isEditing ? editForm.imageUrl : (event?.cover_image_url ?? null);
              const heroContent = coverUrl ? (
                <Image source={{ uri: coverUrl }} style={styles.detailsHeroImage} resizeMode="cover" />
              ) : (
                <View style={styles.detailsHeroPlaceholder}>
                  <Text style={styles.detailsHeroEmoji}>{event?.emoji ?? '📍'}</Text>
                  <Text style={[styles.detailsHeroTitle, { color: colors.text }]} numberOfLines={2}>
                    {isEditing ? editForm.title || 'Event' : event?.title ?? 'Event'}
                  </Text>
                </View>
              );
              const wrapped = isEditing ? (
                <TouchableOpacity
                  style={styles.detailsHeroTouchable}
                  onPress={pickAndUploadImage}
                  disabled={uploadingCover}
                  activeOpacity={0.9}>
                  {heroContent}
                  <View style={styles.detailsHeroOverlay}>
                    {uploadingCover ? (
                      <ActivityIndicator size="large" color="#FFF" />
                    ) : (
                      <Ionicons name="camera" size={36} color="#FFF" />
                    )}
                  </View>
                </TouchableOpacity>
              ) : (
                heroContent
              );
              return (
                <View style={[styles.detailsHero, { backgroundColor: colors.card }]}>
                  {wrapped}
                </View>
              );
            })()}

            {/* Info: Title & Date, Location, Description (editable when isEditing) */}
            <View style={[styles.detailsInfoBlock, { backgroundColor: colors.card }]}>
              {isEditing ? (
                <>
                  <TextInput
                    value={editForm.title}
                    onChangeText={(t) => setEditForm((prev) => ({ ...prev, title: t }))}
                    placeholder="Event title"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.detailsEditTitle, { color: colors.text, borderColor: colors.border }]}
                  />
                  <TextInput
                    value={editForm.description}
                    onChangeText={(t) => setEditForm((prev) => ({ ...prev, description: t }))}
                    placeholder="Description (optional)"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    style={[styles.detailsEditDesc, { color: colors.text, borderColor: colors.border }]}
                  />
                </>
              ) : (
                <Text style={[styles.detailsInfoTitle, { color: colors.text }]}>{event?.title ?? 'Event'}</Text>
              )}
              <View style={styles.detailsInfoRow}>
                <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
                <Text style={[styles.detailsInfoText, { color: colors.text }]}>{event ? formatEventDate(event.created_at) : '—'}</Text>
              </View>
              <Pressable
                style={styles.detailsInfoRow}
                onPress={() => {
                  if (event?.meeting_lat != null && event?.meeting_lng != null) {
                    Linking.openURL(
                      `https://2gis.kg/bishkek?m=${encodeURIComponent(`${event.meeting_lng},${event.meeting_lat}/16`)}`
                    );
                  }
                }}>
                <Ionicons name="location-outline" size={18} color={colors.accent} />
                <Text style={[styles.detailsInfoText, { color: colors.text }]} numberOfLines={2}>
                  {event?.meeting_place ?? event?.place_name ?? '—'}
                </Text>
                {(event?.meeting_lat != null && event?.meeting_lng != null) && (
                  <Text style={[styles.detailsInfoLink, { color: colors.accent }]}>Open in maps</Text>
                )}
              </Pressable>
              {!isEditing && event?.description ? (
                <Text style={[styles.detailsDesc, { color: colors.textMuted }]}>{event.description}</Text>
              ) : null}
            </View>

            {/* Action buttons: Copy Link, Edit (if creator) */}
            <View style={styles.detailsActionsRow}>
              <TouchableOpacity style={[styles.detailsActionBtn, { backgroundColor: colors.card }]} onPress={handleCopyLink} activeOpacity={0.8}>
                <Ionicons name="link" size={20} color={colors.text} />
                <Text style={[styles.detailsActionBtnText, { color: colors.text }]}>Copy Link</Text>
              </TouchableOpacity>
              {isCreator && !isEditing && (
                <TouchableOpacity
                  style={[styles.detailsActionBtn, { backgroundColor: colors.card }]}
                  onPress={startEditing}
                  activeOpacity={0.8}>
                  <Ionicons name="pencil" size={20} color={colors.text} />
                  <Text style={[styles.detailsActionBtnText, { color: colors.text }]}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Members */}
            <View style={styles.detailsMembersSection}>
              <Text style={[styles.detailsMembersTitle, { color: colors.text }]}>Members</Text>
              {participantsWithStatus.length === 0 ? (
                <Text style={[styles.detailsMembersEmpty, { color: colors.textMuted }]}>No participants yet</Text>
              ) : (
                participantsWithStatus
                  .filter((p) => p.status === 'approved' || p.status === 'pending')
                  .map((p) => (
                    <View key={p.id} style={[styles.detailsMemberRow, { backgroundColor: colors.card }]}>
                      {p.avatar_url ? (
                        <Image source={{ uri: p.avatar_url }} style={styles.detailsMemberAvatar} />
                      ) : (
                        <View style={styles.detailsMemberAvatarPlaceholder}>
                          <Text style={styles.detailsMemberAvatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <Text style={[styles.detailsMemberName, { color: colors.text }]}>{p.name}</Text>
                      {p.status === 'pending' && (
                        <View style={[styles.detailsMemberBadge, { backgroundColor: colors.border }]}>
                          <Text style={[styles.detailsMemberBadgeText, { color: colors.textMuted }]}>Pending</Text>
                        </View>
                      )}
                      {isCreator && p.status === 'pending' && (
                        <View style={styles.detailsMemberActions}>
                          <TouchableOpacity
                            style={styles.detailsAcceptBtn}
                            onPress={async () => {
                              try {
                                await updateParticipantStatus(eventId, p.id, 'approved');
                                await load();
                              } catch (e) {
                                setError(e instanceof Error ? e.message : 'Ошибка');
                              }
                            }}>
                            <Text style={styles.detailsAcceptBtnText}>Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.detailsDeclineBtn}
                            onPress={async () => {
                              try {
                                await updateParticipantStatus(eventId, p.id, 'rejected');
                                await load();
                              } catch (e) {
                                setError(e instanceof Error ? e.message : 'Ошибка');
                              }
                            }}>
                            <Text style={styles.detailsDeclineBtnText}>Decline</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ))
              )}
            </View>

            {/* Join / Status for non-creator */}
            {event && myUserId && !isCreator && (
                <View style={styles.joinSection}>
                  {myParticipantStatus === null && (
                    <Pressable
                      style={[styles.joinButton, joinLoading && styles.joinButtonDisabled]}
                      onPress={async () => {
                        setJoinLoading(true);
                        try {
                          await joinEvent(eventId, myUserId);
                          await load();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : 'Ошибка');
                        }
                        setJoinLoading(false);
                      }}
                      disabled={joinLoading}>
                      <ThemedText type="defaultSemiBold" style={styles.joinButtonText}>
                        {joinLoading ? '…' : event.auto_accept ? 'Join' : 'Request to Join'}
                      </ThemedText>
                    </Pressable>
                  )}
                  {myParticipantStatus === 'pending' && (
                    <View style={styles.statusBadge}>
                      <ThemedText type="defaultSemiBold" style={styles.statusBadgeText}>Request Sent ⏳</ThemedText>
                    </View>
                  )}
                  {myParticipantStatus === 'rejected' && (
                    <View style={[styles.statusBadge, styles.statusBadgeRejected]}>
                      <ThemedText type="defaultSemiBold" style={styles.statusBadgeTextRejected}>Declined 🚫</ThemedText>
                    </View>
                  )}
                  {myParticipantStatus === 'approved' && (
                    <View style={[styles.statusBadge, styles.statusBadgeApproved]}>
                      <ThemedText type="defaultSemiBold" style={styles.statusBadgeTextApproved}>You are going! ✅</ThemedText>
                    </View>
                  )}
                </View>
              )}

            {isCreator && (
              <TouchableOpacity style={styles.deleteButtonModal} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                <Text style={styles.deleteButtonModalText}>Удалить ивент</Text>
              </TouchableOpacity>
            )}

            {error ? <Text style={styles.err}>Ошибка: {error}</Text> : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF5F0' },
  container: { flex: 1 },
  // Telegram-style header
  tgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
    backgroundColor: '#FFF5F0',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(45,27,61,0.08)',
  },
  tgHeaderBack: {
    padding: 10,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tgHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    minHeight: 44,
  },
  tgTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2D1B3D',
  },
  tgSubtitle: {
    fontSize: 13,
    color: '#8B7A9B',
    marginTop: 2,
  },
  tgHeaderRight: {
    width: TG_HEADER_AVATAR + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tgHeaderAvatar: {
    width: TG_HEADER_AVATAR,
    height: TG_HEADER_AVATAR,
    borderRadius: TG_HEADER_AVATAR / 2,
  },
  tgHeaderAvatarPlaceholder: {
    width: TG_HEADER_AVATAR,
    height: TG_HEADER_AVATAR,
    borderRadius: TG_HEADER_AVATAR / 2,
    backgroundColor: '#FFE5D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tgHeaderAvatarEmoji: {
    fontSize: 18,
  },
  chatList: { flex: 1 },
  chatContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexGrow: 1,
  },
  sepWrap: { alignItems: 'center', paddingVertical: 8 },
  sepPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(45,27,61,0.07)',
  },
  sepText: { color: '#8B7A9B', fontSize: 12 },
  msgRow: { maxWidth: '86%', flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginVertical: 4 },
  msgRowMine: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  msgRowOther: { alignSelf: 'flex-start' },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 4,
  },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFE5D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: { fontSize: 16, fontWeight: '600', color: '#FF9F66' },
  msgContent: { flex: 1, gap: 4, minWidth: 0 },
  sender: { fontSize: 12, color: '#8B7A9B', marginBottom: 2 },
  bubble: { overflow: 'hidden', maxWidth: '100%' },
  bubbleMine: { borderTopRightRadius: 18, borderTopLeftRadius: 18, borderBottomLeftRadius: 18, borderBottomRightRadius: 4 },
  bubbleOther: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  bubbleGradient: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopRightRadius: 18,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  bubbleTextMine: { color: '#FFFFFF', fontSize: 15, lineHeight: 20 },
  bubbleTextOther: { color: '#2D1B3D', fontSize: 15, lineHeight: 20, paddingHorizontal: 14, paddingTop: 10 },
  bubbleImage: { borderRadius: 12, marginTop: 10, marginHorizontal: 14 },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  bubbleTimeMine: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  bubbleTimeOther: { fontSize: 11, color: '#8B7A9B' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 10,
    backgroundColor: '#F5F5F7',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  attachButtonActive: {
    backgroundColor: 'rgba(255,159,102,0.15)',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    minHeight: 40,
    maxHeight: 120,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#2D1B3D',
    paddingVertical: 6,
    paddingRight: 6,
    maxHeight: 104,
  },
  emojiButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(139,122,155,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  sendButtonActive: {
    backgroundColor: '#FF9F66',
  },
  sendButtonText: { color: '#8B7A9B', fontSize: 18 },

  // Event Details Modal (full-screen, Telegram Group Info style)
  detailsModalRoot: {
    flex: 1,
    backgroundColor: '#FFF5F0',
  },
  detailsModalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  detailsModalClose: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsModalScroll: { flex: 1 },
  detailsModalContent: { paddingHorizontal: 20, paddingTop: 8 },
  detailsHero: {
    height: 160,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: 'rgba(255,159,102,0.2)',
  },
  detailsHeroPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  detailsHeroEmoji: { fontSize: 48, marginBottom: 8 },
  detailsHeroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D1B3D',
    textAlign: 'center',
  },
  detailsHeroImage: {
    width: '100%',
    height: '100%',
  },
  detailsHeroTouchable: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  detailsHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsModalBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailsModalBarBtn: {
    padding: 4,
  },
  detailsEditTitle: {
    fontSize: 20,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  detailsEditDesc: {
    fontSize: 15,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 0,
  },
  detailsInfoBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  detailsInfoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D1B3D',
    marginBottom: 12,
  },
  detailsInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  detailsInfoText: {
    flex: 1,
    fontSize: 15,
    color: '#2D1B3D',
  },
  detailsInfoLink: {
    fontSize: 13,
    color: '#FF9F66',
    fontWeight: '600',
  },
  detailsDesc: {
    fontSize: 15,
    color: '#6E6E73',
    lineHeight: 22,
    marginTop: 8,
  },
  detailsActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  detailsActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  detailsActionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D1B3D',
  },
  detailsMembersSection: {
    marginBottom: 16,
  },
  detailsMembersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D1B3D',
    marginBottom: 12,
  },
  detailsMembersEmpty: {
    fontSize: 14,
    color: '#8B7A9B',
  },
  detailsMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  detailsMemberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  detailsMemberAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFE5D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsMemberAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9F66',
  },
  detailsMemberName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#2D1B3D',
  },
  detailsMemberBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(139,122,155,0.2)',
  },
  detailsMemberBadgeText: {
    fontSize: 12,
    color: '#8B7A9B',
  },
  detailsMemberActions: { flexDirection: 'row', gap: 8 },
  detailsAcceptBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#4CAF50',
  },
  detailsAcceptBtnText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  detailsDeclineBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,107,107,0.9)',
  },
  detailsDeclineBtnText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  joinSection: { marginBottom: 16, marginHorizontal: 0 },
  openOnMap: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,159,102,0.12)',
    marginBottom: 16,
    marginHorizontal: 20,
  },
  openOnMapText: { color: '#FF9F66' },
  joinSection: { marginBottom: 16, marginHorizontal: 20 },
  joinButton: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#FF9F66',
  },
  joinButtonDisabled: { opacity: 0.6 },
  joinButtonText: { color: '#FFFFFF', fontSize: 15 },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(139,122,155,0.2)',
  },
  statusBadgeText: { color: '#8B7A9B', fontSize: 14 },
  statusBadgeRejected: { backgroundColor: 'rgba(255,107,107,0.15)' },
  statusBadgeTextRejected: { color: '#FF6B6B', fontSize: 14 },
  statusBadgeApproved: { backgroundColor: 'rgba(76,175,80,0.15)' },
  statusBadgeTextApproved: { color: '#4CAF50', fontSize: 14 },
  deleteButtonModal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 8,
    marginHorizontal: 20,
  },
  deleteButtonModalText: { color: '#FF6B6B', fontSize: 15 },
  err: { color: '#6E6E73', marginTop: 8, marginHorizontal: 20 },
});
