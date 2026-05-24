import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, Alert, ActivityIndicator, SafeAreaView, Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import { supabase } from '../lib/supabase';
import { previewCall, sendCall, getContacts } from '../lib/api';

const API = process.env.EXPO_PUBLIC_API_URL as string;
const MAX_SECONDS = 30;

type Status = 'idle' | 'recording' | 'processing' | 'preview' | 'calling' | 'done';

interface Contact { id: string; name: string; phone: string; }
interface Preview { msgId: string; transcription: string; translation: string; }

export default function HomeScreen() {
  const [status, setStatus]     = useState<Status>('idle');
  const [phone, setPhone]       = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showContacts, setShowContacts] = useState(false);
  const [preview, setPreview]   = useState<Preview | null>(null);
  const [error, setError]       = useState('');
  const [countdown, setCountdown] = useState(MAX_SECONDS);
  const [token, setToken]       = useState('');

  const recording  = useRef<Audio.Recording | null>(null);
  const audioBlob  = useRef<{ uri: string; mimeType: string } | null>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setToken(data.session.access_token);
    });
    return () => clearInterval(timerRef.current!);
  }, []);

  useEffect(() => {
    if (token) loadContacts();
  }, [token]);

  async function loadContacts() {
    try {
      const data = await getContacts(token);
      setContacts(data);
    } catch {}
  }

  async function startRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recording.current = rec;
      setStatus('recording');
      setCountdown(MAX_SECONDS);
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { stopRecording(); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch {
      Alert.alert('Erro', 'Não foi possível acessar o microfone.');
    }
  }

  async function stopRecording() {
    clearInterval(timerRef.current!);
    if (!recording.current) return;
    await recording.current.stopAndUnloadAsync();
    const uri = recording.current.getURI() || '';
    audioBlob.current = { uri, mimeType: 'audio/mp4' };
    recording.current = null;
    setStatus('idle');
    processAudio(uri);
  }

  async function processAudio(uri: string) {
    if (!phone.trim()) {
      Alert.alert('Número obrigatório', 'Digite ou escolha um número antes de gravar.');
      return;
    }
    setStatus('processing');
    setError('');
    try {
      const blob = await uriToBlob(uri);
      const data = await previewCall(blob, 'audio/mp4', token);
      setPreview(data);
      setStatus('preview');
    } catch (e: any) {
      setError(e.message || 'Erro ao processar áudio');
      setStatus('idle');
    }
  }

  async function confirmCall() {
    if (!preview) return;
    setStatus('calling');
    try {
      await sendCall(token, preview.msgId, phone);
      setStatus('done');
    } catch (e: any) {
      setError(e.message || 'Erro ao ligar');
      setStatus('preview');
    }
  }

  function reset() {
    setPreview(null);
    setError('');
    setStatus('idle');
  }

  const previewAudioUrl = preview ? `${API}/audio/${preview.msgId}` : '';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>iVox</Text>
          <Text style={styles.subtitle}>Fale em qualquer língua · Ligação em inglês</Text>
        </View>

        {/* Phone input */}
        <View style={styles.phoneRow}>
          <TextInput
            style={styles.phoneInput}
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 (201) 555-0000"
            placeholderTextColor="#8888aa"
            keyboardType="phone-pad"
            editable={status === 'idle' || status === 'preview'}
          />
          <TouchableOpacity
            style={styles.contactsBtn}
            onPress={() => setShowContacts(v => !v)}
          >
            <Text style={styles.contactsBtnText}>📋</Text>
          </TouchableOpacity>
        </View>

        {/* Contact list */}
        {showContacts && (
          <View style={styles.contactsList}>
            {contacts.length === 0
              ? <Text style={styles.noContacts}>Nenhum contato salvo ainda</Text>
              : (
                <FlatList
                  data={contacts}
                  keyExtractor={c => c.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.contactItem}
                      onPress={() => { setPhone(item.phone); setShowContacts(false); }}
                    >
                      <Text style={styles.contactName}>{item.name}</Text>
                      <Text style={styles.contactPhone}>{item.phone}</Text>
                    </TouchableOpacity>
                  )}
                />
              )
            }
          </View>
        )}

        {/* Main action */}
        {status === 'idle' && (
          <TouchableOpacity style={styles.recordBtn} onPress={startRecording}>
            <Text style={styles.recordBtnIcon}>🎙️</Text>
            <Text style={styles.recordBtnText}>Gravar mensagem</Text>
          </TouchableOpacity>
        )}

        {status === 'recording' && (
          <TouchableOpacity style={[styles.recordBtn, styles.recordingBtn]} onPress={stopRecording}>
            <Text style={styles.recordBtnIcon}>⏹️</Text>
            <Text style={styles.recordBtnText}>Parar  {countdown}s</Text>
          </TouchableOpacity>
        )}

        {status === 'processing' && (
          <View style={styles.processingRow}>
            <ActivityIndicator color="#a78bfa" />
            <Text style={styles.processingText}>Transcrevendo e traduzindo…</Text>
          </View>
        )}

        {/* Preview */}
        {(status === 'preview' || status === 'calling') && preview && (
          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>Você disse (PT/ES):</Text>
            <Text style={styles.previewOrig}>"{preview.transcription}"</Text>
            <Text style={styles.previewLabel}>O lead vai ouvir (EN):</Text>
            <Text style={styles.previewTrans}>"{preview.translation}"</Text>

            <View style={styles.previewBtns}>
              <TouchableOpacity style={styles.rerecordBtn} onPress={reset} disabled={status === 'calling'}>
                <Text style={styles.rerecordBtnText}>Regravar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.callBtn} onPress={confirmCall} disabled={status === 'calling'}>
                {status === 'calling'
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.callBtnText}>📞 Confirmar e Ligar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Done */}
        {status === 'done' && (
          <View style={styles.doneCard}>
            <Text style={styles.doneIcon}>✅</Text>
            <Text style={styles.doneText}>Ligação realizada!</Text>
            <TouchableOpacity style={styles.newCallBtn} onPress={reset}>
              <Text style={styles.newCallBtnText}>Nova ligação</Text>
            </TouchableOpacity>
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

async function uriToBlob(uri: string): Promise<Blob> {
  const r = await fetch(uri);
  return r.blob();
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: '#0e1035' },
  container:       { flex: 1, padding: 20 },
  header:          { alignItems: 'center', marginBottom: 28, marginTop: 8 },
  logo:            { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  subtitle:        { fontSize: 13, color: '#8888aa', marginTop: 4, textAlign: 'center' },
  phoneRow:        { flexDirection: 'row', gap: 10, marginBottom: 10 },
  phoneInput:      { flex: 1, backgroundColor: '#1a1a40', color: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1, borderColor: '#333366' },
  contactsBtn:     { width: 52, backgroundColor: '#1a1a40', borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333366' },
  contactsBtnText: { fontSize: 22 },
  contactsList:    { backgroundColor: '#1a1a40', borderRadius: 14, maxHeight: 200, marginBottom: 12, borderWidth: 1, borderColor: '#333366' },
  noContacts:      { color: '#8888aa', textAlign: 'center', padding: 20, fontSize: 13 },
  contactItem:     { padding: 14, borderBottomWidth: 1, borderBottomColor: '#333366' },
  contactName:     { color: '#fff', fontWeight: '700', fontSize: 15 },
  contactPhone:    { color: '#8888aa', fontSize: 13, marginTop: 2 },
  recordBtn:       { backgroundColor: '#7c3aed', borderRadius: 20, paddingVertical: 22, alignItems: 'center', marginTop: 20, shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  recordingBtn:    { backgroundColor: '#dc2626' },
  recordBtnIcon:   { fontSize: 32, marginBottom: 6 },
  recordBtnText:   { color: '#fff', fontSize: 16, fontWeight: '900' },
  processingRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 30 },
  processingText:  { color: '#a78bfa', fontSize: 15, fontWeight: '600' },
  previewCard:     { backgroundColor: '#1a1a40', borderRadius: 18, padding: 18, marginTop: 20, borderWidth: 1, borderColor: '#333366' },
  previewLabel:    { color: '#8888aa', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  previewOrig:     { color: '#c4b5fd', fontSize: 14, fontStyle: 'italic', marginBottom: 14 },
  previewTrans:    { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 18 },
  previewBtns:     { flexDirection: 'row', gap: 10 },
  rerecordBtn:     { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#333366', alignItems: 'center' },
  rerecordBtnText: { color: '#8888aa', fontWeight: '700' },
  callBtn:         { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: '#059669', alignItems: 'center', shadowColor: '#059669', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  callBtnText:     { color: '#fff', fontWeight: '900', fontSize: 15 },
  doneCard:        { alignItems: 'center', marginTop: 40 },
  doneIcon:        { fontSize: 52, marginBottom: 10 },
  doneText:        { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 20 },
  newCallBtn:      { backgroundColor: '#7c3aed', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  newCallBtnText:  { color: '#fff', fontWeight: '900', fontSize: 15 },
  errorText:       { color: '#f87171', textAlign: 'center', marginTop: 14, fontSize: 13 },
});
