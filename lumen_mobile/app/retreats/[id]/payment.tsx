/**
 * Payment Proof Screen
 * ====================
 * Permite ao membro selecionar e enviar o comprovante de pagamento.
 */

import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '@/services/api';

const colors = {
  primary: '#1A859B',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
};

export default function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess]    = useState(false);
  const [error, setError]        = useState<string | null>(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permissão para acessar a galeria negada');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setError(null);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setError('Permissão para usar a câmera negada');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!imageUri) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();

      if (imageUri.startsWith('data:') || imageUri.startsWith('blob:')) {
        // Web: converte data URL / blob URL para Blob antes de enviar
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const ext = blob.type.split('/')[1] || 'jpg';
        formData.append('file', blob, `proof_${Date.now()}.${ext}`);
      } else {
        // React Native nativo: formato { uri, name, type }
        const filename = imageUri.split('/').pop() || 'proof.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append('file', { uri: imageUri, name: filename, type } as any);
      }

      await api.postForm(`/retreats/${id}/my-registration/payment`, formData);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message || 'Erro ao enviar comprovante. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.center}>
        <Ionicons name="checkmark-circle" size={72} color="#059669" />
        <Text style={styles.successTitle}>Comprovante enviado!</Text>
        <Text style={styles.successDesc}>
          Seu comprovante foi enviado com sucesso. Aguarde a confirmação da equipe.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Voltar ao retiro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
        <Text style={styles.infoText}>
          Tire uma foto ou selecione da galeria o comprovante do pagamento (Pix, transferência, etc.)
        </Text>
      </View>

      {/* Preview */}
      {imageUri ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
          <TouchableOpacity style={styles.changeBtn} onPress={pickImage}>
            <Text style={styles.changeBtnText}>Trocar imagem</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.pickArea}>
          <Ionicons name="image-outline" size={56} color="#d1d5db" />
          <Text style={styles.pickText}>Nenhuma imagem selecionada</Text>
          <View style={styles.pickBtns}>
            <TouchableOpacity style={styles.pickBtn} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={20} color={colors.primary} />
              <Text style={styles.pickBtnText}>Câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickBtn} onPress={pickImage}>
              <Ionicons name="images-outline" size={20} color={colors.primary} />
              <Text style={styles.pickBtnText}>Galeria</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={18} color="#dc2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.uploadBtn, (!imageUri || uploading) && { opacity: 0.5 }]}
        onPress={handleUpload}
        disabled={!imageUri || uploading}
      >
        {uploading
          ? <ActivityIndicator color={colors.white} />
          : <>
              <Ionicons name="cloud-upload-outline" size={20} color={colors.white} />
              <Text style={styles.uploadBtnText}>Enviar comprovante</Text>
            </>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  infoBox: {
    flexDirection: 'row', gap: 10, backgroundColor: `${colors.primary}12`,
    borderRadius: 12, padding: 14, alignItems: 'flex-start',
  },
  infoText: { fontSize: 13, color: '#1e3a5f', flex: 1, lineHeight: 18 },
  previewContainer: { alignItems: 'center', gap: 10 },
  preview: { width: '100%', height: 260, borderRadius: 16, backgroundColor: '#e5e7eb' },
  changeBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.primary, borderRadius: 8,
  },
  changeBtnText: { color: colors.primary, fontWeight: '600' },
  pickArea: {
    backgroundColor: colors.white, borderRadius: 16, padding: 32,
    alignItems: 'center', gap: 12, borderWidth: 2, borderColor: '#e5e7eb', borderStyle: 'dashed',
  },
  pickText: { fontSize: 14, color: colors.gray },
  pickBtns: { flexDirection: 'row', gap: 12 },
  pickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: 10,
  },
  pickBtnText: { color: colors.primary, fontWeight: '600' },
  errorBox: {
    flexDirection: 'row', gap: 8, backgroundColor: '#fef2f2', borderRadius: 10,
    padding: 12, alignItems: 'center',
  },
  errorText: { color: '#dc2626', fontSize: 13, flex: 1 },
  uploadBtn: {
    backgroundColor: colors.primary, borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  uploadBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  successTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  successDesc: { fontSize: 14, color: colors.gray, textAlign: 'center', lineHeight: 20 },
  btn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
  btnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
