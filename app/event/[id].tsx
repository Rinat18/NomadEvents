import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
    Alert,
    FlatList,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import {
    addMessage,
    deleteEvent,
    getEventById,
    getEventParticipantsWithStatus,
    getMyParticipantStatus,
    joinEvent,
    listMessages,
    updateParticipantStatus,
    type LocalEvent,
    type LocalMessage,
    type ParticipantStatus,
} from '@/lib/local-events';
import { getProfile } from '@/lib/local-profile';
import { getOrCreateLocalUserId } from '@/lib/local-user';
import { supabase } from '@/lib/supabase';
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

export default function EventDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = typeof id === 'string' ? id : '';

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
  const [infoModalVisible, setInfoModalVisible] = React.useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = React.useState(false);
  const listRef = React.useRef<FlatList<ChatRow> | null>(null);

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

  async function uploadImageToSupabase(base64: string, ext: 'jpg' | 'jpeg' | 'png' = 'jpg') {
    const filePath = `event_${eventId}/${Date.now()}.${ext}`;
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const arrayBuffer = decode(base64);

    const { error } = await supabase.storage.from('chat-images').upload(filePath, arrayBuffer, {
      contentType,
      upsert: false,
    });
    if (error) throw error;

    const { data } = supabase.storage.from('chat-images').getPublicUrl(filePath);
    return data.publicUrl;
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
        base64: true,
        allowsEditing: false,
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.base64) {
        Alert.alert('Ошибка', 'Не удалось получить изображение.');
        return;
      }

      const extGuess = (asset.uri.split('.').pop() || '').toLowerCase();
      const ext: 'jpg' | 'jpeg' | 'png' = extGuess === 'png' ? 'png' : extGuess === 'jpeg' ? 'jpeg' : 'jpg';

      setSending(true);
      const url = await uploadImageToSupabase(asset.base64, ext);

      const userId = await getOrCreateLocalUserId();
      const profile = await getProfile();

      await addMessage({
        event_id: eventId,
        user_id: userId,
        body: url, // MVP: send URL as content
        author: {
          name: profile.name || 'Guest',
          avatar_url: profile.photos?.[0] ?? null,
          vibe: profile.vibeIntent ?? null,
        },
      });

      await load();
    } catch (e) {
      console.error('Pick/upload image error:', e);
      Alert.alert('Ошибка', 'Не удалось отправить фото.');
    } finally {
      setSending(false);
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

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}>
          {/* Custom Header */}
          <View style={[styles.customHeader, { paddingTop: insets.top + 8, paddingBottom: 12 }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              style={styles.headerBack}>
              <Ionicons name="chevron-back" size={28} color="#2D1B3D" />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <ThemedText type="defaultSemiBold" style={styles.headerTitle} numberOfLines={1}>
                {event?.title ?? 'Ивент'}
              </ThemedText>
              <Text style={styles.headerSubtitle}>{event ? formatEventDate(event.created_at) : ''}</Text>
            </View>

            <TouchableOpacity
              onPress={() => setInfoModalVisible(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.headerInfo}>
              <Ionicons name="information-circle-outline" size={26} color="#2D1B3D" />
            </TouchableOpacity>
          </View>

          {/* Message List (inverted) */}
          <FlatList
            ref={(r) => {
              (listRef as React.MutableRefObject<FlatList<ChatRow> | null>).current = r;
            }}
            data={rowsReversed}
            keyExtractor={(r) => r.id}
            inverted
            contentContainerStyle={[styles.chatContent, { paddingBottom: 12 }]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              if (item.type === 'sep') {
                return (
                  <View style={styles.sepWrap}>
                    <View style={styles.sepPill}>
                      <Text style={styles.sepText}>{item.label}</Text>
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
                        <Text style={styles.sender}>{msg.author.name}</Text>
                      </TouchableOpacity>
                    ) : null}
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                      {mine ? (
                        <LinearGradient
                          colors={['#FF9F66', '#FF8C50']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.bubbleGradient}>
                          {isImg ? (
                            <Image source={{ uri: msg.body }} style={styles.bubbleImage} />
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
                            <Image source={{ uri: msg.body }} style={styles.bubbleImage} />
                          ) : (
                            <Text style={styles.bubbleTextOther}>{msg.body}</Text>
                          )}
                          <View style={styles.bubbleMeta}>
                            <Text style={styles.bubbleTimeOther}>
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
          <View style={[styles.inputBar, { paddingBottom: 10 + insets.bottom }]}>
            <TouchableOpacity style={styles.attachButton} onPress={handlePickImage} disabled={sending}>
              <Ionicons name="add" size={26} color="#8B7A9B" />
            </TouchableOpacity>

            <View style={styles.inputWrapper}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Message…"
                placeholderTextColor="#8B7A9B"
                style={styles.input}
                multiline
                maxLength={2000}
              />
              <TouchableOpacity
                style={styles.emojiButton}
                onPress={() => {
                  Keyboard.dismiss();
                  setIsEmojiOpen((v) => !v);
                }}>
                <Ionicons name="happy-outline" size={22} color="#8B7A9B" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.sendButton, hasText && !sending && styles.sendButtonActive]}
              onPress={onSend}
              disabled={!hasText || sending}>
              {sending ? (
                <Text style={styles.sendButtonText}>…</Text>
              ) : (
                <Ionicons
                  name="send"
                  size={20}
                  color={hasText ? '#FFFFFF' : '#8B7A9B'}
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
              knob: '#D9D3DF',
              container: '#F5F5F7',
              header: '#F5F5F7',
              category: { icon: '#8B7A9B', iconActive: '#FF9F66' },
              search: {
                background: '#FFFFFF',
                text: '#2D1B3D',
                placeholder: '#8B7A9B',
                icon: '#8B7A9B',
              },
            }}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Info Modal: Event details, Join, Participants */}
      <Modal
        visible={infoModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setInfoModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setInfoModalVisible(false)}>
          <Pressable style={[styles.modalSheet, { paddingBottom: insets.bottom + 24 }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
              <ThemedText type="title" style={styles.modalTitle}>
                {event?.title ?? 'Ивент'}
              </ThemedText>
              {event?.meeting_place ? (
                <View style={styles.meetingRow}>
                  <Text style={styles.meetingEmoji}>📍</Text>
                  <ThemedText type="defaultSemiBold" style={styles.meetingText}>{event.meeting_place}</ThemedText>
                </View>
              ) : null}
              {event?.description ? <ThemedText style={styles.desc}>{event.description}</ThemedText> : null}
              {event?.meeting_lat != null && event?.meeting_lng != null && (
                <Pressable
                  style={styles.openOnMap}
                  onPress={() =>
                    Linking.openURL(
                      `https://2gis.kg/bishkek?m=${encodeURIComponent(`${event.meeting_lng},${event.meeting_lat}/16`)}`
                    )
                  }>
                  <ThemedText type="defaultSemiBold" style={styles.openOnMapText}>Открыть в 2ГИС</ThemedText>
                </Pressable>
              )}

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

              {event && isCreator && participantsWithStatus.length > 0 && (
                <View style={styles.participantsSection}>
                  {participantsWithStatus.filter((p) => p.status === 'pending').length > 0 && (
                    <View style={styles.participantsBlock}>
                      <ThemedText type="defaultSemiBold" style={styles.participantsBlockTitle}>Requests</ThemedText>
                      {participantsWithStatus
                        .filter((p) => p.status === 'pending')
                        .map((p) => (
                          <View key={p.id} style={styles.participantRow}>
                            <View style={styles.participantInfo}>
                              {p.avatar_url ? (
                                <Image source={{ uri: p.avatar_url }} style={styles.participantAvatar} />
                              ) : (
                                <View style={styles.participantAvatarPlaceholder}>
                                  <Text style={styles.participantAvatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                                </View>
                              )}
                              <ThemedText type="defaultSemiBold" style={styles.participantName}>{p.name}</ThemedText>
                            </View>
                            <View style={styles.participantActions}>
                              <Pressable
                                style={styles.acceptButton}
                                onPress={async () => {
                                  try {
                                    await updateParticipantStatus(eventId, p.id, 'approved');
                                    await load();
                                  } catch (e) {
                                    setError(e instanceof Error ? e.message : 'Ошибка');
                                  }
                                }}>
                                <Text style={styles.acceptButtonText}>✅ Accept</Text>
                              </Pressable>
                              <Pressable
                                style={styles.declineButton}
                                onPress={async () => {
                                  try {
                                    await updateParticipantStatus(eventId, p.id, 'rejected');
                                    await load();
                                  } catch (e) {
                                    setError(e instanceof Error ? e.message : 'Ошибка');
                                  }
                                }}>
                                <Text style={styles.declineButtonText}>❌ Decline</Text>
                              </Pressable>
                            </View>
                          </View>
                        ))}
                    </View>
                  )}
                  {participantsWithStatus.filter((p) => p.status === 'approved').length > 0 && (
                    <View style={styles.participantsBlock}>
                      <ThemedText type="defaultSemiBold" style={styles.participantsBlockTitle}>Going</ThemedText>
                      {participantsWithStatus
                        .filter((p) => p.status === 'approved')
                        .map((p) => (
                          <View key={p.id} style={styles.participantRow}>
                            {p.avatar_url ? (
                              <Image source={{ uri: p.avatar_url }} style={styles.participantAvatar} />
                            ) : (
                              <View style={styles.participantAvatarPlaceholder}>
                                <Text style={styles.participantAvatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                              </View>
                            )}
                            <ThemedText type="defaultSemiBold" style={styles.participantName}>{p.name}</ThemedText>
                          </View>
                        ))}
                    </View>
                  )}
                </View>
              )}

              {isCreator && (
                <Pressable style={styles.deleteButtonModal} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                  <ThemedText style={styles.deleteButtonModalText}>Удалить ивент</ThemedText>
                </Pressable>
              )}

              {error ? <ThemedText style={styles.err}>Ошибка: {error}</ThemedText> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF5F0' },
  container: { flex: 1 },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    backgroundColor: '#FFF5F0',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(45,27,61,0.08)',
  },
  headerBack: {
    padding: 10,
    marginRight: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 17,
    color: '#2D1B3D',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8B7A9B',
    marginTop: 2,
  },
  headerInfo: {
    padding: 10,
    marginLeft: 4,
  },
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
  bubbleImage: { width: 200, height: 200, borderRadius: 12, marginTop: 10, marginHorizontal: 14 },
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

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFF5F0',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalContent: { padding: 20, paddingBottom: 32 },
  modalTitle: { color: '#2D1B3D', marginBottom: 12 },
  meetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#FFF0E6',
    marginBottom: 8,
  },
  meetingEmoji: { fontSize: 14 },
  meetingText: { color: '#FF9F66', flex: 1 },
  desc: { color: '#8B7A9B', marginBottom: 12 },
  openOnMap: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,159,102,0.12)',
    marginBottom: 16,
  },
  openOnMapText: { color: '#FF9F66' },
  joinSection: { marginBottom: 16 },
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
  participantsSection: { gap: 16, marginBottom: 16 },
  participantsBlock: { gap: 10 },
  participantsBlockTitle: { fontSize: 14, color: '#8B7A9B', marginBottom: 4 },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,245,240,0.9)',
  },
  participantInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  participantAvatar: { width: 36, height: 36, borderRadius: 18 },
  participantAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFE5D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantAvatarText: { fontSize: 16, fontWeight: '600', color: '#FF9F66' },
  participantName: { fontSize: 15, color: '#2D1B3D' },
  participantActions: { flexDirection: 'row', gap: 8 },
  acceptButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
  },
  acceptButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  declineButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,107,107,0.9)',
  },
  declineButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  deleteButtonModal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 8,
  },
  deleteButtonModalText: { color: '#FF6B6B', fontSize: 15 },
  err: { color: '#8B7A9B', marginTop: 8 },
});
