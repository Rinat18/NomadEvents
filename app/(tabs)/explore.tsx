import { Link, useFocusEffect } from 'expo-router';
import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { listEvents, type LocalEvent } from '@/lib/local-events';

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const [events, setEvents] = React.useState<LocalEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
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
      void load();
    }, [load])
  );

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
    <View style={[styles.container, { paddingTop: 16 + insets.top }]}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.headerTitle}>
          Ивенты
        </ThemedText>
        <Link href="/create-event" asChild>
          <Pressable style={styles.createButton}>
            <ThemedText type="defaultSemiBold" style={styles.createButtonText}>
              + Создать
            </ThemedText>
          </Pressable>
        </Link>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <ThemedText style={styles.errorText}>Ошибка: {error}</ThemedText>
        </View>
      ) : null}

      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        onRefresh={load}
        refreshing={loading}
        contentContainerStyle={[styles.listContent, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyCard}>
              <ThemedText style={styles.emptyText}>Пока нет ивентов</ThemedText>
              <ThemedText style={styles.emptySubtext}>Создайте первый ивент, чтобы начать!</ThemedText>
            </View>
          ) : (
            <View />
          )
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/event/[id]', params: { id: item.id } }} asChild>
            <Pressable style={styles.card}>
              <View style={styles.cardHeader}>
                <ThemedText type="title" style={styles.cardTitle}>
                  {item.title}
                </ThemedText>
                <ThemedText style={styles.cardTime}>{formatDate(item.created_at)}</ThemedText>
              </View>

              {item.description ? (
                <ThemedText style={styles.cardDescription} numberOfLines={2}>
                  {item.description}
                </ThemedText>
              ) : null}

              {item.meeting_place ? (
                <View style={styles.locationRow}>
                  <ThemedText style={styles.locationEmoji}>📍</ThemedText>
                  <ThemedText type="defaultSemiBold" style={styles.locationText}>
                    {item.meeting_place}
                  </ThemedText>
                </View>
              ) : null}

              <View style={styles.cardFooter}>
                <Pressable style={styles.detailsButton}>
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
  container: {
    flex: 1,
    backgroundColor: '#FFF5F0', // Warm peach background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    color: '#2D1B3D',
  },
  createButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FF9F66', // Accent color
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
    backgroundColor: '#FFE5D4',
  },
  errorText: {
    color: '#FF6B35',
    fontSize: 13,
  },
  listContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
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
  emptyText: {
    fontSize: 16,
    color: '#2D1B3D',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8B7A9B',
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
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 20,
    color: '#2D1B3D',
  },
  cardTime: {
    fontSize: 12,
    color: '#8B7A9B',
    marginTop: 2,
  },
  cardDescription: {
    fontSize: 15,
    color: '#4A3A5A',
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FFF0E6',
  },
  locationEmoji: {
    fontSize: 16,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#FF6B35',
  },
  cardFooter: {
    marginTop: 4,
  },
  detailsButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#FF9F66', // Accent color
  },
  detailsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});
