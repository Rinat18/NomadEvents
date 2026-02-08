import React from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';

type AuthMode = 'signin' | 'signup';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();

  const [mode, setMode] = React.useState<AuthMode>('signin');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const shakeAnimation = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnimation.value }],
  }));

  function shake() {
    shakeAnimation.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withRepeat(withTiming(10, { duration: 50 }), 4, true),
      withTiming(0, { duration: 50 })
    );
  }

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setError('Введите email и пароль');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        shake();
        setError(authError.message);
        setLoading(false);
        return;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('Sign in error:', e);
      setError('Что-то пошло не так. Попробуйте снова.');
      setLoading(false);
    }
  }

  async function handleSignUp() {
    if (!email.trim()) {
      setError('Введите email');
      return;
    }
    if (password.length < 6) {
      setError('Пароль не менее 6 символов');
      return;
    }
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: email.split('@')[0] },
        },
      });

      if (authError) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        shake();
        setError(authError.message);
        setLoading(false);
        return;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (data.session) {
        // Auto-logged in; _layout will redirect (possibly to create-profile)
      } else if (data.user?.identities?.length === 0) {
        setError('Аккаунт с таким email уже есть. Войдите.');
        setLoading(false);
      } else {
        Alert.alert(
          'Проверьте почту',
          'Мы отправили ссылку для подтверждения. Подтвердите email, чтобы продолжить.',
          [{ text: 'OK', onPress: () => setMode('signin') }]
        );
        setLoading(false);
      }
    } catch (e) {
      console.error('Sign up error:', e);
      setError('Что-то пошло не так. Попробуйте снова.');
      setLoading(false);
    }
  }

  const isSignUp = mode === 'signup';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2D1B3D', '#161016', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View entering={FadeIn.duration(1200)} style={styles.glow} />

      <View style={[styles.content, { paddingTop: 60 + insets.top, paddingBottom: 40 + insets.bottom }]}>
        <Animated.View entering={FadeInDown.duration(600)} style={styles.topSection}>
          <ThemedText type="title" style={styles.appName}>
            Nomad Events
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Твой пропуск в закрытое комьюнити Бишкека.
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(600).delay(100)} style={styles.authForm}>
          <Animated.View style={shakeStyle}>
            <View style={styles.inputContainer}>
              <TextInput
                value={email}
                onChangeText={(t) => { setError(null); setEmail(t); }}
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.4)"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                style={styles.input}
                editable={!loading}
              />
            </View>

            <View style={[styles.inputContainer, { marginTop: 12 }]}>
              <TextInput
                value={password}
                onChangeText={(t) => { setError(null); setPassword(t); }}
                placeholder="Пароль"
                placeholderTextColor="rgba(255,255,255,0.4)"
                secureTextEntry
                textContentType={isSignUp ? 'newPassword' : 'password'}
                style={styles.input}
                editable={!loading}
              />
            </View>

            {isSignUp && (
              <View style={[styles.inputContainer, { marginTop: 12 }]}>
                <TextInput
                  value={confirmPassword}
                  onChangeText={(t) => { setError(null); setConfirmPassword(t); }}
                  placeholder="Повторите пароль"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  secureTextEntry
                  textContentType="newPassword"
                  style={styles.input}
                  editable={!loading}
                  onSubmitEditing={handleSignUp}
                />
              </View>
            )}
          </Animated.View>

          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.bottomSection}>
          <Pressable
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={isSignUp ? handleSignUp : handleSignIn}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FF9F66" />
            ) : (
              <ThemedText type="defaultSemiBold" style={styles.primaryButtonText}>
                {isSignUp ? 'Регистрация' : 'Войти'}
              </ThemedText>
            )}
          </Pressable>

          <Pressable
            style={styles.switchModeButton}
            onPress={() => { setError(null); setMode(isSignUp ? 'signin' : 'signup'); }}
            disabled={loading}>
            <ThemedText style={styles.switchModeText}>
              {isSignUp ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Регистрация'}
            </ThemedText>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  content: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24 },
  glow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    shadowColor: '#FF9F66',
    shadowOpacity: 0.15,
    shadowRadius: 80,
    shadowOffset: { width: 0, height: 0 },
  },
  topSection: { alignItems: 'center', gap: 12 },
  appName: {
    fontSize: 32,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '300',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  authForm: { gap: 16 },
  bottomSection: { gap: 16 },
  inputContainer: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  input: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: 'rgba(255,255,255,0.95)',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  errorText: {
    color: 'rgba(255,120,120,0.9)',
    fontSize: 14,
    textAlign: 'center',
  },
  primaryButton: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FF9F66',
    backgroundColor: 'rgba(255,159,102,0.15)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#FF9F66', fontSize: 16, letterSpacing: 1 },
  switchModeButton: { paddingVertical: 12, alignItems: 'center' },
  switchModeText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
});
