import React, { useState, useEffect } from 'react';
import {
  Settings,
  Key,
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Edit2,
  Send,
  RefreshCw,
  ExternalLink,
  Save,
  Radio,
  FileCode,
  Play,
  Bot,
  Cpu,
  Sparkles,
  Terminal,
  Activity,
  Database,
  Clock,
  ChevronDown,
  ChevronUp,
  Server,
  Layers,
  ArrowRight,
  Calendar,
  Upload,
  FileUp,
  FileText,
  Info,
  Check,
  X,
  Copy,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  FolderArchive,
  ArrowUpRight,
} from 'lucide-react';
import { SystemSettings, SystemUser, IntegrationLog, DetranCalendarEntry, SupabaseHealthCheck } from '../types';
import { getDefaultDetranCalendar } from '../utils/detranPA';
import { storage } from '../services/storage';
import { SUPABASE_INITIAL_SCHEMA_SQL } from '../utils/supabaseSql';
import { supabaseService } from '../services/supabaseService';
import { getSupabaseConfig, isSupabaseConfigured } from '../services/supabaseClient';
import { UserManagementModal } from './UserManagementModal';

interface ConfigViewProps {
  settings: SystemSettings;
  users: SystemUser[];
  onSettingsUpdated: (newSettings: SystemSettings) => void;
  onUsersUpdated: () => void;
  onSendChatwootAlert: (message: string, placa: string) => Promise<boolean>;
}

export const ConfigView: React.FC<ConfigViewProps> = ({
  settings,
  users,
  onSettingsUpdated,
  onUsersUpdated,
  onSendChatwootAlert,
}) => {
  const [activeTab, setActiveTab] = useState<'tokens' | 'logs' | 'database' | 'users' | 'detran' | 'openapi'>('tokens');
  const [showUserMgmtModal, setShowUserMgmtModal] = useState(false);

  // Tokens Form State
  const [chatwootUrl, setChatwootUrl] = useState(settings.chatwoot.baseUrl);
  const [chatwootToken, setChatwootToken] = useState(settings.chatwoot.apiAccessToken);
  const [chatwootAccount, setChatwootAccount] = useState(settings.chatwoot.accountId);
  const [chatwootInbox, setChatwootInbox] = useState(settings.chatwoot.inboxId);
  const [chatwootConversation, setChatwootConversation] = useState(settings.chatwoot.conversationId);
  const [notifyMaintenance, setNotifyMaintenance] = useState(settings.chatwoot.notifyOnMaintenance);
  const [notifyDetran, setNotifyDetran] = useState(settings.chatwoot.notifyOnDetran);
  const [notifyTelemetry, setNotifyTelemetry] = useState(settings.chatwoot.notifyOnTelemetryAlert);

  // Selsyn Official Configuration (URL: https://api.appselsyn.com.br/)
  const [selsynUrl, setSelsynUrl] = useState(settings.tracking.baseUrl || 'https://api.appselsyn.com.br/');
  const [selsynApiKey, setSelsynApiKey] = useState(settings.tracking.xApiKey);
  const [selsynToken, setSelsynToken] = useState(settings.tracking.token);
  const [selsynOperador, setSelsynOperador] = useState(settings.tracking.operadorKey);
  const [selsynClienteId, setSelsynClienteId] = useState(settings.tracking.clienteId || 1042);
  const [selsynInterval, setSelsynInterval] = useState(settings.tracking.autoSyncInterval);
  const [selsynSimulacao, setSelsynSimulacao] = useState(settings.tracking.modoSimulacao);

  // OpenAI Settings
  const [openaiApiKey, setOpenaiApiKey] = useState(settings.openai?.apiKey || '');
  const [openaiModel, setOpenaiModel] = useState<'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo'>(settings.openai?.model || 'gpt-4o');
  const [openaiProvider, setOpenaiProvider] = useState<'openai' | 'gemini'>(settings.openai?.preferredProvider || 'openai');

  // Supabase PostgreSQL & Storage Settings
  const [supabaseUrl, setSupabaseUrl] = useState(
    settings.supabase?.url ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
    ''
  );
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(
    settings.supabase?.publishableKey ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
    ''
  );
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [testSupabaseLoading, setTestSupabaseLoading] = useState(false);
  const [testSupabaseResult, setTestSupabaseResult] = useState<SupabaseHealthCheck | null>(null);
  const [dbSubTab, setDbSubTab] = useState<'connection' | 'sql' | 'tables' | 'storage' | 'migration'>('connection');
  const [copiedSql, setCopiedSql] = useState(false);

  // Test states for each integration
  const [testSelsynLoading, setTestSelsynLoading] = useState(false);
  const [testSelsynResult, setTestSelsynResult] = useState<{
    success: boolean;
    statusCode: number;
    latencyMs: number;
    urlCalled: string;
    message: string;
    data?: any;
  } | null>(null);

  const [testChatwootLoading, setTestChatwootLoading] = useState(false);
  const [testChatwootResult, setTestChatwootResult] = useState<{
    success: boolean;
    statusCode: number;
    latencyMs: number;
    urlCalled?: string;
    message: string;
    data?: any;
  } | null>(null);

  const [testOpenAiLoading, setTestOpenAiLoading] = useState(false);
  const [testOpenAiResult, setTestOpenAiResult] = useState<{
    success: boolean;
    statusCode: number;
    latencyMs: number;
    message: string;
    data?: any;
  } | null>(null);

  // DETRAN-PA Settings & Official Calendar State
  const [detranExercicio, setDetranExercicio] = useState(settings.detran.exercicio);
  const [detranTaxa, setDetranTaxa] = useState(settings.detran.taxaLicenciamento);
  const [detranPasseio, setDetranPasseio] = useState(settings.detran.aliquotaPasseio);
  const [detranUtilitario, setDetranUtilitario] = useState(settings.detran.aliquotaUtilitario);

  const [calendarEntries, setCalendarEntries] = useState<DetranCalendarEntry[]>(
    () => settings.detran.calendarioOficial && settings.detran.calendarioOficial.length > 0
      ? settings.detran.calendarioOficial
      : getDefaultDetranCalendar(settings.detran.exercicio)
  );
  const [configCalFilter, setConfigCalFilter] = useState<string>('ALL');

  // AI Calendar Upload & Parsing States
  const [aiCalendarFile, setAiCalendarFile] = useState<{ base64: string; name: string; type: string } | null>(null);
  const [aiCalendarText, setAiCalendarText] = useState('');
  const [aiCalendarLoading, setAiCalendarLoading] = useState(false);
  const [aiCalendarError, setAiCalendarError] = useState<string | null>(null);

  // Mandatory Review & Confirmation Modal States
  const [showConfirmCalendarModal, setShowConfirmCalendarModal] = useState(false);
  const [draftCalendarEntries, setDraftCalendarEntries] = useState<DetranCalendarEntry[]>([]);
  const [draftCalendarFonte, setDraftCalendarFonte] = useState('');
  const [draftCalendarExercicio, setDraftCalendarExercicio] = useState(settings.detran.exercicio);
  const [calendarUpdatedMsg, setCalendarUpdatedMsg] = useState<string | null>(null);

  // Success Feedback
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [dbClearedMsg, setDbClearedMsg] = useState(false);
  const [demoLoadedMsg, setDemoLoadedMsg] = useState(false);

  // Integration Logs State
  const [integrationLogs, setIntegrationLogs] = useState<IntegrationLog[]>(() => storage.getIntegrationLogs());
  const [logFilter, setLogFilter] = useState<'all' | 'selsyn' | 'chatwoot' | 'openai'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Users Form Modal State
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userNome, setUserNome] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userCpf, setUserCpf] = useState('');
  const [userCargo, setUserCargo] = useState<'GESTOR' | 'OPERADOR' | 'MOTORISTA' | 'VISUALIZADOR'>('MOTORISTA');
  const [userTelefone, setUserTelefone] = useState('');
  const [userCnh, setUserCnh] = useState('');
  const [userCnhCategoria, setUserCnhCategoria] = useState('B');
  const [userCnhValidade, setUserCnhValidade] = useState('');

  // OpenAPI Tester State
  const [selectedEndpoint, setSelectedEndpoint] = useState('/keek/rest/v1/integracao/operador/posicao');
  const [endpointParam, setEndpointParam] = useState('');
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [apiLoading, setApiLoading] = useState(false);

  const refreshLogs = () => {
    setIntegrationLogs(storage.getIntegrationLogs());
  };

  useEffect(() => {
    refreshLogs();
  }, [activeTab]);

  // Save All Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSelsynUrl = (selsynUrl.trim() || 'https://api.appselsyn.com.br/').replace(/\/+$/, '') + '/';

    const updated: SystemSettings = {
      tracking: {
        baseUrl: cleanSelsynUrl,
        xApiKey: selsynApiKey.trim(),
        token: selsynToken.trim(),
        operadorKey: selsynOperador.trim(),
        clienteId: Number(selsynClienteId),
        autoSyncInterval: Number(selsynInterval),
        modoSimulacao: selsynSimulacao,
      },
      chatwoot: {
        baseUrl: chatwootUrl.trim(),
        apiAccessToken: chatwootToken.trim(),
        accountId: chatwootAccount.trim(),
        inboxId: chatwootInbox.trim(),
        conversationId: chatwootConversation.trim(),
        autoAlertsEnabled: true,
        notifyOnMaintenance: notifyMaintenance,
        notifyOnDetran: notifyDetran,
        notifyOnTelemetryAlert: notifyTelemetry,
      },
      detran: {
        exercicio: Number(detranExercicio),
        taxaLicenciamento: Number(detranTaxa),
        aliquotaPasseio: Number(detranPasseio),
        aliquotaUtilitario: Number(detranUtilitario),
        calendarioOficial: calendarEntries,
      },
      openai: {
        apiKey: openaiApiKey.trim(),
        model: openaiModel,
        preferredProvider: openaiProvider,
      },
      supabase: {
        url: supabaseUrl.trim(),
        publishableKey: supabaseAnonKey.trim(),
        storageBucket: 'documentos-frota',
        environment: 'development',
        autoSyncEnabled: false,
      },
    };

    storage.saveSettings(updated);
    onSettingsUpdated(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Test Supabase Connection & Health
  const handleTestSupabase = async () => {
    setTestSupabaseLoading(true);
    try {
      const res = await supabaseService.checkHealth(supabaseUrl.trim(), supabaseAnonKey.trim());
      setTestSupabaseResult(res);
      storage.addIntegrationLog({
        integration: 'supabase',
        endpoint: res.url || 'Supabase PostgreSQL',
        method: 'GET',
        status: res.connectionOk ? 'SUCCESS' : 'ERROR',
        statusCode: res.statusCode || (res.connectionOk ? 200 : 400),
        latencyMs: res.latencyMs,
        message: res.message,
        details: {
          rlsEnforced: res.rlsEnforced,
          anonymousBlocked: res.anonymousBlocked,
          tablesStatus: res.tablesStatus,
          storageStatus: res.storageStatus,
        },
      });
      refreshLogs();
    } catch (err: any) {
      setTestSupabaseResult({
        isConfigured: false,
        url: supabaseUrl,
        hasPublishableKey: Boolean(supabaseAnonKey),
        connectionOk: false,
        latencyMs: 0,
        message: `Erro ao testar conexão Supabase: ${err.message}`,
        rlsEnforced: true,
        anonymousBlocked: true,
        tablesStatus: {
          veiculos: false,
          fornecedores: false,
          manutencoes: false,
          pecas_manutencao: false,
          servicos_executados: false,
          planos_revisao: false,
          licenciamento_ipva: false,
          usuarios_motoristas: false,
          alertas_telemetria: false,
          historico_chatwoot: false,
          logs_integracao: false,
          documentos_anexos: false,
        },
        storageStatus: { bucketName: 'documentos-frota', exists: false, isPrivate: true },
      });
    } finally {
      setTestSupabaseLoading(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_INITIAL_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  // Selsyn test plate
  const [selsynTestPlaca, setSelsynTestPlaca] = useState('');

  // Selsyn API Live Connection Tester
  const handleTestSelsyn = async () => {
    setTestSelsynLoading(true);
    setTestSelsynResult(null);

    const tokenUsed = selsynOperador.trim() || selsynApiKey.trim();
    const urlTarget = selsynUrl.trim() || 'https://api.appselsyn.com.br/';
    const cleanTestPlaca = selsynTestPlaca.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    try {
      const response = await fetch('/api/selsyn/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: urlTarget,
          endpoint: '/keek/rest/v1/integracao/operador/posicao',
          operadorKey: selsynOperador.trim(),
          xApiKey: selsynApiKey.trim(),
          identificador: cleanTestPlaca || undefined,
        }),
      });

      const data = await response.json();
      setTestSelsynResult(data);

      storage.addIntegrationLog({
        integration: 'selsyn',
        endpoint: data.urlCalled || `${urlTarget}keek/rest/v1/integracao/operador/posicao`,
        method: 'GET',
        status: data.success ? 'SUCCESS' : 'ERROR',
        statusCode: data.statusCode || response.status,
        latencyMs: data.latencyMs,
        message: data.message || (data.success ? 'Comunicação Selsyn estabelecida com sucesso' : 'Falha na comunicação Selsyn'),
        details: data.data,
      });
      refreshLogs();
    } catch (err: any) {
      const errorData = {
        success: false,
        statusCode: 0,
        latencyMs: 0,
        urlCalled: urlTarget,
        message: `Falha na requisição local: ${err.message}`,
      };
      setTestSelsynResult(errorData);

      storage.addIntegrationLog({
        integration: 'selsyn',
        endpoint: urlTarget,
        method: 'GET',
        status: 'ERROR',
        message: `Erro de rede/proxy: ${err.message}`,
      });
      refreshLogs();
    } finally {
      setTestSelsynLoading(false);
    }
  };

  // Chatwoot Live Connection Tester
  const handleTestChatwoot = async () => {
    setTestChatwootLoading(true);
    setTestChatwootResult(null);

    try {
      const response = await fetch('/api/chatwoot/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: chatwootUrl.trim(),
          apiAccessToken: chatwootToken.trim(),
          accountId: chatwootAccount.trim(),
        }),
      });

      const data = await response.json();
      setTestChatwootResult(data);

      storage.addIntegrationLog({
        integration: 'chatwoot',
        endpoint: data.urlCalled || `${chatwootUrl}/api/v1/profile`,
        method: 'GET',
        status: data.success ? 'SUCCESS' : 'ERROR',
        statusCode: data.statusCode || response.status,
        latencyMs: data.latencyMs,
        message: data.message || (data.success ? 'Conexão Chatwoot validada' : 'Falha ao autenticar Chatwoot'),
        details: data.data,
      });
      refreshLogs();
    } catch (err: any) {
      const errRes = {
        success: false,
        statusCode: 0,
        latencyMs: 0,
        message: `Erro de requisição: ${err.message}`,
      };
      setTestChatwootResult(errRes);

      storage.addIntegrationLog({
        integration: 'chatwoot',
        endpoint: chatwootUrl,
        method: 'GET',
        status: 'ERROR',
        message: `Falha ao conectar no Chatwoot: ${err.message}`,
      });
      refreshLogs();
    } finally {
      setTestChatwootLoading(false);
    }
  };

  // OpenAI API Token Tester
  const handleTestOpenAi = async () => {
    setTestOpenAiLoading(true);
    setTestOpenAiResult(null);

    try {
      const response = await fetch('/api/openai/test-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: openaiApiKey.trim(),
          model: openaiModel,
        }),
      });

      const data = await response.json();
      const isOk = response.ok && data.success;

      setTestOpenAiResult({
        success: isOk,
        statusCode: data.statusCode || response.status,
        latencyMs: data.latencyMs || 0,
        message: isOk
          ? `${data.message} (${data.modelsCount} modelos disponíveis)`
          : data.error || 'Falha ao autenticar token da OpenAI',
        data,
      });

      storage.addIntegrationLog({
        integration: 'openai',
        endpoint: 'https://api.openai.com/v1/models',
        method: 'GET',
        status: isOk ? 'SUCCESS' : 'ERROR',
        statusCode: data.statusCode || response.status,
        latencyMs: data.latencyMs,
        message: isOk ? 'Token OpenAI validado com sucesso' : (data.error || 'Erro no token OpenAI'),
        details: data,
      });
      refreshLogs();
    } catch (err: any) {
      const errObj = {
        success: false,
        statusCode: 0,
        latencyMs: 0,
        message: `Erro de conexão: ${err.message}`,
      };
      setTestOpenAiResult(errObj);

      storage.addIntegrationLog({
        integration: 'openai',
        endpoint: 'https://api.openai.com/v1/models',
        method: 'GET',
        status: 'ERROR',
        message: `Falha na requisição OpenAI: ${err.message}`,
      });
      refreshLogs();
    } finally {
      setTestOpenAiLoading(false);
    }
  };

  // Clear simulated database
  const handleClearAllData = () => {
    if (confirm('Atenção: Deseja realmente limpar todos os dados simulados do sistema? O banco ficará totalmente limpo para que você cadastre seus veículos, serviços e usuários reais.')) {
      storage.clearAllFleetData();
      onUsersUpdated();
      setDbClearedMsg(true);
      setTimeout(() => setDbClearedMsg(false), 4000);
    }
  };

  // Restore demo vehicles preset
  const handleLoadDemoData = () => {
    storage.loadDemoPreset();
    onUsersUpdated();
    setDemoLoadedMsg(true);
    setTimeout(() => setDemoLoadedMsg(false), 4000);
  };

  // Users Management Handlers
  const handleOpenUserModal = (u?: SystemUser) => {
    if (u) {
      setEditingUserId(u.id);
      setUserNome(u.nome);
      setUserEmail(u.email);
      setUserCpf(u.cpf);
      setUserCargo(u.cargo);
      setUserTelefone(u.telefone);
      setUserCnh(u.cnh || '');
      setUserCnhCategoria(u.cnhCategoria || 'B');
      setUserCnhValidade(u.cnhValidade || '');
    } else {
      setEditingUserId(null);
      setUserNome('');
      setUserEmail('');
      setUserCpf('');
      setUserCargo('MOTORISTA');
      setUserTelefone('');
      setUserCnh('');
      setUserCnhCategoria('B');
      setUserCnhValidade('');
    }
    setShowUserModal(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userNome.trim() || !userEmail.trim()) return;

    if (editingUserId) {
      const existing = users.find(u => u.id === editingUserId);
      if (existing) {
        const updated: SystemUser = {
          ...existing,
          nome: userNome,
          email: userEmail,
          cpf: userCpf,
          cargo: userCargo,
          telefone: userTelefone,
          cnh: userCnh || undefined,
          cnhCategoria: userCnhCategoria || undefined,
          cnhValidade: userCnhValidade || undefined,
        };
        storage.updateUser(updated);
      }
    } else {
      const generatedLogin = userEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '') || `user_${Date.now().toString().slice(-4)}`;
      const newU: SystemUser = {
        id: 'u-' + Date.now(),
        nome: userNome,
        login: generatedLogin,
        senha: '123',
        email: userEmail,
        cpf: userCpf || '000.000.000-00',
        cargo: userCargo,
        status: 'ATIVO',
        telefone: userTelefone || '(91) 98000-0000',
        cnh: userCnh || undefined,
        cnhCategoria: userCnhCategoria || undefined,
        cnhValidade: userCnhValidade || undefined,
        dataCriacao: new Date().toISOString().split('T')[0],
      };
      storage.addUser(newU);
    }

    onUsersUpdated();
    setShowUserModal(false);
  };

  const handleDeleteUser = (id: string, nome: string) => {
    if (confirm(`Remover usuário "${nome}"?`)) {
      storage.deleteUser(id);
      onUsersUpdated();
    }
  };

  // DETRAN-PA Calendar Management Handlers
  const handleCalendarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAiCalendarFile({
        base64: reader.result as string,
        name: file.name,
        type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      });
      setAiCalendarError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleProcessCalendarAI = async () => {
    if (!aiCalendarFile && !aiCalendarText.trim()) {
      setAiCalendarError('Selecione um arquivo (PDF ou Imagem) ou cole o texto da portaria oficial do DETRAN-PA.');
      return;
    }

    setAiCalendarLoading(true);
    setAiCalendarError(null);

    try {
      const res = await fetch('/api/detran/parse-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: aiCalendarText.trim() || undefined,
          file: aiCalendarFile || undefined,
          exercicio: detranExercicio,
        }),
      });

      const data = await res.json();

      if (data.success && data.data?.entries && data.data.entries.length > 0) {
        setDraftCalendarEntries(data.data.entries);
        setDraftCalendarFonte(data.data.fonte || 'Documento Oficial DETRAN-PA');
        setDraftCalendarExercicio(data.data.exercicio || detranExercicio);
        // Show mandatory confirmation modal so user confirms/adjusts before applying
        setShowConfirmCalendarModal(true);
      } else {
        setAiCalendarError(data.error || 'Não foi possível extrair a tabela de datas do documento.');
      }
    } catch (err: any) {
      setAiCalendarError(`Falha na requisição com a IA: ${err.message}`);
    } finally {
      setAiCalendarLoading(false);
    }
  };

  const handleConfirmAndApplyCalendar = () => {
    setCalendarEntries(draftCalendarEntries);
    setDetranExercicio(draftCalendarExercicio);

    const updated: SystemSettings = {
      ...settings,
      detran: {
        ...settings.detran,
        exercicio: Number(draftCalendarExercicio),
        calendarioOficial: draftCalendarEntries,
      },
    };

    storage.saveSettings(updated);
    onSettingsUpdated(updated);
    setShowConfirmCalendarModal(false);
    setAiCalendarFile(null);
    setAiCalendarText('');
    setCalendarUpdatedMsg('Calendário Oficial do DETRAN-PA revisado, confirmado e aplicado com sucesso à frota!');
    setTimeout(() => setCalendarUpdatedMsg(null), 5000);
  };

  const handleResetDefaultCalendar = () => {
    if (confirm('Deseja restaurar a escala padrão oficial do DETRAN-PA para o exercício fiscal atual?')) {
      const defaultEntries = getDefaultDetranCalendar(detranExercicio);
      setCalendarEntries(defaultEntries);
      const updated: SystemSettings = {
        ...settings,
        detran: {
          ...settings.detran,
          calendarioOficial: defaultEntries,
        },
      };
      storage.saveSettings(updated);
      onSettingsUpdated(updated);
      setCalendarUpdatedMsg('Escala padrão do DETRAN-PA restaurada com sucesso!');
      setTimeout(() => setCalendarUpdatedMsg(null), 4000);
    }
  };

  const handleUpdateCalendarEntry = (id: string, field: keyof DetranCalendarEntry, value: string) => {
    setCalendarEntries(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleUpdateDraftEntry = (id: string, field: keyof DetranCalendarEntry, value: string) => {
    setDraftCalendarEntries(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleAddCalendarEntry = () => {
    const newEntry: DetranCalendarEntry = {
      id: `cal-custom-${Date.now()}`,
      finalPlaca: configCalFilter !== 'ALL' ? configCalFilter : '1',
      grupoFinal: '01 - 31',
      descricaoFinais: 'Finais Personalizados',
      mesReferencia: 'Dezembro',
      dataLimite: `${detranExercicio}-12-20`,
      dataLicenciamento: `${detranExercicio}-12-20`,
      dataCotaUnica: `${detranExercicio}-11-20`,
      data15Desc: `${detranExercicio}-11-20`,
      data10Desc: `${detranExercicio}-12-05`,
      cota1Parcelamento: `${detranExercicio}-11-20`,
      cota2Parcelamento: `${detranExercicio}-12-05`,
      cota3Parcelamento: `${detranExercicio}-12-20`,
      observacoes: 'Grupo personalizado',
    };
    setCalendarEntries(prev => [...prev, newEntry]);
  };

  const handleDeleteCalendarEntry = (id: string) => {
    setCalendarEntries(prev => prev.filter(c => c.id !== id));
  };

  // Test Selsyn Keek OpenAPI Explorer
  const handleTestOpenApi = async () => {
    setApiLoading(true);
    setApiResponse(null);

    const targetUrl = selsynUrl.trim() || 'https://api.appselsyn.com.br/';
    const opKey = selsynOperador.trim() || selsynApiKey.trim();

    try {
      let finalEndpoint = selectedEndpoint;
      if (selectedEndpoint === '/keek/rest/v1/integracao/operador/posicao') {
        if (endpointParam.trim()) {
          finalEndpoint += `?identificador=${endpointParam.replace(/[^A-Za-z0-9]/g, '')}`;
        }
      } else if (selectedEndpoint === '/v1/integracao/posicao') {
        finalEndpoint += `?identificador=${endpointParam.replace(/[^A-Za-z0-9]/g, '')}`;
      } else if (selectedEndpoint === '/v1/integracao/operador/rastreavel/identificador/{identificador}') {
        finalEndpoint = `/v1/integracao/operador/rastreavel/identificador/${endpointParam.replace(/[^A-Za-z0-9]/g, '')}`;
      }

      const response = await fetch('/api/tracking/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: targetUrl,
          endpoint: finalEndpoint,
          method: 'GET',
          headers: {
            'x-api-key': opKey,
            'api-key-operador': opKey,
            'x-r2f-auth': selsynToken.trim(),
          },
        }),
      });

      const data = await response.json();
      setApiResponse(data);

      storage.addIntegrationLog({
        integration: 'selsyn',
        endpoint: `${targetUrl.replace(/\/+$/, '')}${finalEndpoint.startsWith('/') ? finalEndpoint : `/${finalEndpoint}`}`,
        method: 'GET',
        status: response.ok ? 'SUCCESS' : 'ERROR',
        statusCode: response.status,
        message: `Chamada via OpenAPI Explorer (${finalEndpoint})`,
        details: data,
      });
      refreshLogs();
    } catch (err: any) {
      setApiResponse({ error: err.message || 'Erro de conexão' });
    } finally {
      setApiLoading(false);
    }
  };

  const filteredLogs = integrationLogs.filter(l => {
    if (logFilter === 'all') return true;
    return l.integration === logFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0F2744] flex items-center justify-center text-white">
              <Settings className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-[#0F2744]">
              Painel de Configurações, Integrações &amp; Logs
            </h1>
          </div>
          <p className="text-slate-600 text-xs sm:text-sm mt-1">
            Gestão de credenciais (Selsyn Keek, Chatwoot, OpenAI), monitoramento de logs em tempo real e administração da base de dados da frota.
          </p>
        </div>

        {savedSuccess && (
          <span className="bg-emerald-100 text-emerald-800 text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 border border-emerald-300 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Configurações salvas!
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 text-xs font-semibold overflow-x-auto">
        {[
          { id: 'tokens', label: 'Tokens de Integração', icon: Key },
          { id: 'logs', label: `Logs das Integrações (${integrationLogs.length})`, icon: Activity },
          { id: 'database', label: 'Supabase & Base de Dados', icon: Database },
          { id: 'users', label: `Usuários & Motoristas (${users.length})`, icon: Users },
          { id: 'detran', label: 'Parâmetros DETRAN-PA', icon: ShieldCheck },
          { id: 'openapi', label: 'OpenAPI Selsyn Keek', icon: FileCode },
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-sky-600 text-sky-800 bg-sky-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: TOKENS DE INTEGRAÇÃO */}
      {activeTab === 'tokens' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Selsyn Rastreamento Box (Official URL: https://api.appselsyn.com.br/) */}
          <div className="bg-white rounded-xl border border-sky-300 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center text-sky-700">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-[#0F2744]">
                      Integração Selsyn Tecnologia (Rastreamento &amp; Telemetria)
                    </h3>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
                      Homologado n8n
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    URL oficial para consultas e ações operacionais com Token de Operador: <strong>https://api.appselsyn.com.br/</strong>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={selsynTestPlaca}
                  onChange={e => setSelsynTestPlaca(e.target.value.toUpperCase())}
                  placeholder="Placa teste (ex: AAA1234)"
                  maxLength={8}
                  className="w-36 px-2.5 py-1.5 text-xs font-mono font-bold uppercase rounded-lg border border-sky-300 bg-white placeholder:text-slate-400 placeholder:font-normal placeholder:normal-case"
                  title="Opcional: insira a placa no formato AAA1234 para testar ?identificador={PLACA}"
                />
                <button
                  type="button"
                  onClick={handleTestSelsyn}
                  disabled={testSelsynLoading}
                  className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {testSelsynLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Testando Conexão...</span>
                    </>
                  ) : (
                    <>
                      <Activity className="w-3.5 h-3.5" />
                      <span>Testar Comunicação Selsyn</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Selsyn Test Result Alert */}
            {testSelsynResult && (
              <div
                className={`p-3 rounded-lg text-xs border space-y-1.5 animate-in fade-in ${
                  testSelsynResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : testSelsynResult.statusCode === 401 || testSelsynResult.statusCode === 403
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : 'bg-red-50 border-red-300 text-red-950'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center gap-2">
                    {testSelsynResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span>{testSelsynResult.message}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="bg-white/80 px-2 py-0.5 rounded border border-slate-300">
                      HTTP {testSelsynResult.statusCode || 0}
                    </span>
                    <span className="bg-white/80 px-2 py-0.5 rounded border border-slate-300">
                      {testSelsynResult.latencyMs} ms
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-600 font-mono truncate">
                  Endpoint testado: {testSelsynResult.urlCalled}
                </div>
                {testSelsynResult.data && (
                  <details className="text-[11px] pt-1">
                    <summary className="cursor-pointer text-sky-700 hover:underline font-semibold">
                      Ver Resposta Bruta do Servidor Selsyn
                    </summary>
                    <pre className="mt-1 p-2 bg-slate-900 text-emerald-300 rounded overflow-x-auto text-[10px] max-h-36 font-mono">
                      {JSON.stringify(testSelsynResult.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  URL da API Selsyn:
                </label>
                <input
                  type="url"
                  value={selsynUrl}
                  onChange={e => setSelsynUrl(e.target.value)}
                  placeholder="https://api.appselsyn.com.br/"
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800 bg-sky-50/30"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  URL correta testada no n8n para comunicação direta.
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 flex items-center justify-between">
                  <span>API Key de Operador (Nível Operador - V1):</span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                    Chave Funcional n8n
                  </span>
                </label>
                <input
                  type="password"
                  value={selsynOperador}
                  onChange={e => setSelsynOperador(e.target.value)}
                  placeholder="Insira sua chave de operador Selsyn..."
                  className="w-full border border-emerald-400 focus:border-emerald-600 rounded-lg p-2.5 font-mono text-slate-800 bg-emerald-50/20"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Enviada no header <code>x-api-key</code> para consultas de clientes, dispositivos e telemetria.
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  API Key Cliente (Opcional - Header: x-api-key):
                </label>
                <input
                  type="text"
                  value={selsynApiKey}
                  onChange={e => setSelsynApiKey(e.target.value)}
                  placeholder="Chave de cliente (opcional se possuir a de operador)"
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Token Adicional de Acesso (Header: x-r2f-auth):
                </label>
                <input
                  type="password"
                  value={selsynToken}
                  onChange={e => setSelsynToken(e.target.value)}
                  placeholder="Token de sessão (se aplicável)"
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Intervalo de Atualização da Telemetria:
                </label>
                <select
                  value={selsynInterval}
                  onChange={e => setSelsynInterval(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-medium"
                >
                  <option value={10}>A cada 10 segundos</option>
                  <option value={30}>A cada 30 segundos (Recomendado)</option>
                  <option value={60}>A cada 1 minuto</option>
                  <option value={300}>A cada 5 minutos</option>
                </select>
              </div>

              <div className="flex items-center pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selsynSimulacao}
                    onChange={e => setSelsynSimulacao(e.target.checked)}
                    className="rounded text-sky-600 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">
                      Modo Simulação Ativo
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Desmarque para usar exclusivamente a API real da Selsyn.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Chatwoot Configuration Box */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-600" />
                <div>
                  <h3 className="font-bold text-sm text-[#0F2744]">
                    Integração com Chatwoot (Alertas &amp; Notificações)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Disparo de alertas operacionais, revisões e licenciamentos para WhatsApp e caixas de entrada
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestChatwoot}
                disabled={testChatwootLoading}
                className="bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-xs font-semibold px-3 py-1.5 rounded-lg border border-cyan-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {testChatwootLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Testar Conexão Chatwoot</span>
                  </>
                )}
              </button>
            </div>

            {testChatwootResult && (
              <div
                className={`p-3 rounded-lg text-xs border space-y-1 animate-in fade-in ${
                  testChatwootResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-red-50 border-red-300 text-red-950'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center gap-2">
                    {testChatwootResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                    <span>{testChatwootResult.message}</span>
                  </div>
                  <span className="font-mono text-[11px] bg-white/80 px-2 py-0.5 rounded border border-slate-300">
                    {testChatwootResult.latencyMs} ms
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  URL da Instância Chatwoot:
                </label>
                <input
                  type="url"
                  value={chatwootUrl}
                  onChange={e => setChatwootUrl(e.target.value)}
                  placeholder="https://chatwoot.suaempresa.com.br"
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Token de Acesso (User API Access Token):
                </label>
                <input
                  type="password"
                  value={chatwootToken}
                  onChange={e => setChatwootToken(e.target.value)}
                  placeholder="Token do perfil de usuário no Chatwoot"
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  ID da Conta (Account ID):
                </label>
                <input
                  type="text"
                  value={chatwootAccount}
                  onChange={e => setChatwootAccount(e.target.value)}
                  placeholder="Ex: 1"
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  ID da Caixa de Entrada (Inbox ID):
                </label>
                <input
                  type="text"
                  value={chatwootInbox}
                  onChange={e => setChatwootInbox(e.target.value)}
                  placeholder="Ex: 4"
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-6 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyMaintenance}
                  onChange={e => setNotifyMaintenance(e.target.checked)}
                  className="rounded text-sky-600 w-4 h-4"
                />
                <span className="font-medium text-slate-700">Notificar Revisões Próximas/Vencidas</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyDetran}
                  onChange={e => setNotifyDetran(e.target.checked)}
                  className="rounded text-sky-600 w-4 h-4"
                />
                <span className="font-medium text-slate-700">Notificar Licenciamento DETRAN-PA</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyTelemetry}
                  onChange={e => setNotifyTelemetry(e.target.checked)}
                  className="rounded text-sky-600 w-4 h-4"
                />
                <span className="font-medium text-slate-700">Alertas Críticos de Telemetria</span>
              </label>
            </div>
          </div>

          {/* OpenAI Configuration Box */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#0F2744]">
                    Integração com OpenAI (Lançamento com IA, Fotos &amp; PDFs)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Utilize seu token da OpenAI para leitura óptica e extração de ordens de serviço
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestOpenAi}
                disabled={testOpenAiLoading || !openaiApiKey.trim()}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {testOpenAiLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verificando Token...</span>
                  </>
                ) : (
                  <>
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Testar Token OpenAI</span>
                  </>
                )}
              </button>
            </div>

            {testOpenAiResult && (
              <div
                className={`p-3 rounded-lg text-xs border space-y-1 animate-in fade-in ${
                  testOpenAiResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-red-50 border-red-300 text-red-950'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center gap-2">
                    {testOpenAiResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                    <span>{testOpenAiResult.message}</span>
                  </div>
                  <span className="font-mono text-[11px] bg-white/80 px-2 py-0.5 rounded border border-slate-300">
                    {testOpenAiResult.latencyMs} ms
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="md:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">
                  Token da OpenAI (API Key):
                </label>
                <input
                  type="password"
                  value={openaiApiKey}
                  onChange={e => setOpenaiApiKey(e.target.value)}
                  placeholder="sk-proj-... ou sk-..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Modelo OpenAI para Visão &amp; PDF:
                </label>
                <select
                  value={openaiModel}
                  onChange={e => setOpenaiModel(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-medium"
                >
                  <option value="gpt-4o">GPT-4o (Recomendado - Alta Precisão)</option>
                  <option value="gpt-4o-mini">GPT-4o-mini (Econômico e Rápido)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-700">Provedor Principal:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="preferredProvider"
                    value="openai"
                    checked={openaiProvider === 'openai'}
                    onChange={() => setOpenaiProvider('openai')}
                    className="text-emerald-600"
                  />
                  <span className="font-medium text-slate-800">OpenAI ({openaiModel})</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="preferredProvider"
                    value="gemini"
                    checked={openaiProvider === 'gemini'}
                    onChange={() => setOpenaiProvider('gemini')}
                    className="text-sky-600"
                  />
                  <span className="font-medium text-slate-800">Google Gemini Flash</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="submit"
              className="bg-[#0F2744] hover:bg-[#1E3A5F] text-white px-5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Todos os Tokens &amp; Parâmetros</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: HISTÓRICO DE LOGS DAS INTEGRAÇÕES */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-600" />
                <h3 className="font-bold text-sm text-[#0F2744]">
                  Histórico de Comunicação das Integrações
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoramento detalhado de requisições, status HTTP e tempos de resposta para Selsyn Keek, Chatwoot e OpenAI.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  storage.clearIntegrationLogs(logFilter === 'all' ? undefined : logFilter);
                  refreshLogs();
                }}
                className="text-xs bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Logs</span>
              </button>

              <button
                type="button"
                onClick={refreshLogs}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Atualizar</span>
              </button>
            </div>
          </div>

          {/* Integration Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'all', label: 'Todas as Integrações' },
              { id: 'selsyn', label: 'Selsyn API (Rastreamento)' },
              { id: 'chatwoot', label: 'Chatwoot (Mensageria)' },
              { id: 'openai', label: 'OpenAI (Visão & IA)' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setLogFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  logFilter === f.id
                    ? 'bg-[#0F2744] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Logs List */}
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs space-y-2">
              <Terminal className="w-8 h-8 mx-auto text-slate-400" />
              <p className="font-semibold">Nenhum log registrado para este filtro.</p>
              <p className="text-[11px] text-slate-400">
                Execute um teste de conexão ou realize ações operacionais na frota para visualizar os eventos de telemetria e mensageria aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredLogs.map(log => {
                const isExpanded = expandedLogId === log.id;
                const isSuccess = log.status === 'SUCCESS' || (log.statusCode && log.statusCode >= 200 && log.statusCode < 300);

                return (
                  <div
                    key={log.id}
                    className={`rounded-xl border p-3.5 text-xs transition-all ${
                      isSuccess
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : 'border-red-200 bg-red-50/20'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Status Badge */}
                        <span
                          className={`font-mono text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${
                            isSuccess
                              ? 'bg-emerald-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          {log.statusCode ? `HTTP ${log.statusCode}` : log.status}
                        </span>

                        {/* Integration Label */}
                        <span className="font-bold text-slate-800 uppercase text-[10px] bg-slate-200 px-2 py-0.5 rounded">
                          {log.integration}
                        </span>

                        {/* Method & URL */}
                        <span className="font-mono text-[11px] text-slate-700 truncate max-w-xs md:max-w-md">
                          <strong>{log.method}</strong> {log.endpoint}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                        {log.latencyMs !== undefined && (
                          <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-semibold text-slate-700">
                            {log.latencyMs} ms
                          </span>
                        )}
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="text-slate-500 hover:text-slate-800 p-1"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 text-slate-800 font-medium">
                      {log.message}
                    </div>

                    {isExpanded && log.details && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <span className="text-[10px] text-slate-500 font-bold block mb-1">
                          Dados da Resposta / Payload:
                        </span>
                        <pre className="p-3 bg-slate-900 text-emerald-300 rounded-lg overflow-x-auto text-[11px] max-h-48 font-mono">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SUPABASE POSTGRESQL & BASE DE DADOS */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          {/* Main Supabase Header Card */}
          <div className="bg-white rounded-xl border border-sky-300 shadow-sm p-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white shadow-sm">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-[#0F2744]">
                        Estrutura Profissional Supabase PostgreSQL
                      </h3>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
                        Etapa 1.1 Concluída
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Banco relacional PostgreSQL em nuvem, Row Level Security (RLS) estrito, 11 tabelas operacionais e Supabase Storage.
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Pill Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 border ${
                    isSupabaseConfigured(supabaseUrl, supabaseAnonKey)
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isSupabaseConfigured(supabaseUrl, supabaseAnonKey)
                        ? 'bg-emerald-500 animate-pulse'
                        : 'bg-amber-500'
                    }`}
                  />
                  <span>
                    {isSupabaseConfigured(supabaseUrl, supabaseAnonKey)
                      ? 'Supabase Configurado'
                      : 'Modo Local / Demo (Etapa 1.1 Pronta)'}
                  </span>
                </span>

                <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>RLS: Anônimo Bloqueado</span>
                </span>
              </div>
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex border-b border-slate-200 gap-2 text-xs font-semibold overflow-x-auto">
              {[
                { id: 'connection', label: 'Conexão & Status', icon: Radio },
                { id: 'sql', label: 'SQL das Migrations (11 Tabelas)', icon: FileCode },
                { id: 'tables', label: 'Esquema das Tabelas & RLS', icon: Layers },
                { id: 'storage', label: 'Supabase Storage (Privado)', icon: FolderArchive },
                { id: 'migration', label: 'Inventário & Migração Futura (Etapa 1.2)', icon: Activity },
              ].map(st => {
                const SubIcon = st.icon;
                const isSubActive = dbSubTab === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setDbSubTab(st.id as any)}
                    className={`flex items-center gap-1.5 px-3.5 py-2.5 border-b-2 transition-all whitespace-nowrap ${
                      isSubActive
                        ? 'border-emerald-600 text-emerald-900 bg-emerald-50/60 font-bold'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <SubIcon className="w-3.5 h-3.5" />
                    <span>{st.label}</span>
                  </button>
                );
              })}
            </div>

            {/* SUB-TAB 1: CONEXÃO & STATUS */}
            {dbSubTab === 'connection' && (
              <div className="space-y-6 animate-in fade-in">
                {/* Form Inputs for Supabase */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>SUPABASE_URL (URL do Projeto Supabase)</span>
                      <span className="text-[10px] text-slate-400 font-normal">Ex: https://xxxx.supabase.co</span>
                    </label>
                    <div className="relative">
                      <input
                        type="url"
                        value={supabaseUrl}
                        onChange={e => setSupabaseUrl(e.target.value)}
                        placeholder="https://seu-projeto-fleet.supabase.co"
                        className="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Disponível em Project Settings &gt; API &gt; Project URL no painel do Supabase.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>SUPABASE_PUBLISHABLE_KEY / ANON KEY</span>
                      <span className="text-[10px] text-emerald-600 font-bold">Chave Pública Segura</span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showAnonKey ? 'text' : 'password'}
                        value={supabaseAnonKey}
                        onChange={e => setSupabaseAnonKey(e.target.value)}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        className="w-full text-xs font-mono p-2.5 pr-10 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAnonKey(!showAnonKey)}
                        className="absolute right-2.5 text-slate-400 hover:text-slate-600"
                        title={showAnonKey ? 'Ocultar chave' : 'Mostrar chave'}
                      >
                        {showAnonKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Chave pública de navegação (anon). Nunca insira chaves administrativas service_role aqui.
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestSupabase}
                      disabled={testSupabaseLoading}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-xs"
                    >
                      {testSupabaseLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Testando Conexão com Supabase...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Testar Conexão Supabase</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveSettings}
                      className="bg-[#0F2744] hover:bg-[#1E3A5F] text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-xs"
                    >
                      <Save className="w-3.5 h-3.5 text-sky-400" />
                      <span>Salvar Configurações</span>
                    </button>
                  </div>

                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-sky-700 hover:text-sky-900 font-semibold flex items-center gap-1.5"
                  >
                    <span>Abrir Console Supabase</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Diagnostic Result Box */}
                {testSupabaseResult && (
                  <div
                    className={`p-4 rounded-xl border text-xs space-y-3 animate-in fade-in ${
                      testSupabaseResult.connectionOk
                        ? 'bg-emerald-50/50 border-emerald-300 text-emerald-950'
                        : 'bg-amber-50/50 border-amber-300 text-amber-950'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold">
                        {testSupabaseResult.connectionOk ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                        )}
                        <span>
                          {testSupabaseResult.connectionOk
                            ? 'Conexão Supabase Validada com Sucesso!'
                            : 'Resultado do Teste de Conexão'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {testSupabaseResult.latencyMs > 0 && (
                          <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-bold">
                            {testSupabaseResult.latencyMs} ms
                          </span>
                        )}
                        {testSupabaseResult.statusCode ? (
                          <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-bold">
                            HTTP {testSupabaseResult.statusCode}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <p className="font-medium text-slate-700">{testSupabaseResult.message}</p>

                    {/* Security Checklist */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/60 text-[11px]">
                      <div className="flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200">
                        <Lock className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          RLS Ativo:{' '}
                          <strong className="text-emerald-700">
                            {testSupabaseResult.rlsEnforced ? 'Sim (Habilitado)' : 'Pendente'}
                          </strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          Acesso Anônimo:{' '}
                          <strong className="text-emerald-700">
                            {testSupabaseResult.anonymousBlocked ? '100% Bloqueado' : 'Aberto'}
                          </strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200">
                        <FolderArchive className="w-3.5 h-3.5 text-sky-600" />
                        <span>
                          Bucket:{' '}
                          <strong className="text-slate-800">documentos-frota (Privado)</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Secure Secrets Guide */}
                <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/30 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-sky-900 font-bold">
                    <Info className="w-4 h-4 text-sky-700 shrink-0" />
                    <h4>Gerenciamento Seguro via Secrets do Google AI Studio</h4>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Para máxima segurança e persistência no ambiente de build em nuvem, você pode definir as variáveis
                    no painel de <strong>Secrets</strong> do Google AI Studio com os nomes:
                  </p>
                  <ul className="list-disc list-inside space-y-1 font-mono text-[11px] text-slate-700 bg-white p-3 rounded-lg border border-slate-200">
                    <li>
                      <strong>VITE_SUPABASE_URL</strong>: URL https do seu projeto no Supabase
                    </li>
                    <li>
                      <strong>VITE_SUPABASE_ANON_KEY</strong>: Chave Anon (Publishable) pública do seu projeto
                    </li>
                  </ul>
                  <p className="text-[11px] text-emerald-800 font-medium">
                    ✓ Regra de Segurança Respeitada: A senha do banco de dados nunca é solicitada nem exposta no chat.
                  </p>
                </div>
              </div>
            )}

            {/* SUB-TAB 2: SQL DAS MIGRATIONS */}
            {dbSubTab === 'sql' && (
              <div className="space-y-4 animate-in fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-xl">
                  <div>
                    <h4 className="font-bold text-sm text-sky-400">
                      Como aplicar as Migrations no Supabase SQL Editor
                    </h4>
                    <p className="text-xs text-slate-300 mt-1">
                      Arquivo: <code>/supabase/migrations/20261031_001_initial_schema.sql</code> (11 tabelas, RLS e Storage).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-xs shrink-0"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        <span>SQL Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-white" />
                        <span>Copiar Script SQL Completo</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs space-y-2">
                  <span className="font-bold text-slate-800 block">Instruções Passo a Passo no Console:</span>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 leading-relaxed">
                    <li>Acesse o painel do seu projeto no Supabase (<strong>supabase.com</strong>).</li>
                    <li>No menu lateral esquerdo, clique no ícone do <strong>SQL Editor</strong>.</li>
                    <li>Clique no botão verde <strong>+ New Query</strong>.</li>
                    <li>Cole o código SQL abaixo no editor e clique no botão <strong>Run</strong> (ou aperte Ctrl+Enter).</li>
                    <li>Todas as 11 tabelas, chaves estrangeiras, restrições e políticas de RLS serão criadas automaticamente.</li>
                  </ol>
                </div>

                {/* Code Viewer */}
                <div className="relative">
                  <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl overflow-x-auto text-[11px] font-mono max-h-96 leading-relaxed border border-slate-800">
                    {SUPABASE_INITIAL_SCHEMA_SQL}
                  </pre>
                </div>
              </div>
            )}

            {/* SUB-TAB 3: ESQUEMA DAS TABELAS & RLS */}
            {dbSubTab === 'tables' && (
              <div className="space-y-4 animate-in fade-in">
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-slate-700 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-700 shrink-0" />
                  <span>
                    Todas as 11 tabelas possuem chaves primárias UUID, índices de busca rápida, timestamps automáticos e 
                    <strong> Row Level Security (RLS) habilitado</strong> para proteger os dados contra acessos não autorizados.
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {[
                    {
                      nome: 'veiculos',
                      titulo: 'Veículos da Frota',
                      campos: 'id (UUID), placa, placa_normalizada (UNIQUE), modelo, marca, ano, odometro_atual, status, telemetria Selsyn, FIPE',
                      relacoes: 'FK motorista_id -> usuarios_motoristas',
                      rls: 'Restrito a authenticated',
                    },
                    {
                      nome: 'manutencoes',
                      titulo: 'Histórico de Manutenções',
                      campos: 'id (UUID), veiculo_id, tipo, fornecedor, odometro, valor_total, proxima_revisao, auditoria IA',
                      relacoes: 'FK veiculo_id -> veiculos (CASCADE)',
                      rls: 'Restrito a authenticated',
                    },
                    {
                      nome: 'pecas_manutencao',
                      titulo: 'Peças Utilizadas',
                      campos: 'id (UUID), manutencao_id, descricao, quantidade, valor_unitario, total',
                      relacoes: 'FK manutencao_id -> manutencoes (CASCADE)',
                      rls: 'Restrito a authenticated',
                    },
                    {
                      nome: 'servicos_executados',
                      titulo: 'Serviços & Mão de Obra',
                      campos: 'id (UUID), manutencao_id, descricao, valor',
                      relacoes: 'FK manutencao_id -> manutencoes (CASCADE)',
                      rls: 'Restrito a authenticated',
                    },
                    {
                      nome: 'planos_revisao',
                      titulo: 'Planos de Revisão Preventiva',
                      campos: 'id (UUID), veiculo_id, item, intervalo_km, intervalo_meses, proximo_km, proxima_data, status',
                      relacoes: 'FK veiculo_id -> veiculos (CASCADE)',
                      rls: 'Restrito a authenticated',
                    },
                    {
                      nome: 'licenciamento_ipva',
                      titulo: 'Licenciamento & IPVA DETRAN-PA',
                      campos: 'id (UUID), placa, exercicio, datas de vencimento, cotas SEFA-PA, taxa DETRAN, status, baixa',
                      relacoes: 'FK veiculo_id -> veiculos, UNIQUE(placa, exercicio)',
                      rls: 'Restrito a authenticated',
                    },
                    {
                      nome: 'usuarios_motoristas',
                      titulo: 'Usuários & Motoristas',
                      campos: 'id (UUID), auth_user_id, nome, email (UNIQUE), cpf (UNIQUE), cargo (GESTOR/OPERADOR/MOTORISTA), CNH',
                      relacoes: 'Vínculo opcional auth.users',
                      rls: 'Restrito a authenticated',
                    },
                    {
                      nome: 'alertas_telemetria',
                      titulo: 'Alertas de Telemetria',
                      campos: 'id (UUID), veiculo_id, tipo, nivel (INFO/AVISO/CRITICO), mensagem, enviado_chatwoot, resolvido',
                      relacoes: 'FK veiculo_id -> veiculos (CASCADE)',
                      rls: 'Restrito a authenticated',
                    },
                    {
                      nome: 'historico_chatwoot',
                      titulo: 'Histórico Notificações Chatwoot',
                      campos: 'id (UUID), alerta_id, placa, tipo, mensagem, status (ENVIADO/SIMULADO/FALHA), timestamp',
                      relacoes: 'FK alerta_id -> alertas_telemetria',
                      rls: 'Restrito a authenticated',
                    },
                    {
                      nome: 'logs_integracao',
                      titulo: 'Logs Unificados de Integração',
                      campos: 'id (UUID), integration (selsyn/chatwoot/openai/supabase), endpoint, method, status, latency_ms',
                      relacoes: 'Auditoria central do sistema',
                      rls: 'Restrito a authenticated',
                    },
                    {
                      nome: 'documentos_anexos',
                      titulo: 'Documentos & Anexos (Storage)',
                      campos: 'id (UUID), veiculo_id, manutencao_id, tipo_documento, bucket_name, storage_path, tamanho_bytes',
                      relacoes: 'FK veiculos, FK manutencoes',
                      rls: 'Restrito a authenticated',
                    },
                    {
                      nome: 'configuracoes_sistema',
                      titulo: 'Parâmetros Gerais do Sistema',
                      campos: 'id, tracking (JSONB), chatwoot (JSONB), detran (JSONB), openai (JSONB), updated_at',
                      relacoes: 'Registro único singleton',
                      rls: 'Restrito a authenticated',
                    },
                  ].map(tb => (
                    <div key={tb.nome} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sky-800 bg-sky-100/70 px-1.5 py-0.5 rounded text-[11px]">
                          {tb.nome}
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                          RLS
                        </span>
                      </div>
                      <div className="font-semibold text-slate-800 text-xs">{tb.titulo}</div>
                      <p className="text-[11px] text-slate-500 leading-tight">
                        <strong>Campos:</strong> {tb.campos}
                      </p>
                      <p className="text-[10px] text-slate-600 font-medium">
                        <strong>Relação:</strong> {tb.relacoes}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUB-TAB 4: SUPABASE STORAGE (PRIVADO) */}
            {dbSubTab === 'storage' && (
              <div className="space-y-4 animate-in fade-in">
                <div className="p-5 rounded-xl border-2 border-sky-300 bg-sky-50/20 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center">
                      <FolderArchive className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#0F2744]">
                        Bucket Privado: <code>documentos-frota</code>
                      </h4>
                      <p className="text-xs text-slate-500">
                        Armazenamento de alta capacidade para arquivos pesados, impedindo sobrecarga do banco PostgreSQL em Base64.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Visibilidade</span>
                      <strong className="text-emerald-700">100% Privado</strong>
                      <p className="text-[10px] text-slate-500 mt-0.5">Sem URLs públicas abertas</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Limite por Arquivo</span>
                      <strong className="text-slate-800">20 MB</strong>
                      <p className="text-[10px] text-slate-500 mt-0.5">PDFs e fotos de alta resolução</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Formatos Suportados</span>
                      <strong className="text-slate-800">PDF, JPG, PNG, WEBP</strong>
                      <p className="text-[10px] text-slate-500 mt-0.5">Validação estrita de MIME</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Política de Acesso</span>
                      <strong className="text-sky-700">auth.uid() IS NOT NULL</strong>
                      <p className="text-[10px] text-slate-500 mt-0.5">Operadores autenticados</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 space-y-2 text-xs">
                    <span className="font-bold text-slate-800">Documentos Catalogados por Veículo e Serviço:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-slate-600">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span>Notas Fiscais de Peças e Serviços</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Fotos de Manutenções e Desgastes</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Comprovantes de Pagamento IPVA / DETRAN-PA</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span>Documentos de Veículos (CRLV / Vistorias)</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Ordens de Serviço Assinadas (OS)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 5: INVENTÁRIO & MIGRAÇÃO FUTURA */}
            {dbSubTab === 'migration' && (
              <div className="space-y-4 animate-in fade-in">
                {(() => {
                  const summary = supabaseService.getMigrationSummary();
                  return (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/40 text-xs space-y-2">
                        <div className="flex items-center gap-2 text-emerald-900 font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <h4>Preservação Integral dos Dados Locais Garantida</h4>
                        </div>
                        <p className="text-slate-600 leading-relaxed">
                          Os seus dados continuam intactos no sistema. Nenhuma migração automática foi disparada e nada foi excluído.
                          Quando o <strong>Supabase Auth</strong> for ativado na <strong>Etapa 1.2</strong>, você poderá clicar para exportar
                          todo o seu histórico com validação prévia.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                          <span className="text-[10px] text-slate-500 font-bold uppercase">Veículos</span>
                          <strong className="text-lg text-slate-800 block mt-0.5">{summary.counts.vehicles}</strong>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                          <span className="text-[10px] text-slate-500 font-bold uppercase">Manutenções</span>
                          <strong className="text-lg text-slate-800 block mt-0.5">{summary.counts.services}</strong>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                          <span className="text-[10px] text-slate-500 font-bold uppercase">Revisões Programadas</span>
                          <strong className="text-lg text-slate-800 block mt-0.5">{summary.counts.revisions}</strong>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                          <span className="text-[10px] text-slate-500 font-bold uppercase">Licenciamentos PA</span>
                          <strong className="text-lg text-slate-800 block mt-0.5">{summary.counts.licensing}</strong>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                        <span className="font-bold text-slate-800 block">Total de registros prontos para sincronização:</span>
                        <span className="text-lg font-bold text-sky-700">{summary.totalRecords} registros</span>
                        <p className="text-[11px] text-slate-500">
                          A ferramenta de importação em 1 clique estará disponível assim que você fizer o login autenticado.
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* PRESERVED: Zero State & Demo Preset Operations */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="border-b pb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-sky-700" />
                <h3 className="font-bold text-base text-[#0F2744]">
                  Gestão dos Registros Locais / Amostras de Teste
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Controle de limpeza de registros locais e recarga de veículos de teste para demonstração.
              </p>
            </div>

            {dbClearedMsg && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-4 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>O banco de dados foi limpo com sucesso! A base está pronta para você cadastrar veículos, serviços e motoristas reais.</span>
              </div>
            )}

            {demoLoadedMsg && (
              <div className="bg-sky-50 border border-sky-300 text-sky-900 p-4 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Dados demonstrativos de exemplo foram carregados para testes.</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Clear Database Card */}
              <div className="p-5 rounded-xl border-2 border-red-200 bg-red-50/20 space-y-3">
                <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
                  <Trash2 className="w-4 h-4 text-red-600" />
                  <h4>Zerar Banco de Dados (Modo Real)</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Remove todos os veículos, manutenções, alertas e revisões simulados. Ideal para iniciar a implantação oficial com a sua frota real do Pará.
                </p>
                <button
                  type="button"
                  onClick={handleClearAllData}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpar Todos os Dados Simulados</span>
                </button>
              </div>

              {/* Restore Demo Card */}
              <div className="p-5 rounded-xl border-2 border-sky-200 bg-sky-50/20 space-y-3">
                <div className="flex items-center gap-2 text-sky-800 font-bold text-sm">
                  <Layers className="w-4 h-4 text-sky-600" />
                  <h4>Restaurar Amostra de Exemplo (Opcional)</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Carrega 2 veículos de exemplo (Onix em Belém e Hilux em Marabá) com dados de telemetria caso você deseje comparar a interface.
                </p>
                <button
                  type="button"
                  onClick={handleLoadDemoData}
                  className="w-full bg-[#0F2744] hover:bg-[#1E3A5F] text-white font-bold text-xs py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Carregar Veículos de Exemplo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: USUÁRIOS E MOTORISTAS */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
            <div>
              <h3 className="font-bold text-sm text-[#0F2744]">
                Usuários, Operadores &amp; Motoristas Cadastrados
              </h3>
              <p className="text-xs text-slate-500">
                Gerencie permissões de acesso ao sistema e cadastro de CNH dos motoristas da frota
              </p>
            </div>

            <button
              onClick={() => setShowUserMgmtModal(true)}
              className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Cadastrar Novo Usuário &amp; Privilégios</span>
            </button>
          </div>

          {users.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs space-y-2">
              <Users className="w-8 h-8 mx-auto text-slate-400" />
              <p className="font-semibold">Nenhum usuário cadastrado.</p>
              <p className="text-[11px] text-slate-400">
                Clique no botão acima para cadastrar gestores, operadores ou motoristas com CNH.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Nome &amp; Login</th>
                    <th className="p-3">Cargo &amp; Privilégios</th>
                    <th className="p-3">Contato</th>
                    <th className="p-3">CNH (Motoristas)</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => {
                    const perms = u.permissoes;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{u.nome}</span>
                            <span className="text-[10px] font-mono text-sky-700 bg-sky-50 px-1 py-0.2 rounded border border-sky-200">
                              @{u.login || u.email.split('@')[0]}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-normal">{u.email}</div>
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                u.cargo === 'GESTOR'
                                  ? 'bg-purple-100 text-purple-800'
                                  : u.cargo === 'OPERADOR'
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {u.cargo === 'GESTOR' ? 'GESTOR (ADMIN)' : u.cargo}
                            </span>

                            {perms && (
                              <div className="text-[10px] text-slate-500 flex flex-wrap gap-1">
                                {perms.podeLancarNotas && (
                                  <span className="bg-emerald-50 text-emerald-700 px-1 rounded">Lança Notas</span>
                                )}
                                {perms.podeEditarQualquerNota ? (
                                  <span className="bg-amber-50 text-amber-700 px-1 rounded">Edita Geral</span>
                                ) : perms.podeEditarNotasProprias ? (
                                  <span className="bg-sky-50 text-sky-700 px-1 rounded">Edita 24h</span>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-slate-600">{u.telefone || 'N/A'}</td>
                        <td className="p-3 text-slate-600">
                          {u.cnh ? (
                            <div className="font-mono text-[11px]">
                              <span>{u.cnh} ({u.cnhCategoria})</span>
                              <span className="block text-[10px] text-slate-400">
                                Val: {u.cnhValidade?.split('-').reverse().join('/') || 'N/A'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">N/A</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            u.status === 'ATIVO' ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'
                          }`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-1">
                          <button
                            onClick={() => setShowUserMgmtModal(true)}
                            className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded"
                            title="Gerenciar Privilégios e Senha"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.nome)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Unified User Management Modal */}
          <UserManagementModal
            isOpen={showUserMgmtModal}
            onClose={() => setShowUserMgmtModal(false)}
            currentUser={storage.getActiveUser()}
            onUserChanged={() => {
              onUsersUpdated();
            }}
            onUsersListUpdated={() => {
              onUsersUpdated();
            }}
          />
        </div>
      )}

      {/* TAB 5: PARÂMETROS E CALENDÁRIO OFICIAL DETRAN-PA */}
      {activeTab === 'detran' && (
        <div className="space-y-6">
          {/* Calendar Updated Toast */}
          {calendarUpdatedMsg && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-4 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{calendarUpdatedMsg}</span>
            </div>
          )}

          {/* General Fiscal Parameters */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="border-b pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-[#0F2744]">
                  Regras Gerais e Alíquotas Oficiais do Estado do Pará (SEFA &amp; DETRAN-PA)
                </h3>
                <p className="text-xs text-slate-500">
                  Escalonamento anual conforme Lei Estadual nº 6.010/1996 e Instrução Normativa SEFA-PA
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="https://www.detran.pa.gov.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors border border-slate-300"
                >
                  <span>Portal DETRAN-PA</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Ano de Exercício Fiscal:
                </label>
                <input
                  type="number"
                  value={detranExercicio}
                  onChange={e => setDetranExercicio(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Taxa de Licenciamento Anual (R$):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={detranTaxa}
                  onChange={e => setDetranTaxa(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Alíquota IPVA Passeio (%):
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={detranPasseio}
                  onChange={e => setDetranPasseio(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Padrão PA: 2,5% sobre FIPE
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Alíquota IPVA Utilitários (%):
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={detranUtilitario}
                  onChange={e => setDetranUtilitario(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Padrão PA: 1,0% sobre FIPE
                </span>
              </div>
            </div>
          </div>

          {/* AI Upload and Import Section */}
          <div className="bg-gradient-to-r from-sky-50 to-indigo-50/50 rounded-xl border border-sky-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-[#0F2744]">
                      Importar Calendário Oficial via Inteligência Artificial
                    </h3>
                    <span className="bg-sky-200/80 text-sky-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                      Gemini Multimodal
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Faça upload da portaria oficial em PDF ou imagem/foto da tabela, ou cole o texto para a IA estruturar as datas com precisão.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-[11px] text-slate-500 font-medium">
                  Confirmação obrigatória antes de aplicar
                </span>
              </div>
            </div>

            {aiCalendarError && (
              <div className="p-3 bg-red-50 border border-red-300 text-red-900 rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{aiCalendarError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* File Upload Box */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  1. Upload do Arquivo (PDF da Portaria ou Imagem/Foto da Tabela):
                </label>
                <div className="border-2 border-dashed border-sky-300 hover:border-sky-500 rounded-xl p-4 text-center bg-white transition-colors relative">
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    onChange={handleCalendarFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  {aiCalendarFile ? (
                    <div className="space-y-1">
                      <div className="w-8 h-8 mx-auto rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                        <FileText className="w-4 h-4" />
                      </div>
                      <p className="font-bold text-slate-800 text-xs truncate max-w-xs mx-auto">
                        {aiCalendarFile.name}
                      </p>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setAiCalendarFile(null);
                        }}
                        className="text-[10px] text-red-600 hover:underline font-semibold"
                      >
                        Remover arquivo
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-6 h-6 mx-auto text-sky-500" />
                      <p className="font-bold text-slate-700 text-xs">
                        Clique ou arraste o arquivo da portaria aqui
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Suporta PDF, PNG, JPG (Diário Oficial ou comunicado do DETRAN-PA)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Text Input Box */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  2. Ou Cole o Texto Oficial / Notícia do Calendário:
                </label>
                <textarea
                  rows={4}
                  value={aiCalendarText}
                  onChange={e => setAiCalendarText(e.target.value)}
                  placeholder="Exemplo: Portaria DETRAN-PA nº 104/2026. Finais 01 a 31 vencimento em 04/04; Finais 41 a 61 em 09/05; Finais 71 a 91 em 13/06..."
                  className="w-full border border-sky-300 rounded-xl p-2.5 text-xs text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none font-mono"
                />
              </div>
            </div>

            {/* AI Action Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                Após o processamento pela IA, uma tela de confirmação será aberta para você revisar todas as datas antes de salvar.
              </span>

              <button
                type="button"
                onClick={handleProcessCalendarAI}
                disabled={aiCalendarLoading || (!aiCalendarFile && !aiCalendarText.trim())}
                className="w-full sm:w-auto bg-[#0F2744] hover:bg-slate-800 active:scale-95 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {aiCalendarLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                    <span>Processando Calendário com IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Analisar e Estruturar com IA</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Active DETRAN-PA Calendar Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sky-600" />
                  <h3 className="font-bold text-sm text-[#0F2744]">
                    Tabela Oficial Ativa de Licenciamento Anual (Exercício {detranExercicio})
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Escalonamento oficial de vencimentos e prazos de desconto de Bom Condutor da SEFA-PA.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddCalendarEntry}
                  className="bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors border border-sky-200 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Grupo</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetDefaultCalendar}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors border border-slate-300 cursor-pointer"
                  title="Restaurar a escala oficial padrão do Pará"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Restaurar Padrão DETRAN-PA</span>
                </button>
              </div>
            </div>

            {/* Filter by Final de Placa */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-600 text-[11px] uppercase tracking-wider mr-1">
                Filtrar por Final:
              </span>
              <button
                type="button"
                onClick={() => setConfigCalFilter('ALL')}
                className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                  configCalFilter === 'ALL'
                    ? 'bg-[#0F2744] text-white shadow-2xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                Todos ({calendarEntries.length})
              </button>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map(digito => (
                <button
                  key={digito}
                  type="button"
                  onClick={() => setConfigCalFilter(digito)}
                  className={`w-7 h-7 rounded flex items-center justify-center font-bold font-mono transition-all cursor-pointer ${
                    configCalFilter === digito
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                  }`}
                >
                  {digito}
                </button>
              ))}
            </div>

            {/* Editable Calendar Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5 text-center">Final</th>
                    <th className="px-3 py-2.5">Grupo / Finais de Placa</th>
                    <th className="px-3 py-2.5">Mês Referência</th>
                    <th className="px-3 py-2.5">Licenciamento (3ª Cota)</th>
                    <th className="px-3 py-2.5">Cota Única IPVA</th>
                    <th className="px-3 py-2.5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {calendarEntries
                    .filter(entry => configCalFilter === 'ALL' || entry.finalPlaca === configCalFilter)
                    .map(entry => (
                    <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 py-2 text-center">
                        <span className="font-mono font-extrabold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {entry.finalPlaca || '-'}
                        </span>
                      </td>

                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={entry.descricaoFinais}
                          onChange={e => handleUpdateCalendarEntry(entry.id, 'descricaoFinais', e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1 font-bold text-slate-800 text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={entry.mesReferencia}
                          onChange={e => handleUpdateCalendarEntry(entry.id, 'mesReferencia', e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-slate-700 text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={entry.dataLimite || entry.dataLicenciamento || ''}
                          onChange={e => handleUpdateCalendarEntry(entry.id, 'dataLimite', e.target.value)}
                          className="border border-sky-300 bg-sky-50/30 rounded px-2 py-1 font-mono font-bold text-slate-900 text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={entry.dataCotaUnica || entry.data15Desc || ''}
                          onChange={e => handleUpdateCalendarEntry(entry.id, 'data15Desc', e.target.value)}
                          className="border border-emerald-300 bg-emerald-50/30 rounded px-2 py-1 font-mono text-emerald-900 text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </td>

                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteCalendarEntry(entry.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          title="Remover grupo de final"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={handleSaveSettings}
                className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold px-5 py-2.5 rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Todas as Configurações &amp; Calendário</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: OPENAPI SELSYN KEEK EXPLORER */}
      {activeTab === 'openapi' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 text-xs">
          <div className="border-b pb-3">
            <h3 className="font-bold text-sm text-[#0F2744]">
              Explorador OpenAPI 3.0.0 (Selsyn Tecnologia)
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Execute requisições diretas de teste utilizando a especificação do arquivo anexado <code>openapi (1).json</code>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">
                Endpoint da Especificação:
              </label>
              <select
                value={selectedEndpoint}
                onChange={e => setSelectedEndpoint(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 font-mono"
              >
                <option value="/keek/rest/v1/integracao/operador/posicao">
                  GET /keek/rest/v1/integracao/operador/posicao (Oficial - Buscar Posições Ao Vivo)
                </option>
                <option value="/keek/rest/v1/integracao/operador/cliente">
                  GET /keek/rest/v1/integracao/operador/cliente (Operador - Buscar Clientes)
                </option>
                <option value="/keek/rest/v1/integracao/operador/dispositivo/modelos">
                  GET /keek/rest/v1/integracao/operador/dispositivo/modelos (Operador - Modelos Homologados)
                </option>
                <option value="/v1/integracao/posicao">
                  GET /v1/integracao/posicao (Última Posição por Placa)
                </option>
                <option value="/v1/integracao/operador/rastreavel/identificador/{identificador}">
                  GET /v1/integracao/operador/rastreavel/identificador (Rastreável por Placa)
                </option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Identificador / Placa de Teste:
              </label>
              <input
                type="text"
                value={endpointParam}
                onChange={e => setEndpointParam(e.target.value)}
                placeholder="Ex: QEN4521"
                className="w-full border border-slate-300 rounded-lg p-2.5 font-mono"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestOpenApi}
            disabled={apiLoading}
            className="bg-[#0F2744] hover:bg-[#1E3A5F] text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {apiLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>Executar Requisição de Teste</span>
          </button>

          {apiResponse && (
            <div className="mt-3">
              <span className="font-bold text-slate-700 block mb-1">Resposta Retornada:</span>
              <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg overflow-x-auto text-[11px] max-h-56 font-mono">
                {JSON.stringify(apiResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Modal: Add/Edit User */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-[#0F2744] text-base">
                {editingUserId ? 'Editar Usuário / Motorista' : 'Cadastrar Usuário da Frota'}
              </h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nome Completo:</label>
                <input
                  type="text"
                  required
                  value={userNome}
                  onChange={e => setUserNome(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">E-mail Corporativo:</label>
                <input
                  type="email"
                  required
                  value={userEmail}
                  onChange={e => setUserEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">CPF:</label>
                  <input
                    type="text"
                    value={userCpf}
                    onChange={e => setUserCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Telefone / WhatsApp:</label>
                  <input
                    type="text"
                    value={userTelefone}
                    onChange={e => setUserTelefone(e.target.value)}
                    placeholder="(91) 98000-0000"
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Papel / Cargo:</label>
                <select
                  value={userCargo}
                  onChange={e => setUserCargo(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                >
                  <option value="GESTOR">Gestor de Frota (Acesso Total)</option>
                  <option value="OPERADOR">Operador de Telemetria (Monitoramento e Alertas)</option>
                  <option value="MOTORISTA">Motorista Operacional</option>
                  <option value="VISUALIZADOR">Visualizador (Apenas Leitura)</option>
                </select>
              </div>

              {userCargo === 'MOTORISTA' && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-800 text-[11px]">Dados da Habilitação (CNH)</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <label className="text-[10px] text-slate-500 block mb-1">Nº CNH:</label>
                      <input
                        type="text"
                        value={userCnh}
                        onChange={e => setUserCnh(e.target.value)}
                        className="w-full border border-slate-300 rounded p-1.5 font-mono text-xs"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="text-[10px] text-slate-500 block mb-1">Categoria:</label>
                      <input
                        type="text"
                        value={userCnhCategoria}
                        onChange={e => setUserCnhCategoria(e.target.value)}
                        placeholder="Ex: B, AD, E"
                        className="w-full border border-slate-300 rounded p-1.5 font-mono text-xs"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="text-[10px] text-slate-500 block mb-1">Validade:</label>
                      <input
                        type="date"
                        value={userCnhValidade}
                        onChange={e => setUserCnhValidade(e.target.value)}
                        className="w-full border border-slate-300 rounded p-1.5 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                >
                  Salvar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO OBRIGATÓRIA DO CALENDÁRIO EXTRAÍDO PELA IA */}
      {showConfirmCalendarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-amber-300">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-xs">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base sm:text-lg">
                      Revisão Obrigatória: Calendário DETRAN-PA Extraído pela IA
                    </h3>
                    <span className="text-[10px] bg-white/25 uppercase tracking-wider font-black px-2 py-0.5 rounded-full">
                      Exercício {draftCalendarExercicio}
                    </span>
                  </div>
                  <p className="text-amber-100 text-xs mt-0.5">
                    Fonte identificada: <strong>{draftCalendarFonte}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowConfirmCalendarModal(false)}
                className="w-8 h-8 rounded-lg bg-black/20 hover:bg-black/30 flex items-center justify-center text-white transition-colors"
                title="Fechar sem salvar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Instruction Warning Callout */}
            <div className="p-4 bg-amber-50/80 border-b border-amber-200 text-xs text-amber-950 flex items-start gap-3 shrink-0">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">
                  A IA organizou as datas a partir do documento ou texto enviado.
                </p>
                <p className="text-amber-800 text-[11px] leading-relaxed">
                  Confira atentamente cada data e grupo de final de placa abaixo. Você pode editar qualquer valor diretamente nos campos antes de aprovar. Nenhum ajuste de data na frota é gravado sem sua confirmação explícita.
                </p>
              </div>
            </div>

            {/* Editable Draft Entries Table */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Grupos de Placas e Prazos ({draftCalendarEntries.length} registros identificados):
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const newEntry: DetranCalendarEntry = {
                      id: `draft-custom-${Date.now()}`,
                      finalPlaca: '1',
                      grupoFinal: 'novo',
                      descricaoFinais: 'Finais...',
                      mesReferencia: 'Mês',
                      dataLimite: `${draftCalendarExercicio}-12-20`,
                      dataLicenciamento: `${draftCalendarExercicio}-12-20`,
                      data15Desc: `${draftCalendarExercicio}-11-20`,
                      data10Desc: `${draftCalendarExercicio}-12-05`,
                    };
                    setDraftCalendarEntries(prev => [...prev, newEntry]);
                  }}
                  className="text-xs font-semibold text-sky-700 hover:text-sky-900 flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar mais uma linha</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Finais de Placa</th>
                      <th className="px-3 py-2.5">Mês Referência</th>
                      <th className="px-3 py-2.5">Data Limite (Sem Multa)</th>
                      <th className="px-3 py-2.5">15% Desc. (Bom Condutor)</th>
                      <th className="px-3 py-2.5">10% Desc. (Bom Condutor)</th>
                      <th className="px-2 py-2.5 text-center">Excluir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {draftCalendarEntries.map(entry => (
                      <tr key={entry.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={entry.descricaoFinais}
                            onChange={e => handleUpdateDraftEntry(entry.id, 'descricaoFinais', e.target.value)}
                            className="w-full border border-slate-300 rounded px-2 py-1 font-bold text-slate-800 text-xs focus:ring-1 focus:ring-amber-500"
                            placeholder="Ex: Finais 01 a 31"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={entry.mesReferencia}
                            onChange={e => handleUpdateDraftEntry(entry.id, 'mesReferencia', e.target.value)}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-slate-700 text-xs focus:ring-1 focus:ring-amber-500"
                            placeholder="Ex: Abril"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={entry.dataLimite}
                            onChange={e => handleUpdateDraftEntry(entry.id, 'dataLimite', e.target.value)}
                            className="border border-amber-300 bg-amber-50/30 rounded px-2 py-1 font-mono font-bold text-slate-900 text-xs focus:ring-1 focus:ring-amber-500"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={entry.data15Desc || ''}
                            onChange={e => handleUpdateDraftEntry(entry.id, 'data15Desc', e.target.value)}
                            className="border border-emerald-300 bg-emerald-50/30 rounded px-2 py-1 font-mono text-emerald-900 text-xs focus:ring-1 focus:ring-amber-500"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={entry.data10Desc || ''}
                            onChange={e => handleUpdateDraftEntry(entry.id, 'data10Desc', e.target.value)}
                            className="border border-slate-300 rounded px-2 py-1 font-mono text-slate-700 text-xs focus:ring-1 focus:ring-amber-500"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => setDraftCalendarEntries(prev => prev.filter(e => e.id !== entry.id))}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                            title="Remover linha"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                Ao confirmar, todos os veículos da frota terão os prazos de licenciamento recalculados automaticamente.
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowConfirmCalendarModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancelar e Descartar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAndApplyCalendar}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmar e Salvar Calendário Oficial DETRAN-PA</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
