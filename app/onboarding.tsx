import React from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';

const VALID_CODES = ['2026', 'NOMAD'];

type AuthMode = 'invite' | 'signin' | 'signup';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();

  // Invite code state
  const [code, setCode] = React.useState('');

  // Auth state
  const [mode, setMode] = React.useState<AuthMode>('invite');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  // UI state
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const shakeAnimation = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: shakeAnimation.value }],
    };
  });

  function shake() {
    shakeAnimation.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withRepeat(withTiming(10, { duration: 50 }), 4, true),
      withTiming(0, { duration: 50 })
    );
  }

  // Step 1: Verify invite code
  async function verifyCode() {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;

    setLoading(true);
    setError(null);

    const isValid = VALID_CODES.some((validCode) => normalized === validCode.toUpperCase());

    if (isValid) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMode('signin'); // Switch to auth UI
      setLoading(false);
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    shake();
    setError('Invalid code. Try again.');
    setLoading(false);
  }

  // Step 2: Sign In with Supabase
  async function handleSignIn() {
    if (!email.trim() || !password) {
      setError('Please enter email and password');
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
      // Auth state change will be caught by _layout.tsx and redirect
    } catch (e) {
      console.error('Sign in error:', e);
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  // Step 2: Sign Up with Supabase
  async function handleSignUp() {
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: email.split('@')[0], // Default name from email
          },
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

      // Check if user was auto-confirmed (email confirmation disabled in Supabase)
      if (data.session) {
        // User is already logged in, auth state change will redirect
        console.log('User signed up and auto-logged in');
      } else if (data.user?.identities?.length === 0) {
        // User already exists
        setError('An account with this email already exists. Please sign in.');
        setLoading(false);
      } else {
        // Email confirmation is required
        Alert.alert(
          'Check your email',
          'We sent you a confirmation link. Please verify your email to continue.',
          [{ text: 'OK', onPress: () => setMode('signin') }]
        );
        setLoading(false);
      }
    } catch (e) {
      console.error('Sign up error:', e);
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  // Render Invite Code UI (Step 1)
  function renderInviteStep() {
    return (
      <>
        {/* Top: Logo/App Name */}
        <Animated.View entering={FadeInDown.duration(900).delay(100)} style={styles.topSection}>
          <ThemedText type="title" style={styles.appName}>
            NOMAD CIRCLE
          </ThemedText>
        </Animated.View>

        {/* Center: Tagline */}
        <Animated.View entering={FadeInDown.duration(900).delay(200)} style={styles.centerSection}>
          <ThemedText style={styles.tagline}>
            Bishkek&apos;s curated circle.{'\n'}Access by invite only.
          </ThemedText>
        </Animated.View>

        {/* Bottom: Input & Button */}
        <Animated.View entering={FadeInDown.duration(900).delay(300)} style={styles.bottomSection}>
          <Animated.View style={shakeStyle}>
            <View style={styles.inputContainer}>
              <TextInput
                value={code}
                onChangeText={(t) => {
                  setError(null);
                  setCode(t);
                  void Haptics.selectionAsync();
                }}
                placeholder="Enter Invite Code"
                placeholderTextColor="rgba(255,255,255,0.4)"
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={verifyCode}
                editable={!loading}
              />
            </View>
          </Animated.View>

          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          <Pressable
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={verifyCode}
            disabled={loading || !code.trim()}>
            {loading ? (
              <ActivityIndicator color="#FF9F66" />
            ) : (
              <ThemedText type="defaultSemiBold" style={styles.primaryButtonText}>
                Unlock Access
              </ThemedText>
            )}
          </Pressable>

          <ThemedText style={styles.footerText}>1,420 people on the waitlist.</ThemedText>
        </Animated.View>
      </>
    );
  }

  // Render Auth UI (Step 2)
  function renderAuthStep() {
    const isSignUp = mode === 'signup';

    return (
      <>
        {/* Top: Logo */}
        <Animated.View entering={FadeInDown.duration(600)} style={styles.topSection}>
          <ThemedText type="title" style={styles.appName}>
            NOMAD CIRCLE
          </ThemedText>
          <ThemedText style={styles.welcomeText}>
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </ThemedText>
        </Animated.View>

        {/* Center: Form */}
        <Animated.View entering={FadeInDown.duration(600).delay(100)} style={styles.authForm}>
          <Animated.View style={shakeStyle}>
            <View style={styles.inputContainer}>
              <TextInput
                value={email}
                onChangeText={(t) => {
                  setError(null);
                  setEmail(t);
                }}
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
                onChangeText={(t) => {
                  setError(null);
                  setPassword(t);
                }}
                placeholder="Password"
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
                  onChangeText={(t) => {
                    setError(null);
                    setConfirmPassword(t);
                  }}
                  placeholder="Confirm Password"
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

        {/* Bottom: Buttons */}
        <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.bottomSection}>
          <Pressable
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={isSignUp ? handleSignUp : handleSignIn}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FF9F66" />
            ) : (
              <ThemedText type="defaultSemiBold" style={styles.primaryButtonText}>
                {isSignUp ? 'Create Account' : 'Sign In'}
              </ThemedText>
            )}
          </Pressable>

          <Pressable
            style={styles.switchModeButton}
            onPress={() => {
              setError(null);
              setMode(isSignUp ? 'signin' : 'signup');
            }}
            disabled={loading}>
            <ThemedText style={styles.switchModeText}>
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </ThemedText>
          </Pressable>

          {/* Back to invite code */}
          <Pressable
            style={styles.backButton}
            onPress={() => {
              setMode('invite');
              setError(null);
              setEmail('');
              setPassword('');
              setConfirmPassword('');
            }}
            disabled={loading}>
            <ThemedText style={styles.backButtonText}>← Back to invite code</ThemedText>
          </Pressable>
        </Animated.View>
      </>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2D1B3D', '#161016', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Subtle glow effect */}
      <Animated.View entering={FadeIn.duration(1200)} style={styles.glow} />

      <View style={[styles.content, { paddingTop: 60 + insets.top, paddingBottom: 40 + insets.bottom }]}>
        {mode === 'invite' ? renderInviteStep() : renderAuthStep()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    shadowColor: '#FF9F66',
    shadowOpacity: 0.15,
    shadowRadius: 80,
    shadowOffset: { width: 0, height: 0 },
  },
  topSection: {
    alignItems: 'center',
    gap: 12,
  },
  appName: {
    fontSize: 32,
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '300',
  },
  welcomeText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },
  centerSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.5,
  },
  authForm: {
    gap: 16,
  },
  bottomSection: {
    gap: 16,
  },
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
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FF9F66',
    fontSize: 16,
    letterSpacing: 1,
  },
  switchModeButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  switchModeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  backButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 8,
  },
});
