import { useFocusEffect, useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { listDMChats, type DMChat } from '@/lib/local-dms';
import { listEvents, listMessages, type LocalEvent, type LocalMessage } from '@/lib/local-events';
import { getOrCreateLocalUserId } from '@/lib/local-user';

type ChatEvent = {
  event: LocalEvent;
  lastMessage: LocalMessage | null;
  unreadCount: number;
};

type SectionData = {
  title: string;
  data: (DMChat | ChatEvent)[];
  type: 'dm' | 'event';
};

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [dmChats, setDmChats] = React.useState<DMChat[]>([]);
  const [chatEvents, setChatEvents] = React.useState<ChatEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const userId = await getOrCreateLocalUserId();
      setCurrentUserId(userId);

      // Load DM chats
      const dms = await listDMChats();
      setDmChats(dms);

      // Load Event chats
      const allEvents = await listEvents();
      const allMessages = await Promise.all(allEvents.map((e) => listMessages(e.id)));

      // Фильтруем: ивенты с сообщениями ИЛИ созданные пользователем
      const activeChats: ChatEvent[] = [];

      for (let i = 0; i < allEvents.length; i++) {
        const event = allEvents[i];
        const messages = allMessages[i];

        // Проверяем, есть ли сообщения или ивент создан пользователем
        const hasMessages = messages.length > 0;
        // В локальном режиме считаем, что все ивенты "созданы" пользователем
        // (так как нет поля created_by в LocalEvent)
        // Но можно проверить по сообщениям пользователя
        const userHasMessages = messages.some((m) => m.user_id === userId);

        if (hasMessages || userHasMessages) {
          // Находим последнее сообщение
          const sortedMessages = [...messages].sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
          const lastMessage = sortedMessages[0] || null;

          activeChats.push({
            event,
            lastMessage,
            unreadCount: 0, // В локальном режиме не считаем непрочитанные
          });
        }
      }

      // Сортируем по времени последнего сообщения (или создания ивента)
      activeChats.sort((a, b) => {
        const timeA = a.lastMessage?.created_at || a.event.created_at;
        const timeB = b.lastMessage?.created_at || b.event.created_at;
        return timeA > timeB ? -1 : 1;
      });

      setChatEvents(activeChats);
    } catch (e) {
      console.error('Ошибка загрузки чатов:', e);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void load();
    }, [load])
  );

  function formatTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    if (sameDay) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  }

  function getMessagePreview(message: LocalMessage | null): string {
    if (!message) return 'Нет сообщений';
    return message.body.length > 50 ? message.body.substring(0, 50) + '...' : message.body;
  }

  // Build sections for SectionList
  const sections: SectionData[] = React.useMemo(() => {
    const result: SectionData[] = [];

    if (dmChats.length > 0) {
      result.push({
        title: 'Личные сообщения',
        data: dmChats,
        type: 'dm',
      });
    }

    if (chatEvents.length > 0) {
      result.push({
        title: 'Чаты ивентов',
        data: chatEvents,
        type: 'event',
      });
    }

    return result;
  }, [dmChats, chatEvents]);

  const isEmpty = dmChats.length === 0 && chatEvents.length === 0;

  return (
    <View style={[styles.container, { paddingTop: 16 + insets.top }]}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.headerTitle}>
          Чаты
        </ThemedText>
      </View>

      {isEmpty && !loading ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <ThemedText style={styles.emptyIconText}>💬</ThemedText>
            </View>
            <ThemedText style={styles.emptyText}>No active chats yet.</ThemedText>
            <ThemedText style={styles.emptySubtext}>Join an event or message someone!</ThemedText>
          </View>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => {
            if ('event' in item) return `event-${item.event.id}`;
            return `dm-${item.id}`;
          }}
          onRefresh={load}
          refreshing={loading}
          contentContainerStyle={[styles.listContent, { paddingBottom: 24 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                {section.title}
              </ThemedText>
            </View>
          )}
          renderItem={({ item, section }) => {
            // DM Chat item
            if (section.type === 'dm' && 'userName' in item) {
              const dm = item as DMChat;
              return (
                <Pressable
                  style={styles.chatCard}
                  onPress={() =>
                    router.push({
                      pathname: '/dm/[id]',
                      params: {
                        id: dm.id,
                        name: dm.userName,
                        avatar: dm.userAvatar || '',
                        vibe: dm.userVibe || 'just-coffee',
                      },
                    })
                  }>
                  <View style={styles.leftIcon}>
                    {dm.userAvatar ? (
                      <Image source={{ uri: dm.userAvatar }} style={styles.leftIconImage} />
                    ) : (
                      <View style={styles.leftIconPlaceholder}>
                        <Text style={styles.leftIconPlaceholderText}>
                          {dm.userName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.center}>
                    <ThemedText type="defaultSemiBold" style={styles.chatTitle} numberOfLines={1}>
                      {dm.userName}
                    </ThemedText>
                    <ThemedText style={styles.chatPreview} numberOfLines={1}>
                      {dm.lastMessage || 'Start a conversation'}
                    </ThemedText>
                  </View>

                  <View style={styles.right}>
                    <ThemedText style={styles.chatTime}>{formatTime(dm.updatedAt)}</ThemedText>
                    <View style={styles.chevron}>
                      <ThemedText style={styles.chevronText}>›</ThemedText>
                    </View>
                  </View>
                </Pressable>
              );
            }

            // Event Chat item
            if (section.type === 'event' && 'event' in item) {
              const chatEvent = item as ChatEvent;
              const lastMessage = chatEvent.lastMessage;
              const isMyMessage = lastMessage && currentUserId && lastMessage.user_id === currentUserId;
              const showAvatar = lastMessage && lastMessage.author && !isMyMessage;
              const showEventIcon = !showAvatar;

              return (
                <Pressable
                  style={styles.chatCard}
                  onPress={() => router.push({ pathname: '/event/[id]', params: { id: chatEvent.event.id } })}>
                  <View style={styles.leftIcon}>
                    {showEventIcon ? (
                      <Text style={styles.leftIconText}>{chatEvent.event.emoji || '📌'}</Text>
                    ) : lastMessage && lastMessage.author.avatar_url ? (
                      <Image source={{ uri: lastMessage.author.avatar_url }} style={styles.leftIconImage} />
                    ) : lastMessage && lastMessage.author ? (
                      <View style={styles.leftIconPlaceholder}>
                        <Text style={styles.leftIconPlaceholderText}>
                          {lastMessage.author.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.leftIconText}>{chatEvent.event.emoji || '📌'}</Text>
                    )}
                  </View>

                  <View style={styles.center}>
                    <ThemedText type="defaultSemiBold" style={styles.chatTitle} numberOfLines={1}>
                      {chatEvent.event.title}
                    </ThemedText>
                    <ThemedText style={styles.chatPreview} numberOfLines={1}>
                      {getMessagePreview(chatEvent.lastMessage)}
                    </ThemedText>
                  </View>

                  <View style={styles.right}>
                    {chatEvent.lastMessage ? (
                      <ThemedText style={styles.chatTime}>{formatTime(chatEvent.lastMessage.created_at)}</ThemedText>
                    ) : (
                      <ThemedText style={styles.chatTime}>{formatTime(chatEvent.event.created_at)}</ThemedText>
                    )}
                    <View style={styles.chevron}>
                      <ThemedText style={styles.chevronText}>›</ThemedText>
                    </View>
                  </View>
                </Pressable>
              );
            }

            return null;
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F0', // Warm peach background
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    color: '#2D1B3D',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    paddingTop: 16,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#8B7A9B',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emptyContainer: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#FF9F66',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFE5D4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyIconText: { fontSize: 22 },
  emptyText: {
    fontSize: 16,
    color: '#2D1B3D',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8B7A9B',
    textAlign: 'center',
  },
  chatCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#FF9F66',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
    gap: 12,
  },
  leftIcon: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: '#FFE5D4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  leftIconText: {
    fontSize: 24,
    textAlign: 'center',
    includeFontPadding: false,
  },
  leftIconImage: {
    width: '100%',
    height: '100%',
  },
  leftIconPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFE5D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftIconPlaceholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF9F66',
    textAlign: 'center',
    includeFontPadding: false,
  },
  center: { flex: 1, gap: 4 },
  right: { alignItems: 'flex-end', gap: 8 },
  chatTitle: {
    fontSize: 16,
    color: '#2D1B3D',
  },
  chatTime: {
    fontSize: 12,
    color: '#8B7A9B',
    marginTop: 2,
  },
  chatPreview: {
    fontSize: 14,
    color: '#8B7A9B',
    lineHeight: 18,
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,159,102,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronText: { fontSize: 20, color: '#FF9F66', marginTop: -2 },
});
