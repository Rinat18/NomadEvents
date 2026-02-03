// Temporary script to clear authentication cache
// Run with: node clear-auth-cache.js

const AsyncStorage = require('@react-native-async-storage/async-storage').default;

async function clearAuth() {
  try {
    await AsyncStorage.removeItem('nomadtable.is_authenticated.v1');
    console.log('✅ Authentication cache cleared!');
    console.log('You will need to enter the code again on next app launch.');
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  }
}

clearAuth();
