import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'nomadtable.is_authenticated.v1';

export async function getIsAuthenticated() {
  const v = await AsyncStorage.getItem(KEY);
  return v === 'true';
}

export async function setIsAuthenticated(value: boolean) {
  await AsyncStorage.setItem(KEY, value ? 'true' : 'false');
}

export async function clearAuth() {
  await AsyncStorage.removeItem(KEY);
}

// Backward compatibility
export async function getIsVerified() {
  return getIsAuthenticated();
}

export async function setIsVerified(value: boolean) {
  return setIsAuthenticated(value);
}

