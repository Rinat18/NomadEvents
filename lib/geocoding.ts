import { MAPBOX_ACCESS_TOKEN } from '@/constants/keys';

export type GeocodeResult = {
  place_name: string;
  category: string | null;
};

/**
 * Reverse geocoding: Get place name and category from coordinates
 */
export async function reverseGeocode(lng: number, lat: number): Promise<GeocodeResult | null> {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_ACCESS_TOKEN}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Geocoding API error:', response.status);
      return null;
    }
    const data = await response.json();
    
    // Find the first feature with a name (usually the first one is the most relevant)
    const feature = data.features?.[0];
    if (!feature) {
      return null;
    }

    const place_name = feature.text || feature.place_name || '';
    const category = feature.properties?.category || feature.properties?.type || null;

    return {
      place_name,
      category,
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Smart emoji detection based on place category and name
 */
export function getEmojiFromPlace(category: string | null, placeName: string = ''): string {
  const text = `${category || ''} ${placeName}`.toLowerCase();

  // Coffee & Cafes
  if (text.includes('coffee') || text.includes('cafe') || text.includes('кофе') || text.includes('кафе')) {
    return '☕';
  }

  // Bars & Pubs
  if (text.includes('bar') || text.includes('pub') || text.includes('wine') || text.includes('вино')) {
    return '🍷';
  }

  // Parks & Gardens
  if (text.includes('park') || text.includes('garden') || text.includes('парк') || text.includes('сад')) {
    return '🌳';
  }

  // Gyms & Sports
  if (
    text.includes('gym') ||
    text.includes('sport') ||
    text.includes('fitness') ||
    text.includes('спорт') ||
    text.includes('тренажер')
  ) {
    return '🏋️';
  }

  // Work & Offices
  if (
    text.includes('work') ||
    text.includes('office') ||
    text.includes('library') ||
    text.includes('cowork') ||
    text.includes('работа') ||
    text.includes('коворк') ||
    text.includes('библиотека')
  ) {
    return '💻';
  }

  // Restaurants & Food
  if (
    text.includes('restaurant') ||
    text.includes('food') ||
    text.includes('pizza') ||
    text.includes('ресторан') ||
    text.includes('еда') ||
    text.includes('пицца')
  ) {
    return '🍽️';
  }

  // Music & Entertainment
  if (
    text.includes('music') ||
    text.includes('concert') ||
    text.includes('club') ||
    text.includes('музыка') ||
    text.includes('концерт')
  ) {
    return '🎵';
  }

  // Art & Culture
  if (
    text.includes('art') ||
    text.includes('museum') ||
    text.includes('gallery') ||
    text.includes('искусство') ||
    text.includes('музей') ||
    text.includes('выставка')
  ) {
    return '🎨';
  }

  // Default
  return '📍';
}
