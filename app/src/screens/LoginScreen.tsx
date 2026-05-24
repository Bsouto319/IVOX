import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode]         = useState<'login' | 'register'>('login');
  const [loading, setLoading]   = useState(false);

  async function submit() {
    if (!email || !password) return;
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) Alert.alert('Erro', error.message);
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) Alert.alert('Erro', error.message);
        else Alert.alert('Conta criada!', 'Verifique seu email para confirmar.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.logo}>iVox</Text>
        <Text style={styles.tagline}>Fale em qualquer língua.{'\n'}Ligação em inglês.</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#8888aa"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Senha"
            placeholderTextColor="#8888aa"
            secureTextEntry
          />

          <TouchableOpacity style={styles.btn} onPress={submit} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode(m => m === 'login' ? 'register' : 'login')}>
            <Text style={styles.toggle}>
              {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0e1035' },
  container: { flex: 1, padding: 28, justifyContent: 'center' },
  logo:      { fontSize: 48, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: -2 },
  tagline:   { color: '#8888aa', textAlign: 'center', fontSize: 15, marginTop: 8, marginBottom: 40, lineHeight: 22 },
  form:      { gap: 14 },
  input:     { backgroundColor: '#1a1a40', color: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15, fontSize: 15, borderWidth: 1, borderColor: '#333366' },
  btn:       { backgroundColor: '#7c3aed', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4, shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 },
  btnText:   { color: '#fff', fontWeight: '900', fontSize: 16 },
  toggle:    { color: '#8888aa', textAlign: 'center', marginTop: 10, fontSize: 14 },
});
