import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/LoadingScreen';
import {
  acceptRequest,
  declineRequest,
  getFriendRequests,
  getFriendshipStatuses,
  getMyFriends,
  searchUsers,
  sendFriendRequest,
  type FriendRequestWithSender,
  type FriendWithProfile,
  type ProfileBasic,
  type FriendshipStatus,
} from '@/lib/friends';
import { useTheme } from '@/lib/theme';

const TAB_MY_FRIENDS = 0;
const TAB_FIND_PEOPLE = 1;

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [tab, setTab] = React.useState(0);
  const [requests, setRequests] = React.useState<FriendRequestWithSender[]>([]);
  const [friends, setFriends] = React.useState<FriendWithProfile[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<ProfileBasic[]>([]);
  const [statuses, setStatuses] = React.useState<Record<string, FriendshipStatus>>({});
  const [loadingRequests, setLoadingRequests] = React.useState(true);
  const [loadingFriends, setLoadingFriends] = React.useState(true);
  const [searching, setSearching] = React.useState(false);
  const [sendingId, setSendingId] = React.useState<string | null>(null);
  const [acceptingId, setAcceptingId] = React.useState<string | null>(null);
  const [decliningId, setDecliningId] = React.useState<string | null>(null);

  const loadRequests = React.useCallback(async () => {
    setLoadingRequests(true);
    const data = await getFriendRequests();
    setRequests(data);
    setLoadingRequests(false);
  }, []);

  const loadFriends = React.useCallback(async () => {
    setLoadingFriends(true);
    const data = await getMyFriends();
    setFriends(data);
    setLoadingFriends(false);
  }, []);

  React.useEffect(() => {
    if (tab === TAB_MY_FRIENDS) {
      void loadRequests();
      void loadFriends();
    }
  }, [tab, loadRequests, loadFriends]);

  const runSearch = React.useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setStatuses({});
      return;
    }
    setSearching(true);
    const users = await searchUsers(q);
    setSearchResults(users);
    const ids = users.map((u) => u.id);
    const statusMap = await getFriendshipStatuses(ids);
    setStatuses(statusMap);
    setSearching(false);
  }, [searchQuery]);

  React.useEffect(() => {
    const t = setTimeout(runSearch, 300);
    return () => clearTimeout(t);
  }, [searchQuery, runSearch]);

  async function handleAdd(userId: string) {
    setSendingId(userId);
    const { error } = await sendFriendRequest(userId);
    setSendingId(null);
    if (error) return;
    const statusMap = await getFriendshipStatuses([userId]);
    setStatuses((prev) => ({ ...prev, ...statusMap }));
  }

  async function handleAccept(friendshipId: string) {
    setAcceptingId(friendshipId);
    const { error } = await acceptRequest(friendshipId);
    setAcceptingId(null);
    if (!error) {
      await loadRequests();
      await loadFriends();
    }
  }

  async function handleDecline(friendshipId: string) {
    setDecliningId(friendshipId);
    const { error } = await declineRequest(friendshipId);
    setDecliningId(null);
    if (!error) await loadRequests();
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.safe, { paddingTop: insets.top, backgroundColor: colors.background }]} edges={['bottom']}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: 8, paddingBottom: 16, backgroundColor: colors.background }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            style={styles.headerBack}
            activeOpacity={0.8}>
            <Text style={[styles.headerBackIcon, { color: colors.text }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Friends & People</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Segmented control */}
        <View style={[styles.segmented, { backgroundColor: colors.border }]}>
          <Pressable
            style={[styles.segment, tab === TAB_MY_FRIENDS && { backgroundColor: colors.card }, tab === TAB_MY_FRIENDS && styles.segmentActive]}
            onPress={() => setTab(TAB_MY_FRIENDS)}>
            <Text style={[styles.segmentText, { color: colors.textMuted }, tab === TAB_MY_FRIENDS && { color: colors.text }]}>
              My Friends
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segment, tab === TAB_FIND_PEOPLE && { backgroundColor: colors.card }, tab === TAB_FIND_PEOPLE && styles.segmentActive]}
            onPress={() => setTab(TAB_FIND_PEOPLE)}>
            <Text style={[styles.segmentText, { color: colors.textMuted }, tab === TAB_FIND_PEOPLE && { color: colors.text }]}>
              Find People
            </Text>
          </Pressable>
        </View>

        {tab === TAB_FIND_PEOPLE && (
          <View style={styles.searchWrap}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name…"
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        {tab === TAB_MY_FRIENDS && (
          <>
            {(loadingRequests || loadingFriends) ? (
              <View style={styles.loadingWrap}>
                <LoadingScreen />
              </View>
            ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
            showsVerticalScrollIndicator={false}>
            {/* Section 1: Requests */}
            {requests.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Requests</Text>
                {requests.map((req) => (
                  <View key={req.id} style={[styles.card, { backgroundColor: colors.card }]}>
                    <View style={styles.cardLeft}>
                      {req.requester?.avatar_url ? (
                        <Image source={{ uri: req.requester.avatar_url }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
                          <Text style={[styles.avatarPlaceholderText, { color: colors.accent }]}>
                            {req.requester?.name?.charAt(0).toUpperCase() ?? '?'}
                          </Text>
                        </View>
                      )}
                      <View style={styles.cardInfo}>
                        <Text style={[styles.cardName, { color: colors.text }]}>{req.requester?.name ?? 'Someone'}</Text>
                        <Text style={[styles.cardMeta, { color: colors.textMuted }]}>Wants to be friends</Text>
                      </View>
                    </View>
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={[styles.btnAccept, { backgroundColor: colors.accent }, acceptingId === req.id && styles.btnDisabled]}
                        onPress={() => handleAccept(req.id)}
                        disabled={acceptingId !== null}
                        activeOpacity={0.8}>
                        {acceptingId === req.id ? (
                          <ActivityIndicator size="small" color={colors.card} />
                        ) : (
                          <Text style={styles.btnAcceptText}>Accept</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btnDecline, { backgroundColor: colors.border }, decliningId === req.id && styles.btnDisabled]}
                        onPress={() => handleDecline(req.id)}
                        disabled={decliningId !== null}
                        activeOpacity={0.8}>
                        {decliningId === req.id ? (
                          <ActivityIndicator size="small" color={colors.textMuted} />
                        ) : (
                          <Text style={[styles.btnDeclineText, { color: colors.text }]}>Decline</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Section 2: All Friends */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>All Friends</Text>
              {friends.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
                  <Text style={[styles.emptyText, { color: colors.text }]}>No friends yet. Find people and send requests!</Text>
                </View>
              ) : (
                friends.map((f) => (
                  <TouchableOpacity
                    key={f.friendshipId}
                    style={[styles.card, { backgroundColor: colors.card }]}
                    activeOpacity={0.8}
                    onPress={() => router.push({ pathname: '/user/[id]', params: { id: f.user.id } })}>
                    <View style={styles.cardLeft}>
                      {f.user.avatar_url ? (
                        <Image source={{ uri: f.user.avatar_url }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
                          <Text style={[styles.avatarPlaceholderText, { color: colors.accent }]}>
                            {f.user.name?.charAt(0).toUpperCase() ?? '?'}
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                        {f.user.name ?? 'Unknown'}
                      </Text>
                    </View>
                    <Text style={[styles.friendBadge, { color: colors.accent }]}>Friends ✅</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </ScrollView>
            )}
          </>
        )}

        {tab === TAB_FIND_PEOPLE && (
          <View style={styles.listWrap}>
            {searching ? (
              <View style={styles.loadingWrap}>
                <LoadingScreen />
              </View>
            ) : searchQuery.trim() === '' ? (
              <View style={styles.centered}>
                <Text style={[styles.hint, { color: colors.textMuted }]}>Type a name to search</Text>
              </View>
            ) : searchResults.length === 0 ? (
              <View style={styles.centered}>
                <Text style={[styles.hint, { color: colors.textMuted }]}>No users found</Text>
              </View>
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[styles.listContent, { paddingBottom: 24 + insets.bottom }]}
                renderItem={({ item }) => {
                  const status = statuses[item.id];
                  const isPending = status === 'pending';
                  const isAccepted = status === 'accepted';
                  const isSending = sendingId === item.id;
                  return (
                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                      <TouchableOpacity
                        style={styles.cardLeft}
                        activeOpacity={0.8}
                        onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.id } })}>
                        {item.avatar_url ? (
                          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                        ) : (
                          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
                            <Text style={[styles.avatarPlaceholderText, { color: colors.accent }]}>
                              {item.name?.charAt(0).toUpperCase() ?? '?'}
                            </Text>
                          </View>
                        )}
                        <Text style={[styles.cardName, { color: colors.text }]}>{item.name ?? 'Unknown'}</Text>
                      </TouchableOpacity>
                      <View style={styles.cardAction}>
                        {isAccepted ? (
                          <Text style={[styles.statusFriends, { color: colors.accent }]}>Friends ✅</Text>
                        ) : isPending ? (
                          <Text style={[styles.statusSent, { color: colors.textMuted }]}>Sent ⏳</Text>
                        ) : (
                          <TouchableOpacity
                            style={[styles.btnAdd, { backgroundColor: colors.accent }, isSending && styles.btnDisabled]}
                            onPress={() => handleAdd(item.id)}
                            disabled={isSending}
                            activeOpacity={0.8}>
                            {isSending ? (
                              <ActivityIndicator size="small" color={colors.card} />
                            ) : (
                              <Text style={styles.btnAddText}>Add +</Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFF5F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#FFF5F0',
  },
  headerBack: {
    padding: 8,
    marginRight: 8,
  },
  headerBackIcon: {
    fontSize: 24,
    color: '#2D1B3D',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#2D1B3D',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  segmented: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(45,27,61,0.08)',
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6E6E73',
  },
  segmentTextActive: {
    color: '#2D1B3D',
  },
  searchWrap: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2D1B3D',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  loadingWrap: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 24 },
  listWrap: { flex: 1 },
  listContent: { padding: 16, gap: 8 },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D1B3D',
    marginBottom: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  cardInfo: { flex: 1 },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D1B3D',
  },
  cardMeta: {
    fontSize: 13,
    color: '#6E6E73',
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cardAction: {
    marginLeft: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFE5D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF9F66',
  },
  btnAccept: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#FF9F66',
  },
  btnAcceptText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  btnDecline: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(110,110,115,0.2)',
  },
  btnDeclineText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6E6E73',
  },
  btnAdd: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FF9F66',
  },
  btnAddText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  btnDisabled: { opacity: 0.7 },
  statusSent: {
    fontSize: 14,
    color: '#6E6E73',
  },
  statusFriends: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D1B3D',
  },
  friendBadge: {
    fontSize: 13,
    color: '#FF9F66',
    marginLeft: 8,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyText: {
    fontSize: 15,
    color: '#6E6E73',
    textAlign: 'center',
  },
  centered: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontSize: 15,
    color: '#6E6E73',
  },
});
