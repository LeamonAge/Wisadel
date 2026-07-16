import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
import { useAccountStore } from '../stores/accountStore';
import { dsColors as c, dsFontSize as f, dsSpacing as s } from '../utils/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const { signIn, signUp, loading, error, clearError } = useAccountStore();

  const handleSubmit = async () => {
    clearError();
    try {
      if (isSignUp) await signUp(email, password);
      else await signIn(email, password);
    } catch {}
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <View style={styles.top}>
          <Text style={styles.logo}>🧠</Text>
          <Text style={styles.title}>理智</Text>
          <Text style={styles.subtitle}>你的手机 AI 助手</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="邮箱"
            placeholderTextColor={c.textTertiary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="密码"
            placeholderTextColor={c.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.btn}
            onPress={handleSubmit}
            disabled={loading || !email || !password}
          >
            {loading ? (
              <ActivityIndicator size="small" color={c.white} />
            ) : (
              <Text style={styles.btnText}>{isSignUp ? '注册' : '登录'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setIsSignUp(!isSignUp); clearError(); }}>
            <Text style={styles.switch}>
              {isSignUp ? '已有账户？登录' : '没有账户？注册'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  top: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 48, marginBottom: s.lg },
  title: { fontSize: f.xxl, fontWeight: '700', color: c.textPrimary, marginBottom: s.sm },
  subtitle: { fontSize: f.md, color: c.textSecondary },
  form: {},
  input: {
    backgroundColor: c.inputBg, color: c.textPrimary,
    borderRadius: 12, paddingHorizontal: s.lg, paddingVertical: 14,
    fontSize: f.md, marginBottom: s.md,
    borderWidth: 1, borderColor: c.border,
  },
  error: {
    color: c.error, fontSize: f.sm, textAlign: 'center',
    marginBottom: s.md,
  },
  btn: {
    backgroundColor: c.accent, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: s.sm,
  },
  btnText: { color: c.white, fontSize: f.md, fontWeight: '600' },
  switch: {
    color: c.accent, fontSize: f.sm, textAlign: 'center',
    marginTop: s.xl,
  },
});
