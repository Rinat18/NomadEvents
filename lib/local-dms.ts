import AsyncStorage from '@react-native-async-storage/async-storage';

export type DMMessage = {
  id: string;
  chatId: string; // The other user's ID
  senderId: string; // Who sent this message
  body: string;
  created_at: string;
  author: {
    name: string;
    avatar_url: string | null;
    vibe: string | null;
  };
};

export type DMChat = {
  id: string; // The other person's ID (used as chat ID)
  userName: string;
  userAvatar: string | null;
  userVibe: string | null;
  lastMessage: string;
  updatedAt: string;
};

const DMS_KEY = 'nomadtable.dms.v1';
const DM_MESSAGES_KEY = 'nomadtable.dm_messages.v1';

function randomId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// Bot auto-replies for simulation
const BOT_REPLIES: Record<string, string[]> = {
  aisuluu: [
    'Привет! Как дела? 👋',
    'О, приятно познакомиться!',
    'Давай как-нибудь встретимся на кофе ☕',
    'Что нового?',
    'Звучит интересно! Расскажи больше',
  ],
  timur: [
    'Йо! Что делаешь?',
    'Давай пересечемся на выходных',
    'Слышал про новый стартап? 🚀',
    'Как там твой проект?',
    'Я сейчас в Sierra, приходи!',
  ],
  jibek: [
    'Привет! 😊',
    'Классная идея!',
    'Давай на хайкинг в выходные?',
    'Как настроение?',
    'Отличная погода сегодня, не думаешь?',
  ],
  max: [
    'Hey! What\'s up?',
    'Sounds good to me!',
    'Let\'s grab coffee sometime',
    'Working on something cool, will share soon',
    'Check out this article I found',
  ],
  aida: [
    'Hi there!',
    'Let\'s practice English together! 🗣️',
    'Have you been to Ala-Archa?',
    'I love that place too!',
    'Nice to meet you!',
  ],
};

function getRandomReply(userName: string): string {
  const nameLower = userName.toLowerCase();
  const replies = BOT_REPLIES[nameLower] || [
    'Привет!',
    'Как дела?',
    'Интересно!',
    '👍',
    'Давай пообщаемся!',
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

/**
 * Get or create a DM chat with a user
 */
export async function getOrCreateDMChat(
  userId: string,
  userName: string,
  userAvatar: string | null,
  userVibe: string | null
): Promise<DMChat> {
  const chats = await readJson<DMChat[]>(DMS_KEY, []);
  let chat = chats.find((c) => c.id === userId);

  if (!chat) {
    chat = {
      id: userId,
      userName,
      userAvatar,
      userVibe,
      lastMessage: '',
      updatedAt: new Date().toISOString(),
    };
    chats.push(chat);
    await writeJson(DMS_KEY, chats);
  } else {
    // Update user info if changed
    chat.userName = userName;
    chat.userAvatar = userAvatar;
    chat.userVibe = userVibe;
    await writeJson(DMS_KEY, chats);
  }

  return chat;
}

/**
 * Get a DM chat by user ID
 */
export async function getDMChat(userId: string): Promise<DMChat | null> {
  const chats = await readJson<DMChat[]>(DMS_KEY, []);
  return chats.find((c) => c.id === userId) || null;
}

/**
 * List all DM chats sorted by last update
 */
export async function listDMChats(): Promise<DMChat[]> {
  const chats = await readJson<DMChat[]>(DMS_KEY, []);
  return chats
    .filter((c) => c.lastMessage) // Only show chats with messages
    .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));
}

/**
 * Get messages for a DM chat
 */
export async function getDMMessages(chatId: string): Promise<DMMessage[]> {
  const all = await readJson<DMMessage[]>(DM_MESSAGES_KEY, []);
  return all
    .filter((m) => m.chatId === chatId)
    .sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
}

/**
 * Send a message in a DM chat
 * @param simulateReply - if true, will simulate a bot reply after 2-4 seconds
 */
export async function sendDMMessage(
  chatId: string,
  body: string,
  myUserId: string,
  myProfile: { name: string; avatar_url: string | null; vibe: string | null },
  simulateReply: boolean = true
): Promise<DMMessage> {
  const now = new Date().toISOString();

  // Create the message
  const msg: DMMessage = {
    id: randomId(),
    chatId,
    senderId: myUserId,
    body,
    created_at: now,
    author: myProfile,
  };

  // Save the message
  const allMessages = await readJson<DMMessage[]>(DM_MESSAGES_KEY, []);
  allMessages.push(msg);
  await writeJson(DM_MESSAGES_KEY, allMessages);

  // Update the chat's last message
  const chats = await readJson<DMChat[]>(DMS_KEY, []);
  const chatIndex = chats.findIndex((c) => c.id === chatId);
  if (chatIndex !== -1) {
    chats[chatIndex].lastMessage = body.length > 50 ? body.substring(0, 50) + '...' : body;
    chats[chatIndex].updatedAt = now;
    await writeJson(DMS_KEY, chats);
  }

  // Simulate bot reply for demo users
  if (simulateReply) {
    const chat = chats[chatIndex];
    if (chat) {
      const demoNames = ['aisuluu', 'timur', 'jibek', 'max', 'aida'];
      if (demoNames.includes(chat.userName.toLowerCase())) {
        // Simulate reply after 2-4 seconds
        setTimeout(async () => {
          const replyBody = getRandomReply(chat.userName);
          const replyMsg: DMMessage = {
            id: randomId(),
            chatId,
            senderId: chatId, // The other user is sending
            body: replyBody,
            created_at: new Date().toISOString(),
            author: {
              name: chat.userName,
              avatar_url: chat.userAvatar,
              vibe: chat.userVibe,
            },
          };

          const messages = await readJson<DMMessage[]>(DM_MESSAGES_KEY, []);
          messages.push(replyMsg);
          await writeJson(DM_MESSAGES_KEY, messages);

          // Update chat
          const updatedChats = await readJson<DMChat[]>(DMS_KEY, []);
          const idx = updatedChats.findIndex((c) => c.id === chatId);
          if (idx !== -1) {
            updatedChats[idx].lastMessage = replyBody.length > 50 ? replyBody.substring(0, 50) + '...' : replyBody;
            updatedChats[idx].updatedAt = new Date().toISOString();
            await writeJson(DMS_KEY, updatedChats);
          }
        }, 2000 + Math.random() * 2000);
      }
    }
  }

  return msg;
}
