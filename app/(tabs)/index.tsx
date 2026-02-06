import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/LoadingScreen';
import { ThemedText } from '@/components/themed-text';
import { MAPBOX_ACCESS_TOKEN } from '@/constants/keys';
import { listEvents, type LocalEvent } from '@/lib/local-events';
import { useTheme } from '@/lib/theme';
import Mapbox from '@rnmapbox/maps';

// Helper function to get emoji from event (use event.emoji if available, otherwise fallback)
function getEventEmoji(event: LocalEvent): string {
  // Use stored emoji if available (new events)
  if (event.emoji && event.emoji.trim()) {
    return event.emoji;
  }
  // Fallback for old events without emoji field
  const text = `${event.title} ${event.description || ''}`.toLowerCase();
  if (text.includes('coffee') || text.includes('кофе') || text.includes('кафе')) return '☕';
  if (text.includes('wine') || text.includes('вино') || text.includes('drink') || text.includes('напиток')) return '🍷';
  if (text.includes('work') || text.includes('работа') || text.includes('cowork') || text.includes('коворк')) return '💻';
  if (text.includes('food') || text.includes('еда') || text.includes('ресторан') || text.includes('restaurant')) return '🍽️';
  if (text.includes('sport') || text.includes('спорт') || text.includes('gym') || text.includes('тренажер')) return '🏃';
  if (text.includes('music') || text.includes('музыка') || text.includes('concert') || text.includes('концерт')) return '🎵';
  if (text.includes('art') || text.includes('искусство') || text.includes('выставка') || text.includes('exhibition')) return '🎨';
  if (text.includes('language') || text.includes('язык') || text.includes('practice') || text.includes('практика')) return '🗣️';
  if (text.includes('date') || text.includes('свидание') || text.includes('romantic') || text.includes('романтика')) return '💕';
  if (text.includes('networking') || text.includes('нетворкинг') || text.includes('meetup') || text.includes('встреча')) return '🤝';
  return '📍'; // Default social emoji
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const [events, setEvents] = React.useState<LocalEvent[]>([]);
  const [selectedPoint, setSelectedPoint] = React.useState<{ lat: number; lng: number } | null>(null);
  const [selectedEvent, setSelectedEvent] = React.useState<LocalEvent | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loading, setLoading] = React.useState(true); // Initial loading state
  const cardAnimation = React.useRef(new Animated.Value(0)).current;
  const isFirstLoad = React.useRef(true);

  React.useEffect(() => {
    Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
  }, []);

  // Animate card when event is selected
  React.useEffect(() => {
    if (selectedEvent) {
      Animated.spring(cardAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      Animated.timing(cardAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedEvent, cardAnimation]);

  const loadEvents = React.useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const data = await listEvents();
      setEvents(data);
      return data;
    } catch (e) {
      console.error('Ошибка загрузки ивентов:', e);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Load events when screen comes into focus; keep selected event card open but refresh its data
  useFocusEffect(
    React.useCallback(() => {
      const selectedId = selectedEvent?.id;
      const shouldShowLoader = isFirstLoad.current;
      if (isFirstLoad.current) isFirstLoad.current = false;
      loadEvents(shouldShowLoader).then((data) => {
        if (selectedId && data?.length) {
          const updated = data.find((e) => e.id === selectedId);
          if (updated) setSelectedEvent(updated);
        }
      });
    }, [loadEvents, selectedEvent?.id])
  );

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }, [loadEvents]);

  const handleMarkerPress = React.useCallback((event: LocalEvent) => {
    setSelectedEvent(event);
    setSelectedPoint(null); // Clear point selection if any
  }, []);

  const handleMapPress = React.useCallback((e: any) => {
    const coords = e.geometry?.coordinates as number[] | undefined;
    if (coords && coords.length >= 2) {
      const [lng, lat] = coords;
      setSelectedPoint({ lat, lng });
      setSelectedEvent(null); // Clear event selection
    } else {
      // Tap on empty map area - dismiss both
      setSelectedPoint(null);
      setSelectedEvent(null);
    }
  }, []);

  const handleJoinEvent = React.useCallback(() => {
    if (selectedEvent) {
      router.push({ pathname: '/event/[id]', params: { id: selectedEvent.id } });
    }
  }, [selectedEvent]);

  const formatEventTime = React.useCallback((dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Tomorrow, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === -1) {
      return `Yesterday, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }, []);

  const cardTranslateY = cardAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [200, 0],
  });

  const cardOpacity = cardAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {Platform.OS === 'web' ? (
        <View style={styles.webCard}>
          <ThemedText>Mapbox в web-версии этого проекта не поддерживается.</ThemedText>
          <ThemedText>Открой iOS/Android dev build.</ThemedText>
        </View>
      ) : (
        <View style={styles.mapContainer}>
          <Mapbox.MapView
            style={{ flex: 1 }}
            styleURL={isDark ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Light}
            onPress={handleMapPress}>
            <Mapbox.Camera
              defaultSettings={{
                centerCoordinate: [74.589, 42.8746], // Bishkek
                zoomLevel: 11,
              }}
            />

            {events
              .filter((ev) => ev.meeting_lat != null && ev.meeting_lng != null)
              .map((ev) => {
                const emoji = getEventEmoji(ev);
                return (
                  <Mapbox.MarkerView
                    key={ev.id}
                    id={`event:${ev.id}`}
                    coordinate={[ev.meeting_lng!, ev.meeting_lat!]}
                    anchor={{ x: 0.5, y: 0.5 }}>
                    <Pressable onPress={() => handleMarkerPress(ev)} style={styles.vibePin}>
                      <Text style={styles.vibePinEmoji}>{emoji}</Text>
                    </Pressable>
                  </Mapbox.MarkerView>
                );
              })}
          </Mapbox.MapView>

          {/* Floating Refresh Button */}
          <Pressable
            style={[styles.refreshButton, { top: 16 + insets.top }]}
            onPress={handleRefresh}
            disabled={refreshing}>
            <ThemedText style={styles.refreshButtonText}>
              {refreshing ? '⏳' : '🔄'}
            </ThemedText>
            {!refreshing && (
              <ThemedText style={styles.refreshButtonLabel}>Refresh</ThemedText>
            )}
          </Pressable>

          {/* Selected Event Card (floating at bottom) */}
          {selectedEvent && (
            <Animated.View
              style={[
                styles.eventCard,
                {
                  bottom: 16 + insets.bottom,
                  transform: [{ translateY: cardTranslateY }],
                  opacity: cardOpacity,
                },
              ]}>
              <View style={styles.eventCardContent}>
                <View style={styles.eventCardHeader}>
                  <View style={styles.eventCardEmoji}>
                    <ThemedText style={styles.eventCardEmojiText}>{getEventEmoji(selectedEvent)}</ThemedText>
                  </View>
                  <View style={styles.eventCardInfo}>
                    <ThemedText type="defaultSemiBold" style={styles.eventCardTitle} numberOfLines={1}>
                      {selectedEvent.title}
                    </ThemedText>
                    <ThemedText style={styles.eventCardTime}>
                      {formatEventTime(selectedEvent.created_at)}
                    </ThemedText>
                  </View>
                </View>
                {selectedEvent.meeting_place && (
                  <ThemedText style={styles.eventCardLocation} numberOfLines={1}>
                    📍 {selectedEvent.meeting_place}
                  </ThemedText>
                )}
                <Pressable style={styles.joinButton} onPress={handleJoinEvent}>
                  <ThemedText type="defaultSemiBold" style={styles.joinButtonText}>
                    Join
                  </ThemedText>
                </Pressable>
              </View>
            </Animated.View>
          )}

          {/* Create Event Overlay (when point is selected) */}
          {selectedPoint && !selectedEvent && (
            <View style={[styles.overlay, { bottom: 16 + insets.bottom }]}>
              <ThemedText type="defaultSemiBold" style={styles.overlayTitle}>
                Выбрана точка
              </ThemedText>
              <ThemedText style={styles.overlayCoords}>
                {selectedPoint.lat.toFixed(5)}, {selectedPoint.lng.toFixed(5)}
              </ThemedText>
              <View style={styles.overlayActions}>
                <Pressable
                  style={styles.createButton}
                  onPress={() =>
                    router.push({
                      pathname: '/create-event',
                      params: { lat: String(selectedPoint.lat), lng: String(selectedPoint.lng) },
                    })
                  }>
                  <ThemedText type="defaultSemiBold" style={styles.createButtonText}>
                    Создать ивент здесь
                  </ThemedText>
                </Pressable>
                <Pressable style={styles.resetButton} onPress={() => setSelectedPoint(null)}>
                  <ThemedText type="defaultSemiBold" style={styles.resetButtonText}>
                    Сброс
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          )}

          {/* Hint when nothing is selected */}
          {!selectedPoint && !selectedEvent && !loading && (
            <View style={[styles.hint, { bottom: 16 + insets.bottom }]}>
              <ThemedText style={styles.hintText}>Тапни по маркеру, чтобы увидеть детали</ThemedText>
            </View>
          )}

          {/* Loading overlay */}
          {loading && (
            <View style={styles.loadingOverlay}>
              <LoadingScreen />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F0',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  webCard: {
    gap: 12,
    padding: 16,
  },
  // Custom "Vibe" Pin with Emoji
  vibePin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#FF9F66',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF9F66',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    overflow: 'hidden',
  },
  vibePinEmoji: {
    fontSize: 22,
    lineHeight: 24,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  // Floating Refresh Button
  refreshButton: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  refreshButtonText: {
    fontSize: 18,
  },
  refreshButtonLabel: {
    fontSize: 14,
    color: '#2D1B3D',
    fontWeight: '600',
  },
  // Selected Event Card
  eventCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#FF9F66',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  eventCardContent: {
    padding: 16,
    gap: 12,
  },
  eventCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventCardEmoji: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFE5D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventCardEmojiText: {
    fontSize: 24,
  },
  eventCardInfo: {
    flex: 1,
    gap: 4,
  },
  eventCardTitle: {
    fontSize: 16,
    color: '#2D1B3D',
  },
  eventCardTime: {
    fontSize: 13,
    color: '#8B7A9B',
  },
  eventCardLocation: {
    fontSize: 13,
    color: '#8B7A9B',
    marginTop: 4,
  },
  joinButton: {
    backgroundColor: '#FF9F66',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 4,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  // Create Event Overlay
  overlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#FF9F66',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    gap: 10,
  },
  overlayTitle: {
    fontSize: 16,
    color: '#2D1B3D',
  },
  overlayCoords: {
    fontSize: 12,
    color: '#8B7A9B',
    fontFamily: 'monospace',
  },
  overlayActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  createButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#FF9F66',
    alignItems: 'center',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  resetButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#F5E6E0',
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#FF6B35',
    fontSize: 14,
  },
  // Hint
  hint: {
    position: 'absolute',
    left: 16,
    right: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
  },
  hintText: {
    fontSize: 13,
    color: '#8B7A9B',
  },
  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFF5F0',
  },
});
