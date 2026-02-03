import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { getDMMessages, getOrCreateDMChat, sendDMMessage, type DMMessage } from '@/lib/local-dms';
import { getProfile } from '@/lib/local-profile';
import { getOrCreateLocalUserId } from '@/lib/local-user';

type ChatRow =
  | { type: 'sep'; id: string; label: string }
  | { type: 'msg'; id: string; msg: DMMessage };

export default function DMChatScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; name: string; avatar: string; vibe: string }>();

  const chatId = params.id || '';
  const userName = params.name || 'User';
  const userAvatar = params.avatar || null;
  const userVibe = params.vibe || null;

  const [messages, setMessages] = React.useState<DMMessage[]>([]);
  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [myUserId, setMyUserId] = React.useState<string | null>(null);
  const listRef = React.useRef<FlatList<ChatRow> | null>(null);

  // Polling interval for new messages (to catch bot replies)
  const pollInterval = React.useRef<NodeJS.Timeout | null>(null);

  const load = React.useCallback(async () => {
    if (!chatId) return;
    try {
      // Ensure chat exists
      await getOrCreateDMChat(chatId, userName, userAvatar, userVibe);
      // Load messages
      const msgs = await getDMMessages(chatId);
      setMessages(msgs);
      const uid = await getOrCreateLocalUserId();
      setMyUserId(uid);
    } catch (e) {
      console.error('Error loading DM:', e);
    }
  }, [chatId, userName, userAvatar, userVibe]);

  React.useEffect(() => {
    void load();

    // Start polling for new messages (for bot replies)
    pollInterval.current = setInterval(async () => {
      if (chatId) {
        const msgs = await getDMMessages(chatId);
        setMessages(msgs);
      }
    }, 1500);

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [load, chatId]);

  async function onSend() {
    const body = text.trim();
    if (!body || !chatId || sending) return;
    setSending(true);
    const userId = await getOrCreateLocalUserId();

    try {
      const profile = await getProfile();
      const authorName = profile.name || 'Guest';
      const authorAvatar = profile.photos && profile.photos.length > 0 ? profile.photos[0] : null;
      const authorVibe = profile.vibeIntent || null;

      const msg = await sendDMMessage(
        chatId,
        body,
        userId,
        { name: authorName, avatar_url: authorAvatar, vibe: authorVibe },
        true // Enable bot simulation
      );
      setMessages((prev) => [...prev, msg]);
    } catch (e) {
      console.error('Error sending DM:', e);
    }
    setSending(false);
    setText('');

    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }

  function dateKey(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function dateLabel(d: Date) {
    const now = new Date();
    const todayKey = dateKey(now);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yKey = dateKey(yesterday);
    const k = dateKey(d);
    if (k === todayKey) return 'Today';
    if (k === yKey) return 'Yesterday';
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

  // Navigate to user profile
  const handleAvatarPress = () => {
    router.push({
      pathname: '/user/[id]',
      params: {
        id: chatId,
        name: userName,
        avatar: userAvatar || '',
        vibe: userVibe || 'just-coffee',
      },
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.headerBack}>
              <Ionicons name="chevron-back" size={28} color="#2D1B3D" />
            </TouchableOpacity>
          ),
          headerTitle: () => (
            <Pressable onPress={handleAvatarPress} style={styles.headerTitle}>
              {userAvatar ? (
                <Image source={{ uri: userAvatar }} style={styles.headerAvatar} />
              ) : (
                <View style={styles.headerAvatarPlaceholder}>
                  <Text style={styles.headerAvatarText}>{userName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View>
                <Text style={styles.headerName}>{userName}</Text>
                <Text style={styles.headerStatus}>Online</Text>
              </View>
            </Pressable>
          ),
          headerStyle: { backgroundColor: '#FFF5F0' },
          headerTintColor: '#2D1B3D',
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView style={styles.safe} edges={[]}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyAvatar}>
                {userAvatar ? (
                  <Image source={{ uri: userAvatar }} style={styles.emptyAvatarImage} />
                ) : (
                  <Text style={styles.emptyAvatarText}>{userName.charAt(0).toUpperCase()}</Text>
                )}
              </View>
              <ThemedText type="defaultSemiBold" style={styles.emptyName}>
                {userName}
              </ThemedText>
              <ThemedText style={styles.emptyHint}>Start a conversation!</ThemedText>
            </View>
          ) : (
            <FlatList
              ref={(r) => {
                // @ts-expect-error RN types allow null
                listRef.current = r;
              }}
              data={rows}
              keyExtractor={(r) => r.id}
              contentContainerStyle={styles.chatContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => {
                listRef.current?.scrollToEnd({ animated: false });
              }}
              renderItem={({ item }) => {
                if (item.type === 'sep') {
                  return (
                    <View style={styles.sepWrap}>
                      <View style={styles.sepPill}>
                        <ThemedText style={styles.sepText}>{item.label}</ThemedText>
                      </View>
                    </View>
                  );
                }

                const msg = item.msg;
                const mine = myUserId != null && msg.senderId === myUserId;

                return (
                  <View style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowOther]}>
                    {!mine ? (
                      <Pressable onPress={handleAvatarPress}>
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
                      </Pressable>
                    ) : null}
                    <View style={styles.msgContent}>
                      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                        <ThemedText style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextOther]}>
                          {msg.body}
                        </ThemedText>
                        <View style={styles.bubbleMeta}>
                          <Text style={[styles.bubbleTime, mine ? styles.bubbleTimeMine : styles.bubbleTimeOther]}>
                            {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          {mine && (
                            <Ionicons name="checkmark-done" size={14} color="#FFFFFF" style={styles.readIndicator} />
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}

          <View style={styles.inputContainer}>
            <View style={styles.composer}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Message…"
                placeholderTextColor="rgba(139, 122, 155, 0.8)"
                style={styles.input}
                multiline
              />
              <Pressable
                style={[styles.send, sending ? styles.sendDisabled : null]}
                onPress={onSend}
                disabled={sending || text.trim().length === 0}>
                <ThemedText style={styles.sendIcon}>➤</ThemedText>
              </Pressable>
            </View>
            <View style={{ height: insets.bottom }} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF5F0' },
  container: { flex: 1, backgroundColor: '#FFF5F0' },
  headerBack: {
    padding: 8,
    marginLeft: 4,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FF9F66',
  },
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFE5D4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FF9F66',
  },
  headerAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9F66',
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D1B3D',
  },
  headerStatus: {
    fontSize: 12,
    color: '#4CAF50',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  emptyAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFE5D4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FF9F66',
    overflow: 'hidden',
  },
  emptyAvatarImage: {
    width: '100%',
    height: '100%',
  },
  emptyAvatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#FF9F66',
  },
  emptyName: {
    fontSize: 20,
    color: '#2D1B3D',
  },
  emptyHint: {
    fontSize: 15,
    color: '#8B7A9B',
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  sepWrap: { alignItems: 'center', paddingVertical: 6 },
  sepPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(45,27,61,0.06)',
  },
  sepText: { color: '#8B7A9B', fontSize: 12 },
  msgRow: { maxWidth: '86%', flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  msgRowMine: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  msgRowOther: { alignSelf: 'flex-start' },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 4,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFE5D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9F66',
    textAlign: 'center',
    includeFontPadding: false,
  },
  msgContent: { flex: 1, gap: 4 },
  bubble: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    borderRadius: 18,
  },
  bubbleMine: {
    backgroundColor: '#FF9F66',
    borderTopRightRadius: 2,
  },
  bubbleOther: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextMine: { color: '#FFFFFF' },
  bubbleTextOther: { color: '#2D1B3D' },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  bubbleTime: {
    fontSize: 11,
  },
  bubbleTimeMine: {
    color: 'rgba(255,255,255,0.75)',
  },
  bubbleTimeOther: {
    color: '#8B7A9B',
  },
  readIndicator: {
    marginLeft: 4,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#FFF5F0',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  input: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(45,27,61,0.05)',
    maxHeight: 120,
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FF9F66',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.5 },
  sendIcon: { color: '#FFFFFF', fontSize: 18, marginLeft: 2 },
});
