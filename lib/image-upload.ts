import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';

const BUCKET_CHAT = 'chat-images';
const BUCKET_EVENT = 'event-images';

/**
 * Read image from URI, upload to Supabase storage (chat-images), return public URL.
 * Used for chat image messages.
 */
export async function uploadImage(uri: string): Promise<string | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const arrayBuffer = decode(base64);
    const random = Math.random().toString(36).slice(2, 10);
    const fileName = `chat/${Date.now()}_${random}.jpg`;

    const { error } = await supabase.storage
      .from(BUCKET_CHAT)
      .upload(fileName, arrayBuffer, { contentType: 'image/jpeg' });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage.from(BUCKET_CHAT).getPublicUrl(fileName);
    return publicUrlData.publicUrl;
  } catch (e) {
    console.error('[image-upload]', e);
    return null;
  }
}

/**
 * Upload image to event-images bucket; return public URL for event cover.
 * Requires bucket "event-images" to exist and be public.
 */
export async function uploadEventImage(uri: string): Promise<string | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const arrayBuffer = decode(base64);
    const random = Math.random().toString(36).slice(2, 10);
    const fileName = `covers/${Date.now()}_${random}.jpg`;

    const { error } = await supabase.storage
      .from(BUCKET_EVENT)
      .upload(fileName, arrayBuffer, { contentType: 'image/jpeg' });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage.from(BUCKET_EVENT).getPublicUrl(fileName);
    return publicUrlData.publicUrl;
  } catch (e) {
    console.error('[image-upload] uploadEventImage', e);
    return null;
  }
}
