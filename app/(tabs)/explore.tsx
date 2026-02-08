import { Link, useFocusEffect } from 'expo-router';
import React from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { listEvents, type LocalEvent } from '@/lib/local-events';
import { useTheme } from '@/lib/theme';

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [events, setEvents] = React.useState<LocalEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) setLoading(true);
    setError(null);
    try {
      const rows = await listEvents();
      setEvents(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void load(true); // initial load: show loading for empty state
    }, [load])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  }, [load]);

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: 16 + insets.top }]}>
      <View style={styles.header}>
        <ThemedText type="title" style={[styles.headerTitle, { color: colors.text }]}>
          Ивенты
        </ThemedText>
        <Link href="/create-event" asChild>
          <Pressable style={[styles.createButton, { backgroundColor: colors.accent }]}>
            <ThemedText type="defaultSemiBold" style={styles.createButtonText}>
              + Создать
            </ThemedText>
          </Pressable>
        </Link>
      </View>

      {error ? (
        <View style={[styles.errorCard, { backgroundColor: colors.border }]}>
          <ThemedText style={[styles.errorText, { color: colors.accent }]}>Ошибка: {error}</ThemedText>
        </View>
      ) : null}

      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} title="" tintColor={colors.accent} />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
              <ThemedText style={[styles.emptyText, { color: colors.text }]}>Пока нет ивентов</ThemedText>
              <ThemedText style={[styles.emptySubtext, { color: colors.textMuted }]}>Создайте первый ивент, чтобы начать!</ThemedText>
            </View>
          ) : (
            <View />
          )
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/event/[id]', params: { id: item.id } }} asChild>
            <Pressable style={[styles.card, { backgroundColor: colors.card }]}>
              <View style={styles.cardHeader}>
                <ThemedText type="title" style={[styles.cardTitle, { color: colors.text }]}>
                  {item.title}
                </ThemedText>
                <ThemedText style={[styles.cardTime, { color: colors.textMuted }]}>{formatDate(item.created_at)}</ThemedText>
              </View>

              {item.description ? (
                <ThemedText style={[styles.cardDescription, { color: colors.text }]} numberOfLines={2}>
                  {item.description}
                </ThemedText>
              ) : null}

              {item.meeting_place ? (
                <View style={[styles.locationRow, { backgroundColor: colors.border }]}>
                  <ThemedText style={styles.locationEmoji}>📍</ThemedText>
                  <ThemedText type="defaultSemiBold" style={[styles.locationText, { color: colors.accent }]}>
                    {item.meeting_place}
                  </ThemedText>
                </View>
              ) : null}

              <View style={styles.cardFooter}>
                <Pressable style={[styles.detailsButton, { backgroundColor: colors.accent }]}>
                  <ThemedText type="defaultSemiBold" style={styles.detailsButtonText}>
                    Подробнее →
                  </ThemedText>
                </Pressable>
              </View>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 28 },
  createButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#FF9F66',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  errorCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
  },
  errorText: { fontSize: 13 },
  listContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  emptyCard: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#FF9F66',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySubtext: { fontSize: 14 },
  card: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#FF9F66',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTitle: { flex: 1, fontSize: 20 },
  cardTime: { fontSize: 12, marginTop: 2 },
  cardDescription: { fontSize: 15, lineHeight: 20 },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  locationEmoji: { fontSize: 16 },
  locationText: { flex: 1, fontSize: 14 },
  cardFooter: { marginTop: 4 },
  detailsButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
  },
  detailsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});
