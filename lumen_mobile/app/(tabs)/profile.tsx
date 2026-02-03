/**
 * Profile Screen
 * ==============
 * Tela de perfil com todos os dados do cadastro.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import api from '@/services/api';

const colors = {
  primary: '#1A859B',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#E8E8E8',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
};

interface ProfileData {
  full_name: string | null;
  birth_date: string | null;
  photo_url: string | null;
  phone_e164: string | null;
  phone_verified: boolean;
  city: string | null;
  state: string | null;
  life_state_label: string | null;
  marital_status_label: string | null;
  vocational_reality_label: string | null;
  consecration_year: number | null;
  has_vocational_accompaniment: boolean | null;
  vocational_accompanist_name: string | null;
  interested_in_ministry: boolean | null;
  ministry_interest_notes: string | null;
  status: string;
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editField, setEditField] = useState<string>('');
  const [editValue, setEditValue] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        const parts = token.split(':');
        if (parts.length >= 3) {
          setEmail(parts[2]);
        }
      }

      const response = await api.get('/profile');
      setProfile(response.data);
    } catch (error: any) {
      console.log('Erro ao carregar perfil:', error);
      if (error.response?.status === 404) {
        // Perfil não existe ainda
        setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Sair',
      'Deseja realmente sair da sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await SecureStore.deleteItemAsync('auth_token');
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const handleEditField = (field: string, currentValue: string | null) => {
    setEditField(field);
    setEditValue(currentValue || '');
    setEditModalVisible(true);
  };

  const handleSaveField = async () => {
    setSaving(true);
    try {
      const updateData: any = {};
      updateData[editField] = editValue || null;
      
      await api.put('/profile', updateData);
      await loadProfile();
      setEditModalVisible(false);
      Alert.alert('Sucesso', 'Dados atualizados com sucesso!');
    } catch (error) {
      console.log('Erro ao salvar:', error);
      Alert.alert('Erro', 'Não foi possível salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para alterar sua foto.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      // TODO: Upload da imagem para o servidor
      Alert.alert('Em breve', 'Upload de foto será implementado em breve.');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Não informado';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      full_name: 'Nome Completo',
      city: 'Cidade',
      state: 'Estado',
      vocational_accompanist_name: 'Nome do Acompanhador',
      ministry_interest_notes: 'Observações sobre Ministério',
    };
    return labels[field] || field;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
      }
    >
      {/* Header com Foto */}
      <View style={styles.headerCard}>
        <TouchableOpacity style={styles.avatarContainer} onPress={handlePickImage}>
          {profile?.photo_url ? (
            <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={48} color={colors.white} />
            </View>
          )}
          <View style={styles.editBadge}>
            <Ionicons name="camera" size={14} color={colors.white} />
          </View>
        </TouchableOpacity>
        
        <Text style={styles.userName}>{profile?.full_name || 'Nome não informado'}</Text>
        <Text style={styles.userEmail}>{email}</Text>
        
        <View style={[
          styles.statusChip, 
          profile?.status === 'COMPLETE' ? styles.statusComplete : styles.statusIncomplete
        ]}>
          <Text style={styles.statusText}>
            {profile?.status === 'COMPLETE' ? '✓ Perfil Completo' : '⏳ Perfil Incompleto'}
          </Text>
        </View>
      </View>

      {/* Dados Pessoais */}
      <Text style={styles.sectionTitle}>Dados Pessoais</Text>
      <View style={styles.card}>
        <ProfileRow 
          icon="person-outline"
          label="Nome Completo"
          value={profile?.full_name}
          onEdit={() => handleEditField('full_name', profile?.full_name)}
        />
        <ProfileRow 
          icon="calendar-outline"
          label="Data de Nascimento"
          value={formatDate(profile?.birth_date)}
          editable={false}
        />
        <ProfileRow 
          icon="location-outline"
          label="Cidade"
          value={profile?.city}
          onEdit={() => handleEditField('city', profile?.city)}
        />
        <ProfileRow 
          icon="map-outline"
          label="Estado"
          value={profile?.state}
          onEdit={() => handleEditField('state', profile?.state)}
        />
      </View>

      {/* Contato */}
      <Text style={styles.sectionTitle}>Contato</Text>
      <View style={styles.card}>
        <ProfileRow 
          icon="mail-outline"
          label="Email"
          value={email}
          editable={false}
        />
        <ProfileRow 
          icon="call-outline"
          label="Telefone"
          value={profile?.phone_e164 || 'Não informado'}
          verified={profile?.phone_verified}
          editable={false}
        />
      </View>

      {/* Informações Católicas */}
      <Text style={styles.sectionTitle}>Informações da Comunidade</Text>
      <View style={styles.card}>
        <ProfileRow 
          icon="heart-outline"
          label="Estado de Vida"
          value={profile?.life_state_label}
          editable={false}
        />
        <ProfileRow 
          icon="people-outline"
          label="Estado Civil"
          value={profile?.marital_status_label}
          editable={false}
        />
        <ProfileRow 
          icon="star-outline"
          label="Realidade Vocacional"
          value={profile?.vocational_reality_label}
          editable={false}
        />
        {profile?.consecration_year && (
          <ProfileRow 
            icon="ribbon-outline"
            label="Ano de Consagração"
            value={profile.consecration_year.toString()}
            editable={false}
          />
        )}
      </View>

      {/* Acompanhamento */}
      <Text style={styles.sectionTitle}>Acompanhamento Vocacional</Text>
      <View style={styles.card}>
        <ProfileRow 
          icon="hand-left-outline"
          label="Possui Acompanhamento"
          value={profile?.has_vocational_accompaniment ? 'Sim' : 'Não'}
          editable={false}
        />
        {profile?.has_vocational_accompaniment && (
          <ProfileRow 
            icon="person-circle-outline"
            label="Acompanhador"
            value={profile?.vocational_accompanist_name}
            onEdit={() => handleEditField('vocational_accompanist_name', profile?.vocational_accompanist_name)}
          />
        )}
      </View>

      {/* Interesse em Ministério */}
      <Text style={styles.sectionTitle}>Interesse em Ministério</Text>
      <View style={styles.card}>
        <ProfileRow 
          icon="flag-outline"
          label="Interesse em Ministério"
          value={profile?.interested_in_ministry ? 'Sim' : 'Não'}
          editable={false}
        />
        {profile?.interested_in_ministry && profile?.ministry_interest_notes && (
          <ProfileRow 
            icon="document-text-outline"
            label="Observações"
            value={profile.ministry_interest_notes}
            onEdit={() => handleEditField('ministry_interest_notes', profile?.ministry_interest_notes)}
          />
        )}
      </View>

      {/* Botão Sair */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={styles.logoutText}>Sair da Conta</Text>
      </TouchableOpacity>

      {/* Versão */}
      <Text style={styles.version}>Lumen+ v1.0.0</Text>

      {/* Modal de Edição */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar {getFieldLabel(editField)}</Text>
            
            <TextInput
              style={styles.modalInput}
              value={editValue}
              onChangeText={setEditValue}
              placeholder={`Digite ${getFieldLabel(editField).toLowerCase()}`}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalSaveButton}
                onPress={handleSaveField}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalSaveText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// Componente para cada linha do perfil
interface ProfileRowProps {
  icon: string;
  label: string;
  value: string | null | undefined;
  verified?: boolean;
  editable?: boolean;
  onEdit?: () => void;
}

function ProfileRow({ icon, label, value, verified, editable = true, onEdit }: ProfileRowProps) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon as any} size={22} color={colors.gray} />
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value || 'Não informado'}</Text>
      </View>
      {verified !== undefined && (
        <Ionicons 
          name={verified ? "checkmark-circle" : "alert-circle"} 
          size={20} 
          color={verified ? colors.success : colors.warning} 
        />
      )}
      {editable && onEdit && (
        <TouchableOpacity onPress={onEdit} style={styles.editButton}>
          <Ionicons name="create-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightGray,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
  },
  headerCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#171717',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: colors.gray,
    marginBottom: 12,
  },
  statusChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusComplete: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  statusIncomplete: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#171717',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#171717',
    marginBottom: 8,
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowContent: {
    flex: 1,
    marginLeft: 12,
  },
  rowLabel: {
    fontSize: 12,
    color: colors.gray,
  },
  rowValue: {
    fontSize: 15,
    color: '#171717',
    marginTop: 2,
  },
  editButton: {
    padding: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.error,
    gap: 8,
  },
  logoutText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.gray,
    marginTop: 20,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#171717',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: colors.gray,
  },
  modalSaveButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '600',
  },
});
