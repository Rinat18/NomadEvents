import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>NOMAD EVENTS</Text>
      <ActivityIndicator size="large" color="#FF9F66" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D1B3D',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  spinner: {
    marginTop: 20,
  },
});
