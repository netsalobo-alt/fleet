import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Mic,
  MicOff,
  CheckCircle2,
  Clock,
  Wrench,
  AlertTriangle,
  Send,
  Plus,
  FileCheck,
  Calendar,
  Gauge,
  Store,
  DollarSign,
  ChevronRight,
  Filter,
  Check,
  RotateCcw,
  Upload,
  FileUp,
  Image as ImageIcon,
  FileText,
  X,
  Bot,
  Cpu,
  Eye,
  Key,
  Edit2,
  Lock,
  Shield,
  User,
  Users,
  Trash2,
  HelpCircle,
  Save,
  AlertCircle,
  Building2,
  Search,
} from 'lucide-react';
import { Vehicle, ServiceLog, MaintenanceType, SystemUser, ServiceItemPart, ServiceItemLabor, Supplier, SupplierCategory } from '../types';
import { LicensePlateBadge } from './LicensePlateBadge';
import { storage } from '../services/storage';
import { validateCpfCnpj, formatCpfCnpj, formatPhone } from '../utils/validators';
import { ManualServiceModal } from './ManualServiceModal';
import { UserManagementModal } from './UserManagementModal';
import { InvoiceDocumentModal } from './InvoiceDocumentModal';

interface AIMaintenanceViewProps {
  vehicles: Vehicle[];
  services: ServiceLog[];
  suppliers?: Supplier[];
  onSuppliersUpdated?: () => void;
  currentUser?: SystemUser;
  onUpdateCurrentUser?: (user: SystemUser) => void;
  users?: SystemUser[];
  onServiceAdded: (service: ServiceLog) => void;
  onServiceUpdated?: (service: ServiceLog) => void;
  onSendChatwootAlert: (message: string, placa: string) => Promise<boolean>;
}

// Permission checking helper with granular UserPermissions support
export function checkServiceEditPermission(
  service: ServiceLog,
  user: SystemUser
): {
  canEdit: boolean;
  reason: string;
  isOwner: boolean;
  isAdmin: boolean;
  hoursRemaining: number;
  minutesRemaining: number;
  hoursElapsed: number;
} {
  const perms = user.permissoes;
  const isAdmin = user.cargo === 'GESTOR' || (user as any).cargo === 'ADMIN' || Boolean(perms?.podeEditarQualquerNota);

  // Calculate elapsed time from creation
  const createdTime = service.createdAt ? new Date(service.createdAt).getTime() : new Date(service.data).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - createdTime);
  const hoursElapsed = Math.floor(diffMs / (60 * 60 * 1000));

  const limitHours = perms?.limiteHorasEdicaoPropria ?? 24;
  const isUnlimited = limitHours === 0;
  const maxMs = limitHours * 60 * 60 * 1000;
  const isWithinTimeWindow = isUnlimited || diffMs <= maxMs;
  const msRemaining = isUnlimited ? 999999999 : Math.max(0, maxMs - diffMs);
  const hoursRemaining = Math.floor(msRemaining / (60 * 60 * 1000));
  const minutesRemaining = Math.floor((msRemaining % (60 * 60 * 1000)) / (60 * 1000));

  // If user is Admin / Gestor or has podeEditarQualquerNota: Can edit ALL launches anytime!
  if (isAdmin) {
    return {
      canEdit: true,
      reason: 'Permissão de Administrador: edição liberada para qualquer lançamento da frota sem restrição de prazo.',
      isOwner: service.criadoPorId === user.id || service.criadoPorNome === user.nome,
      isAdmin: true,
      hoursRemaining,
      minutesRemaining,
      hoursElapsed,
    };
  }

  // Se o perfil não tem permissão para editar notas próprias:
  if (perms && perms.podeEditarNotasProprias === false) {
    return {
      canEdit: false,
      reason: 'Seu perfil de usuário não possui permissão para alterar notas fiscais ou lançamentos.',
      isOwner: false,
      isAdmin: false,
      hoursRemaining: 0,
      minutesRemaining: 0,
      hoursElapsed,
    };
  }

  // Must be the owner who created this record
  const isOwner = Boolean(
    service.criadoPorId === user.id ||
    (service.criadoPorNome && service.criadoPorNome.toLowerCase() === user.nome.toLowerCase())
  );

  if (!isOwner) {
    return {
      canEdit: false,
      reason: `Este lançamento foi registrado por ${service.criadoPorNome || 'outro operador'}. Usuários sem privilégio administrativo só podem editar seus próprios lançamentos.`,
      isOwner: false,
      isAdmin: false,
      hoursRemaining: 0,
      minutesRemaining: 0,
      hoursElapsed,
    };
  }

  // Must be within time window
  if (!isWithinTimeWindow) {
    return {
      canEdit: false,
      reason: `Prazo limite de ${limitHours} horas expirou (${hoursElapsed}h desde o lançamento). Como operador, você não pode mais alterar este registro. Solicite a alteração a um Gestor/Administrador.`,
      isOwner: true,
      isAdmin: false,
      hoursRemaining: 0,
      minutesRemaining: 0,
      hoursElapsed,
    };
  }

  return {
    canEdit: true,
    reason: isUnlimited
      ? 'Autor do lançamento: edição própria liberada sem restrição de prazo.'
      : `Autor do lançamento: edição liberada dentro do prazo de ${limitHours}h (restam ${hoursRemaining}h ${minutesRemaining}m).`,
    isOwner: true,
    isAdmin: false,
    hoursRemaining,
    minutesRemaining,
    hoursElapsed,
  };
}

export const AIMaintenanceView: React.FC<AIMaintenanceViewProps> = ({
  vehicles,
  services,
  suppliers,
  onSuppliersUpdated,
  currentUser,
  onUpdateCurrentUser,
  users = [],
  onServiceAdded,
  onServiceUpdated,
  onSendChatwootAlert,
}) => {
  const settings = storage.getSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableSuppliers: Supplier[] = useMemo(() => {
    return suppliers && suppliers.length > 0 ? (suppliers as Supplier[]) : storage.getSuppliers();
  }, [suppliers]);

  // Active User / RBAC State
  const [activeUser, setActiveUser] = useState<SystemUser>(() => currentUser || storage.getActiveUser());
  const [showManualModal, setShowManualModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [viewingDocumentService, setViewingDocumentService] = useState<ServiceLog | null>(null);

  // Edit State & Modal
  const [editingService, setEditingService] = useState<ServiceLog | null>(null);
  const [editForm, setEditForm] = useState<{
    placa: string;
    modelo: string;
    data: string;
    tipo: MaintenanceType;
    fornecedor: string;
    fornecedorId?: string;
    odometro: number;
    proximaRevisaoKm: number;
    proximaRevisaoData: string;
    observacoes: string;
    pecas: ServiceItemPart[];
    servicos: ServiceItemLabor[];
    motivoEdicao: string;
  } | null>(null);
  const [permissionBlockedInfo, setPermissionBlockedInfo] = useState<{
    service: ServiceLog;
    reason: string;
  } | null>(null);

  // Sync activeUser if currentUser changes from parent
  useEffect(() => {
    if (currentUser) {
      setActiveUser(currentUser);
    }
  }, [currentUser]);

  const handleSwitchUser = (user: SystemUser) => {
    setActiveUser(user);
    storage.setActiveUser(user);
    if (onUpdateCurrentUser) {
      onUpdateCurrentUser(user);
    }
  };

  const handleStartEdit = (service: ServiceLog) => {
    const perm = checkServiceEditPermission(service, activeUser);
    if (!perm.canEdit) {
      setPermissionBlockedInfo({ service, reason: perm.reason });
      return;
    }
    setEditingService(service);
    setEditForm({
      placa: service.placa,
      modelo: service.modelo,
      data: service.data,
      tipo: service.tipo,
      fornecedor: service.fornecedor,
      fornecedorId: service.fornecedorId || '',
      odometro: service.odometro,
      proximaRevisaoKm: service.proximaRevisaoKm || 0,
      proximaRevisaoData: service.proximaRevisaoData || '',
      observacoes: service.observacoes || '',
      pecas: service.pecas ? JSON.parse(JSON.stringify(service.pecas)) : [],
      servicos: service.servicos ? JSON.parse(JSON.stringify(service.servicos)) : [],
      motivoEdicao: service.motivoEdicao || '',
    });
  };

  const handleSaveEdit = () => {
    if (!editingService || !editForm) return;

    const perm = checkServiceEditPermission(editingService, activeUser);
    if (!perm.canEdit) {
      alert(perm.reason);
      return;
    }

    const valorPecas = editForm.pecas.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
    const valorMaoDeObra = editForm.servicos.reduce((acc, s) => acc + (Number(s.valor) || 0), 0);
    const valorTotal = valorPecas + valorMaoDeObra;

    const matchedSup = availableSuppliers.find(s => s.id === editForm.fornecedorId);

    const updated: ServiceLog = {
      ...editingService,
      placa: editForm.placa.trim().toUpperCase(),
      modelo: editForm.modelo.trim(),
      data: editForm.data,
      tipo: editForm.tipo,
      fornecedor: editForm.fornecedor.trim(),
      fornecedorId: editForm.fornecedorId || undefined,
      fornecedorNome: matchedSup ? matchedSup.fantasia : editForm.fornecedor.trim(),
      odometro: Number(editForm.odometro) || 0,
      pecas: editForm.pecas,
      servicos: editForm.servicos,
      valorPecas,
      valorMaoDeObra,
      valorTotal,
      proximaRevisaoKm: Number(editForm.proximaRevisaoKm) || 0,
      proximaRevisaoData: editForm.proximaRevisaoData,
      observacoes: editForm.observacoes,
      updatedAt: new Date().toISOString(),
      editadoPorNome: activeUser.nome,
      editadoPorCargo: activeUser.cargo,
      motivoEdicao: editForm.motivoEdicao || 'Correção de lançamento de manutenção',
    };

    storage.updateService(updated);
    if (onServiceUpdated) {
      onServiceUpdated(updated);
    }

    setEditingService(null);
    setEditForm(null);
    if (selectedHistoryItem?.id === updated.id) {
      setSelectedHistoryItem(updated);
    }
  };

  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [chatwootSent, setChatwootSent] = useState(false);

  // Supplier linking & suggestion state in AI Review
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [supplierSearchFilter, setSupplierSearchFilter] = useState('');
  const [showQuickSupplierModal, setShowQuickSupplierModal] = useState(false);
  const [quickSupplierData, setQuickSupplierData] = useState<{
    fantasia: string;
    razaoSocial: string;
    cpfCnpj: string;
    categoria: SupplierCategory;
    cidade: string;
    uf: string;
    contato: string;
    whatsapp: string;
  }>({
    fantasia: '',
    razaoSocial: '',
    cpfCnpj: '',
    categoria: 'oficina',
    cidade: 'Belém',
    uf: 'PA',
    contato: '',
    whatsapp: '',
  });
  const [quickSupplierError, setQuickSupplierError] = useState<string | null>(null);

  // File upload state (Images & PDFs)
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    type: string;
    size: number;
    base64: string;
    previewUrl?: string;
  } | null>(null);

  // AI Provider state (OpenAI vs Gemini)
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'gemini'>(
    settings.openai.preferredProvider || (settings.openai.apiKey ? 'openai' : 'gemini')
  );
  const [openaiKeyInput, setOpenaiKeyInput] = useState(() => storage.getSettings().openai?.apiKey || '');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keySavedMsg, setKeySavedMsg] = useState(false);
  const [providerUsed, setProviderUsed] = useState<string>('');
  const [modelUsed, setModelUsed] = useState<string>('');

  const handleSaveInlineKey = (keyVal: string) => {
    const cur = storage.getSettings();
    const updated = {
      ...cur,
      openai: {
        ...cur.openai,
        apiKey: keyVal.trim(),
      },
    };
    storage.saveSettings(updated);
    setOpenaiKeyInput(keyVal.trim());
    setKeySavedMsg(true);
    setTimeout(() => setKeySavedMsg(false), 2500);
    setAiError(null);
  };

  // Filters for historical table
  const [filterPlaca, setFilterPlaca] = useState('ALL');
  const [filterTipo, setFilterTipo] = useState('ALL');
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<ServiceLog | null>(null);

  // Example prompts
  const examples = [
    {
      label: 'Troca de Óleo Onix (Belém)',
      text: 'Foi feita a troca de óleo do Onix placa QEN-4521 aos 48.900 km no Auto Centro Belém. Colocou 4 litros de óleo sintético 0W20 por R$ 260, filtro de óleo GM por R$ 45 e filtro de combustível por R$ 40. Mão de obra R$ 80. Próxima preventiva recomendada em 10.000km.',
    },
    {
      label: 'Substituição de Pneus Hilux (Marabá)',
      text: 'Revisão da Hilux placa QDA-1092 aos 62.400 km na Carajás Pneus em Marabá. Trocou 4 pneus Bridgestone Dueler A/T aro 17 por R$ 5.000, alinhamento 3D R$ 180 e balanceamento R$ 120. Veículo liberado para rota na Transamazônica.',
    },
    {
      label: 'Freios e Revisão Ranger (Parauapebas)',
      text: 'Manutenção corretiva e preventiva na Ranger placa QVO-3081 aos 79.100 km na Vale Diesel Parauapebas. Troca de pastilhas dianteiras cerâmica R$ 380, fluido de freio DOT4 R$ 110 e mão de obra R$ 190. Discos revisados e em bom estado.',
    },
  ];

  // Handle File Selection (Images, Photos, PDFs)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert('O arquivo selecionado excede o limite máximo de 20MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result as string;
      const isImage = file.type.startsWith('image/');

      setAttachedFile({
        name: file.name,
        type: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        size: file.size,
        base64: base64String,
        previewUrl: isImage ? base64String : undefined,
      });
      setAiError(null);
    };
    reader.readAsDataURL(file);
  };

  const removeAttachedFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Speech Recognition (Microphone) handler
  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Reconhecimento de voz não suportado pelo seu navegador. Você pode digitar ou colar o texto no campo.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setAiError(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => (prev ? prev + ' ' + transcript : transcript));
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Erro no reconhecimento de voz:', event);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  // Call server-side AI API (OpenAI or Gemini with Multimodal Image/PDF support)
  const handleProcessWithAI = async () => {
    if (!inputText.trim() && !attachedFile) {
      setAiError('Por favor, informe a descrição em texto/áudio ou anexe uma foto/imagem/PDF da nota fiscal.');
      return;
    }

    const currentSettings = storage.getSettings();
    const activeOpenAiKey = openaiKeyInput.trim() || currentSettings.openai?.apiKey || '';

    // If user explicitly chose OpenAI and hasn't entered key yet, prompt them:
    if (selectedProvider === 'openai' && !activeOpenAiKey) {
      setShowKeyModal(true);
      setAiError('Para usar OpenAI (GPT-4o), informe sua API Key abaixo ou alterne para o Gemini no seletor acima.');
      return;
    }

    setIsLoadingAI(true);
    setAiError(null);
    setSaveSuccess(false);
    setChatwootSent(false);

    try {
      const response = await fetch('/api/ai/parse-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: inputText,
          file: attachedFile
            ? {
                name: attachedFile.name,
                type: attachedFile.type,
                base64: attachedFile.base64,
              }
            : undefined,
          provider: selectedProvider,
          openaiApiKey: activeOpenAiKey,
          openaiModel: currentSettings.openai?.model || 'gpt-4o',
          vehiclesContext: vehicles.map(v => ({
            placa: v.placa,
            modelo: v.modelo,
            kmAtual: v.odometroAtual,
          })),
          suppliersContext: availableSuppliers.map(s => ({
            id: s.id,
            fantasia: s.fantasia,
            razaoSocial: s.razaoSocial,
            cpfCnpj: s.cpfCnpj,
            categoria: s.categoria,
          })),
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Falha ao processar com a Inteligência Artificial');
      }

      setParsedData(result.data);

      // Auto-match or detect supplier from AI response
      if (result.data.fornecedorId) {
        setSelectedSupplierId(result.data.fornecedorId);
      } else if (result.data.fornecedor) {
        const norm = result.data.fornecedor.toLowerCase().trim();
        const matched = availableSuppliers.find(
          s => s.fantasia.toLowerCase().trim() === norm ||
               s.razaoSocial.toLowerCase().trim() === norm ||
               norm.includes(s.fantasia.toLowerCase().trim())
        );
        if (matched) {
          setSelectedSupplierId(matched.id);
        } else {
          setSelectedSupplierId(null);
          // Pre-fill quick registration form with AI suggested values
          const sug = result.data.novoFornecedorSugerido || {};
          setQuickSupplierData({
            fantasia: sug.fantasia || result.data.fornecedor,
            razaoSocial: sug.razaoSocial || result.data.fornecedor,
            cpfCnpj: sug.cpfCnpj || '',
            categoria: (sug.categoria as SupplierCategory) || 'oficina',
            cidade: sug.cidade || 'Belém',
            uf: sug.uf || 'PA',
            contato: '',
            whatsapp: '',
          });
        }
      } else {
        setSelectedSupplierId(null);
      }

      setProviderUsed(result.providerUsed || (selectedProvider === 'openai' ? 'OpenAI' : 'Gemini'));
      setModelUsed(result.modelUsed || (selectedProvider === 'openai' ? currentSettings.openai?.model || 'gpt-4o' : 'gemini-3.1-flash-lite'));
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Erro de conexão com o servidor de IA.');
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Commit parsed service to fleet database
  const handleSaveService = () => {
    if (!parsedData) return;

    // Associate with matching vehicle in fleet, or auto-create one if fleet is currently empty or plate is new
    const rawPlaca = parsedData.placa ? parsedData.placa.trim().toUpperCase() : 'SEM-PLACA';
    const cleanPlacaFormatted = rawPlaca.replace(/[^A-Z0-9]/g, '');

    let targetVehicle =
      vehicles.find(
        v =>
          v.placa.toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanPlacaFormatted
      ) ||
      storage.getVehicles().find(
        v =>
          v.placa.toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanPlacaFormatted
      );

    if (!targetVehicle) {
      if (vehicles.length > 0) {
        targetVehicle = vehicles[0];
      } else {
        // Auto-register vehicle so the service has a valid vehicle in the fleet
        const newVeic: Vehicle = {
          id: 'v-' + Date.now(),
          placa: rawPlaca,
          modelo: parsedData.modelo || 'Veículo Registrado via IA',
          marca: 'Frota Pará',
          ano: new Date().getFullYear(),
          cor: 'Branco',
          categoria: 'PASSEIO',
          chassi: '9BD' + Math.random().toString(36).substring(2, 10).toUpperCase(),
          renavam: Math.floor(10000000000 + Math.random() * 90000000000).toString(),
          odometroAtual: Number(parsedData.odometroKm) || 0,
          odometroEstimado: Number(parsedData.odometroKm) || 0,
          dataUltimoOdometroEstimado: parsedData.dataServico || new Date().toISOString().split('T')[0],
          horimetro: 0,
          status: 'OPERANDO',
          combustivel: 'FLEX',
          localizacao: {
            lat: -1.4558,
            lng: -48.4902,
            cidade: 'Belém',
            uf: 'PA',
            endereco: 'Base Operacional Belém - PA',
          },
          ignicao: false,
          velocidade: 0,
          bloqueado: false,
          nivelTanque: 100,
          bateriaVolts: 12.6,
          ultimaComunicacao: new Date().toISOString(),
          valorVenalFipe: 50000,
          tempoSemMultasAnos: 2,
        };
        storage.addVehicle(newVeic);
        targetVehicle = newVeic;
      }
    }

    // Determine linked supplier
    const targetSupplier = selectedSupplierId
      ? availableSuppliers.find(s => s.id === selectedSupplierId)
      : null;

    const newService: ServiceLog = {
      id: 'srv-' + Date.now(),
      veiculoId: targetVehicle.id,
      placa: parsedData.placa || targetVehicle.placa,
      modelo: parsedData.modelo || targetVehicle.modelo,
      data: parsedData.dataServico || new Date().toISOString().split('T')[0],
      tipo: (parsedData.tipoManutencao as MaintenanceType) || 'OUTROS',
      fornecedor: targetSupplier ? targetSupplier.fantasia : (parsedData.fornecedor || 'Oficina Não Informada'),
      fornecedorId: targetSupplier ? targetSupplier.id : (parsedData.fornecedorId || undefined),
      fornecedorNome: targetSupplier ? targetSupplier.fantasia : (parsedData.fornecedor || undefined),
      odometro: Number(parsedData.odometroKm) || targetVehicle.odometroEstimado || targetVehicle.odometroAtual || 0,
      pecas: parsedData.pecas || [],
      servicos: parsedData.servicos || [],
      valorPecas: Number(parsedData.valorPecas) || 0,
      valorMaoDeObra: Number(parsedData.valorMaoDeObra) || 0,
      valorTotal: Number(parsedData.valorTotal) || 0,
      proximaRevisaoKm:
        Number(parsedData.proximaRevisaoKm) || Number(parsedData.odometroKm || 0) + 10000,
      proximaRevisaoData:
        parsedData.proximaRevisaoData ||
        new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
      itensProximaRevisao: parsedData.itensProximaRevisao || ['Troca de Óleo', 'Filtros'],
      observacoes: parsedData.descricaoResumida || inputText,
      iaGerado: true,
      provedorIA: providerUsed.includes('OpenAI') ? 'OpenAI' : 'Gemini',
      recomendacaoIA: parsedData.recomendacaoIA,
      anexoDocumento: attachedFile
        ? {
            nome: attachedFile.name,
            tipo: attachedFile.type.startsWith('image/') ? 'IMAGEM' : 'PDF',
            urlBase64: attachedFile.base64,
          }
        : undefined,
      status: 'CONCLUIDO',
      createdAt: new Date().toISOString(),
      criadoPorId: activeUser.id,
      criadoPorNome: activeUser.nome,
      criadoPorCargo: activeUser.cargo,
    };

    storage.addService(newService);
    onServiceAdded(newService);
    setSaveSuccess(true);
  };

  // Dispatch Chatwoot alert about this maintenance
  const handleSendToChatwoot = async () => {
    if (!parsedData) return;
    const msg = `🔧 *LANÇAMENTO DE MANUTENÇÃO - FLEET TELECOM PA*
🚗 *Veículo:* ${parsedData.modelo} (Placa: ${parsedData.placa})
📍 *Oficina / Fornecedor:* ${parsedData.fornecedor || 'Credenciada'}
⏱️ *Odômetro:* ${Number(parsedData.odometroKm).toLocaleString()} km
🏷️ *Tipo:* ${parsedData.tipoManutencao}

💰 *Investimento:*
• Peças: R$ ${Number(parsedData.valorPecas || 0).toFixed(2)}
• Mão de Obra: R$ ${Number(parsedData.valorMaoDeObra || 0).toFixed(2)}
• *Total:* R$ ${Number(parsedData.valorTotal || 0).toFixed(2)}

📅 *Próxima Revisão Programada:*
• Aos ${Number(parsedData.proximaRevisaoKm).toLocaleString()} km (${parsedData.proximaRevisaoData?.split('-').reverse().join('/') || 'Em 6 meses'})
• Itens: ${(parsedData.itensProximaRevisao || []).join(', ')}

💡 *Parecer Técnico da IA (${providerUsed || 'AI'}):* ${parsedData.recomendacaoIA || 'Conforme o plano preventivo.'}`;

    const sent = await onSendChatwootAlert(msg, parsedData.placa);
    if (sent) setChatwootSent(true);
  };

  // Filtered services
  const filteredServices = services.filter(s => {
    if (filterPlaca !== 'ALL' && s.placa !== filterPlaca) return false;
    if (filterTipo !== 'ALL' && s.tipo !== filterTipo) return false;
    return true;
  });

  const totalGastoGeral = services.reduce((acc, curr) => acc + curr.valorTotal, 0);
  const totalPecasGeral = services.reduce((acc, curr) => acc + curr.valorPecas, 0);
  const totalMaoDeObraGeral = services.reduce((acc, curr) => acc + curr.valorMaoDeObra, 0);

  const handleConfirmNewSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickSupplierError(null);

    if (!quickSupplierData.fantasia.trim()) {
      setQuickSupplierError('Nome fantasia é obrigatório.');
      return;
    }

    if (quickSupplierData.cpfCnpj.trim()) {
      const docVal = validateCpfCnpj(quickSupplierData.cpfCnpj);
      if (!docVal.isValid) {
        setQuickSupplierError(docVal.errorMessage || 'CPF/CNPJ inválido');
        return;
      }
    }

    try {
      const cleanDoc = quickSupplierData.cpfCnpj.replace(/\D/g, '');
      const newSup = storage.addSupplier({
        fantasia: quickSupplierData.fantasia.trim(),
        razaoSocial: quickSupplierData.razaoSocial.trim() || quickSupplierData.fantasia.trim(),
        cpfCnpj: quickSupplierData.cpfCnpj.trim() ? formatCpfCnpj(quickSupplierData.cpfCnpj) : '04.912.834/0001-24',
        tipoDocumento: cleanDoc.length === 11 ? 'CPF' : 'CNPJ',
        categoria: quickSupplierData.categoria,
        cidade: quickSupplierData.cidade.trim() || 'Belém',
        uf: quickSupplierData.uf.trim().toUpperCase() || 'PA',
        endereco: '',
        email: '',
        contato: quickSupplierData.contato.trim(),
        whatsapp: quickSupplierData.whatsapp.trim() ? formatPhone(quickSupplierData.whatsapp) : '',
        ativo: true,
        observacoes: 'Cadastrado e vinculado durante o lançamento com IA.',
      });

      if (onSuppliersUpdated) {
        onSuppliersUpdated();
      }

      setSelectedSupplierId(newSup.id);
      if (parsedData) {
        setParsedData({
          ...parsedData,
          fornecedor: newSup.fantasia,
          fornecedorId: newSup.id,
          fornecedorCadastrado: true,
          novoFornecedorSugerido: null,
        });
      }

      setShowQuickSupplierModal(false);
    } catch (err: any) {
      setQuickSupplierError(err.message || 'Erro ao cadastrar fornecedor.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Sleek Executive Operator & Privilege Status Strip */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0 border border-slate-200">
            {activeUser.cargo === 'GESTOR' ? (
              <Shield className="w-4 h-4 text-amber-600" />
            ) : (
              <User className="w-4 h-4 text-sky-600" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-900 truncate">{activeUser.nome}</span>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                @{activeUser.login || activeUser.email.split('@')[0]}
              </span>
              <span
                className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  activeUser.cargo === 'GESTOR'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-sky-100 text-sky-800 border border-sky-200'
                }`}
              >
                {activeUser.cargo === 'GESTOR' ? 'Administrador' : 'Operador'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {activeUser.cargo === 'GESTOR' || activeUser.permissoes?.podeEditarQualquerNota ? (
                <span className="text-amber-700 font-medium">
                  Privilégio de Administrador: edição de qualquer lançamento liberada.
                </span>
              ) : (
                <span className="text-slate-600 font-medium">
                  Operador: lançamentos próprios editáveis em até {activeUser.permissoes?.limiteHorasEdicaoPropria ?? 24}h.
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setShowUserModal(true)}
            className="bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-200"
            title="Gerenciar usuários, senhas e privilégios"
          >
            <Users className="w-3.5 h-3.5 text-sky-600" />
            <span>Controle de Usuários</span>
          </button>
        </div>
      </div>

      {/* Title & Introduction */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-sky-700 flex items-center justify-center text-white">
              <Bot className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-[#0F2744]">
              Lançamento com IA &amp; OCR de Documentos
            </h1>
          </div>
          <p className="text-slate-600 text-xs sm:text-sm mt-1">
            Análise multimodal de notas fiscais, fotos de ordens de serviço, Danfes e PDFs de oficinas com <strong>OpenAI GPT-4o Vision</strong> ou <strong>Google Gemini</strong>.
          </p>
        </div>

        {/* AI Provider Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setSelectedProvider('openai');
                if (!openaiKeyInput) setShowKeyModal(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                selectedProvider === 'openai'
                  ? 'bg-[#10A37F] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>OpenAI ({settings.openai.model || 'GPT-4o'})</span>
              {openaiKeyInput && (
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedProvider('gemini');
                setShowKeyModal(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                selectedProvider === 'gemini'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gemini Flash</span>
            </button>
          </div>

          {selectedProvider === 'openai' && (
            <button
              type="button"
              onClick={() => setShowKeyModal(!showKeyModal)}
              className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
            >
              <Key className="w-3 h-3" />
              <span>{openaiKeyInput ? 'Editar Token OpenAI' : 'Inserir Token OpenAI'}</span>
            </button>
          )}

          {/* Direct Manual Entry Button without AI */}
          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            title="Lançar manutenção manual diretamente sem consumir tokens de IA"
          >
            <Wrench className="w-3.5 h-3.5 text-emerald-200" />
            <span>Lançamento Manual (Sem IA)</span>
          </button>
        </div>
      </div>

      {/* Inline OpenAI Token Card if requested */}
      {selectedProvider === 'openai' && (!openaiKeyInput || showKeyModal) && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 text-xs space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-950 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-emerald-700" />
              Configurar Token da OpenAI (API Key):
            </span>
            {openaiKeyInput && (
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            )}
          </div>
          <p className="text-[11px] text-emerald-800">
            Cole sua chave <code>sk-...</code> da OpenAI para processamento com GPT-4o Vision diretamente com seus créditos.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={openaiKeyInput}
              onChange={e => setOpenaiKeyInput(e.target.value)}
              placeholder="sk-proj-..."
              className="flex-1 bg-white border border-emerald-300 rounded-lg p-2 font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={() => handleSaveInlineKey(openaiKeyInput)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg text-xs shrink-0"
            >
              Salvar Token
            </button>
          </div>
          {keySavedMsg && (
            <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Token salvo com sucesso!
            </span>
          )}
        </div>
      )}

      {/* AI Assistant Input Box with File Upload (Image / Photo / PDF) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        {/* Upload File Zone */}
        <div>
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-2">
            <FileUp className="w-4 h-4 text-emerald-600" />
            Anexar Foto da Nota Fiscal, Danfe, Orçamento ou PDF:
          </label>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,application/pdf"
            className="hidden"
          />

          {!attachedFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-emerald-50/20 rounded-xl p-5 text-center cursor-pointer transition-all group"
            >
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-full bg-emerald-100 group-hover:bg-emerald-200 flex items-center justify-center text-emerald-700 transition-colors">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-800">
                    Clique para selecionar ou arraste uma foto/arquivo
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Suporta fotos de celular (JPG, PNG, WEBP) e arquivos em PDF de Notas Fiscais e Orçamentos de oficinas
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-3">
                {attachedFile.previewUrl ? (
                  <img
                    src={attachedFile.previewUrl}
                    alt="Preview"
                    className="w-12 h-12 object-cover rounded-lg border border-slate-300 shadow-xs"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs uppercase border border-red-200">
                    <FileText className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <div className="font-bold text-slate-900 text-xs truncate max-w-sm">
                    {attachedFile.name}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {(attachedFile.size / 1024).toFixed(1)} KB • {attachedFile.type.toUpperCase()}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={removeAttachedFile}
                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                title="Remover anexo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Text / Voice Description */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Wrench className="w-4 h-4 text-sky-600" />
              Descrição Complementar ou Relato do Motorista (Opcional se anexar arquivo):
            </label>
            <span className="text-xs text-slate-500">
              Microfone ou digitação livre
            </span>
          </div>

          <div className="relative">
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Exemplo: Troca de óleo 5W30 e filtro do Onix placa QEN-4521 aos 48.900km por R$ 380 na Belém Auto Peças. Também trocou as pastilhas dianteiras por R$ 220 e cobrou R$ 90 de mão de obra..."
              rows={3}
              className="w-full rounded-lg border border-slate-300 p-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-sans"
            />

            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleListening}
                title={isListening ? 'Parar gravação' : 'Falar pelo microfone'}
                className={`p-2 rounded-full transition-all ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse shadow-md'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Example Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-500 font-medium">Exemplos rápidos:</span>
          {examples.map((ex, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInputText(ex.text);
                setParsedData(null);
                setSaveSuccess(false);
              }}
              className="text-xs bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200 transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>

        {aiError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{aiError}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setShowManualModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                title="Lançar diretamente sem IA"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Lançar Manualmente Sem IA</span>
              </button>

              {selectedProvider === 'openai' && !openaiKeyInput.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProvider('gemini');
                    setAiError(null);
                    setShowKeyModal(false);
                  }}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors"
                >
                  Alternar para Gemini Flash
                </button>
              )}
            </div>
          </div>
        )}

        {/* Process Button with Provider Identification and Manual Launch Option */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span>Motor de Processamento:</span>
            <strong className="text-slate-800">
              {selectedProvider === 'openai'
                ? `OpenAI (${settings.openai.model || 'GPT-4o Vision'})`
                : 'Google Gemini 3.8 Flash'}
            </strong>
            {selectedProvider === 'openai' && !settings.openai.apiKey && (
              <span className="text-amber-700 font-medium">
                (Configure o seu token OpenAI nas Configurações se desejar usar sua chave privada)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setShowManualModal(true)}
              className="bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 text-slate-700 px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-300 w-1/2 sm:w-auto"
              title="Lançamento manual direto sem IA"
            >
              <Wrench className="w-3.5 h-3.5 text-emerald-600" />
              <span>Lançamento Manual</span>
            </button>

            <button
              onClick={handleProcessWithAI}
              disabled={isLoadingAI || (!inputText.trim() && !attachedFile)}
              className="bg-[#0F2744] hover:bg-[#1E3A5F] text-white px-5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm w-1/2 sm:w-auto"
            >
              {isLoadingAI ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>
                    {attachedFile
                      ? `Analisar ${attachedFile.type.startsWith('image/') ? 'Imagem' : 'PDF'}`
                      : 'Processar com IA'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* AI Extraction Preview Card */}
      {parsedData && (
        <div className="bg-white rounded-xl border-2 border-emerald-500/40 shadow-md p-6 space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[#0F2744] text-base">
                    Extração Concluída com Sucesso
                  </h3>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                    {providerUsed || 'OpenAI'} ({modelUsed || 'GPT-4o'})
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Revise os dados extraídos pelo modelo antes de registrar no histórico da frota
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <LicensePlateBadge placa={parsedData.placa} size="md" />
              <span className="text-xs font-semibold bg-sky-100 text-sky-800 px-2.5 py-1 rounded-md">
                {parsedData.tipoManutencao || 'MANUTENÇÃO'}
              </span>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="text-slate-500 flex items-center justify-between font-medium">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-sky-600" /> Fornecedor Vinculado
                </span>
                {selectedSupplierId ? (
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                    Cadastrado
                  </span>
                ) : (
                  <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded">
                    Não Vinculado
                  </span>
                )}
              </div>
              <select
                value={selectedSupplierId || ''}
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'NEW') {
                    const sug = parsedData.novoFornecedorSugerido || {};
                    setQuickSupplierData({
                      fantasia: sug.fantasia || parsedData.fornecedor || '',
                      razaoSocial: sug.razaoSocial || parsedData.fornecedor || '',
                      cpfCnpj: sug.cpfCnpj || '',
                      categoria: (sug.categoria as SupplierCategory) || 'oficina',
                      cidade: sug.cidade || 'Belém',
                      uf: sug.uf || 'PA',
                      contato: '',
                      whatsapp: '',
                    });
                    setQuickSupplierError(null);
                    setShowQuickSupplierModal(true);
                  } else {
                    setSelectedSupplierId(val || null);
                    if (val) {
                      const sup = availableSuppliers.find(s => s.id === val);
                      if (sup) {
                        setParsedData({ ...parsedData, fornecedor: sup.fantasia, fornecedorId: sup.id });
                      }
                    }
                  }
                }}
                className="w-full mt-1.5 bg-white border border-slate-300 rounded-md p-1.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500 truncate"
              >
                <option value="">{parsedData.fornecedor ? `${parsedData.fornecedor} (Texto livre)` : 'Selecione um fornecedor...'}</option>
                <optgroup label="Fornecedores Cadastrados">
                  {availableSuppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.fantasia} ({s.cpfCnpj}) {!s.ativo ? '[Inativo]' : ''}
                    </option>
                  ))}
                </optgroup>
                <option value="NEW">+ Cadastrar Novo Fornecedor com IA</option>
              </select>
            </div>

            <div className="bg-sky-50/60 p-3 rounded-lg border border-sky-200">
              <div className="text-sky-700 flex items-center gap-1 font-medium text-xs">
                <Gauge className="w-3.5 h-3.5 text-sky-600" /> Odômetro da OS (Estimado)
              </div>
              <div className="font-bold text-slate-800 mt-1">
                {Number(parsedData.odometroKm || 0).toLocaleString()} km
              </div>
              <div className="text-[10px] text-sky-700 mt-0.5">
                Atualiza Odômetro Estimado da frota
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="text-slate-500 flex items-center gap-1 font-medium">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Data do Serviço
              </div>
              <div className="font-bold text-slate-800 mt-1">
                {parsedData.dataServico?.split('-').reverse().join('/') || 'Hoje'}
              </div>
            </div>

            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
              <div className="text-emerald-700 flex items-center gap-1 font-medium">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Valor Total
              </div>
              <div className="font-extrabold text-emerald-800 text-sm mt-1">
                R$ {Number(parsedData.valorTotal || 0).toFixed(2)}
              </div>
            </div>
          </div>

          {/* New Supplier Detection Banner */}
          {!selectedSupplierId && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold text-amber-900 text-xs block">
                    Fornecedor &quot;{parsedData.fornecedor || 'Oficina'}&quot; não possui cadastro formal no sistema
                  </span>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    A IA pode cadastrar este fornecedor agora mediante sua confirmação. O vínculo formal por fornecedor_id viabiliza relatórios de gastos acumulados.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const sug = parsedData.novoFornecedorSugerido || {};
                  setQuickSupplierData({
                    fantasia: sug.fantasia || parsedData.fornecedor || '',
                    razaoSocial: sug.razaoSocial || parsedData.fornecedor || '',
                    cpfCnpj: sug.cpfCnpj || '',
                    categoria: (sug.categoria as SupplierCategory) || 'oficina',
                    cidade: sug.cidade || 'Belém',
                    uf: sug.uf || 'PA',
                    contato: '',
                    whatsapp: '',
                  });
                  setQuickSupplierError(null);
                  setShowQuickSupplierModal(true);
                }}
                className="bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Cadastrar Fornecedor (1 Clique)</span>
              </button>
            </div>
          )}

          {/* Detailed Tables: Parts & Labor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Parts Table */}
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
              <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                <span>Peças e Insumos Identificados</span>
                <span className="text-slate-600 font-semibold">
                  Subtotal: R$ {Number(parsedData.valorPecas || 0).toFixed(2)}
                </span>
              </h4>
              {parsedData.pecas && parsedData.pecas.length > 0 ? (
                <div className="space-y-1.5 text-xs">
                  {parsedData.pecas.map((peca: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-white p-2 rounded border border-slate-200"
                    >
                      <span className="text-slate-700 font-medium">
                        {peca.quantidade}x {peca.descricao}
                      </span>
                      <span className="font-bold text-slate-900">
                        R$ {Number(peca.total || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Nenhuma peça identificada separadamente.</p>
              )}
            </div>

            {/* Labor / Services Table */}
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
              <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                <span>Mão de Obra e Serviços</span>
                <span className="text-slate-600 font-semibold">
                  Subtotal: R$ {Number(parsedData.valorMaoDeObra || 0).toFixed(2)}
                </span>
              </h4>
              {parsedData.servicos && parsedData.servicos.length > 0 ? (
                <div className="space-y-1.5 text-xs">
                  {parsedData.servicos.map((srv: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-white p-2 rounded border border-slate-200"
                    >
                      <span className="text-slate-700 font-medium">{srv.descricao}</span>
                      <span className="font-bold text-slate-900">
                        R$ {Number(srv.valor || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Mão de obra inclusa no valor total.</p>
              )}
            </div>
          </div>

          {/* AI Scheduled Next Revision Box */}
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-sky-900 font-bold text-xs">
                <Clock className="w-4 h-4 text-sky-600" />
                <span>Próxima Revisão Recomendada pela IA:</span>
              </div>
              <p className="text-xs text-sky-800">
                Aos <strong>{Number(parsedData.proximaRevisaoKm || 0).toLocaleString()} km</strong> ou até{' '}
                <strong>{parsedData.proximaRevisaoData?.split('-').reverse().join('/') || '6 meses'}</strong>
              </p>
              {parsedData.itensProximaRevisao && (
                <p className="text-[11px] text-sky-700">
                  Itens a checar:{' '}
                  <span className="font-medium">{parsedData.itensProximaRevisao.join(', ')}</span>
                </p>
              )}
            </div>

            {parsedData.recomendacaoIA && (
              <div className="bg-white/80 border border-sky-200 p-2.5 rounded-lg max-w-md text-xs text-slate-700">
                <span className="font-bold text-sky-900 block mb-0.5">Nota Técnica IA:</span>
                {parsedData.recomendacaoIA}
              </div>
            )}
          </div>

          {/* Attached Document Archiving Notice */}
          {attachedFile && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-emerald-950">
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold truncate">Arquivo da Nota: {attachedFile.name}</span>
                    <span className="bg-emerald-200 text-emerald-900 text-[10px] font-bold px-1.5 py-0.2 rounded uppercase shrink-0">
                      {(attachedFile.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Este documento será arquivado no banco da frota e ficará disponível para visualização e auditoria no histórico.
                  </p>
                </div>
              </div>

              {attachedFile.previewUrl && (
                <img
                  src={attachedFile.previewUrl}
                  alt="Prévia"
                  className="w-12 h-12 object-cover rounded-lg border border-emerald-300 shrink-0 shadow-xs"
                />
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              onClick={() => {
                setParsedData(null);
                setInputText('');
                setAttachedFile(null);
              }}
              className="text-xs text-slate-600 hover:text-slate-900 font-medium px-3 py-2 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Descartar
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSendToChatwoot}
                disabled={chatwootSent}
                className={`text-xs px-3.5 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition-colors border ${
                  chatwootSent
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                }`}
              >
                {chatwootSent ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Alerta Enviado ao Chatwoot</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Disparar Alerta no Chatwoot</span>
                  </>
                )}
              </button>

              <button
                onClick={handleSaveService}
                disabled={saveSuccess}
                className={`text-xs px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all shadow-sm ${
                  saveSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
                }`}
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Gravado no Histórico da Frota!</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Confirmar &amp; Salvar Serviço</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Historical Maintenance Records */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-[#0F2744] text-base">
              Histórico de Manutenções da Frota
            </h2>
            <p className="text-xs text-slate-500">
              {services.length} lançamentos registrados ({services.filter(s => s.iaGerado).length} via IA)
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1 bg-slate-100 px-2 py-1.5 rounded-lg border border-slate-200">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterPlaca}
                onChange={e => setFilterPlaca(e.target.value)}
                className="bg-transparent font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">Todas as Placas</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.placa}>
                    {v.placa} ({v.modelo.split(' ')[0]})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 px-2 py-1.5 rounded-lg border border-slate-200">
              <select
                value={filterTipo}
                onChange={e => setFilterTipo(e.target.value)}
                className="bg-transparent font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">Todos os Tipos</option>
                <option value="OLEO">Troca de Óleo</option>
                <option value="PNEU">Pneus &amp; Suspensão</option>
                <option value="MECANICA">Mecânica Geral</option>
                <option value="ELETRICA">Elétrica &amp; Bateria</option>
                <option value="FUNILARIA">Funilaria</option>
                <option value="REVISAO_PROGRAMADA">Revisão Programada</option>
              </select>
            </div>
          </div>
        </div>

        {/* Financial KPI Banner */}
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 grid grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-500 font-medium">Gasto Total Acumulado:</span>
            <div className="font-bold text-slate-900 text-sm">
              R$ {totalGastoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Investimento em Peças:</span>
            <div className="font-bold text-sky-800 text-sm">
              R$ {totalPecasGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Mão de Obra / Serviços:</span>
            <div className="font-bold text-slate-700 text-sm">
              R$ {totalMaoDeObraGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Veículo / Placa</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Fornecedor</th>
                <th className="px-4 py-3 text-right">Odômetro</th>
                <th className="px-4 py-3 text-right">Valor Total</th>
                <th className="px-4 py-3 text-center">Nota / Anexo</th>
                <th className="px-4 py-3">Lançado Por</th>
                <th className="px-4 py-3 text-center">Permissão Edição</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    Nenhum registro de manutenção encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredServices.map(srv => {
                  const perm = checkServiceEditPermission(srv, activeUser);
                  return (
                    <tr key={srv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          <LicensePlateBadge placa={srv.placa} size="sm" />
                          <div>
                            <div className="font-bold text-slate-900">{srv.modelo}</div>
                            {srv.iaGerado && (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded font-semibold inline-flex items-center gap-0.5">
                                <Sparkles className="w-2.5 h-2.5" /> {srv.provedorIA || 'IA'}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {srv.data.split('-').reverse().join('/')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-100 text-slate-800 font-semibold px-2 py-0.5 rounded text-[11px]">
                          {srv.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[170px] truncate" title={srv.fornecedor}>
                        {srv.fornecedor}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium">
                        {srv.odometro.toLocaleString()} km
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 font-mono">
                        R$ {srv.valorTotal.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {srv.anexoDocumento ? (
                          <button
                            type="button"
                            onClick={() => setViewingDocumentService(srv)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 transition-colors shadow-2xs cursor-pointer"
                            title={`Visualizar documento original: ${srv.anexoDocumento.nome}`}
                          >
                            {srv.anexoDocumento.tipo === 'PDF' ? (
                              <FileText className="w-3.5 h-3.5 text-red-600" />
                            ) : (
                              <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                            <span>Ver Nota</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Sem anexo</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="font-semibold text-slate-800">{srv.criadoPorNome || 'Sistema'}</span>
                          {srv.criadoPorCargo === 'GESTOR' ? (
                            <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-bold">Admin</span>
                          ) : (
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-1 rounded">Operador</span>
                          )}
                        </div>
                        {srv.updatedAt && (
                          <span className="text-[9px] text-sky-600 block mt-0.5 font-medium">
                            Editado por {srv.editadoPorNome || 'Admin'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {perm.isAdmin ? (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
                            <Shield className="w-2.5 h-2.5" /> Admin Total
                          </span>
                        ) : perm.isOwner && perm.canEdit ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold"
                            title={perm.reason}
                          >
                            <Clock className="w-2.5 h-2.5" /> Editável ({perm.hoursRemaining}h restam)
                          </span>
                        ) : perm.isOwner && !perm.canEdit ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold"
                            title={perm.reason}
                          >
                            <Lock className="w-2.5 h-2.5" /> Expirado (+24h)
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full font-medium"
                            title={perm.reason}
                          >
                            <Lock className="w-2.5 h-2.5" /> Outro Usuário
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(srv)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                              perm.canEdit
                                ? 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-300'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200 border border-slate-200'
                            }`}
                            title={perm.reason}
                          >
                            {perm.canEdit ? <Edit2 className="w-3 h-3 text-sky-600" /> : <Lock className="w-3 h-3 text-slate-400" />}
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedHistoryItem(srv)}
                            className="text-slate-600 hover:text-slate-900 font-semibold px-2 py-1 text-xs hover:underline"
                          >
                            Detalhes
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedHistoryItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <LicensePlateBadge placa={selectedHistoryItem.placa} size="md" />
                <div>
                  <h3 className="font-bold text-[#0F2744] text-sm">
                    {selectedHistoryItem.modelo}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Realizado em {selectedHistoryItem.data.split('-').reverse().join('/')} aos{' '}
                    {selectedHistoryItem.odometro.toLocaleString()} km
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedHistoryItem(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Creator & Permissions Status Box */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block text-[10px]">Cadastrado por:</span>
                  <strong className="text-slate-800">{selectedHistoryItem.criadoPorNome || 'Sistema / IA'}</strong>
                  {selectedHistoryItem.criadoPorCargo && (
                    <span className="text-[10px] ml-1.5 text-slate-500">({selectedHistoryItem.criadoPorCargo})</span>
                  )}
                </div>
                <div>
                  {(() => {
                    const p = checkServiceEditPermission(selectedHistoryItem, activeUser);
                    return p.canEdit ? (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Edição Permitida
                      </span>
                    ) : (
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Somente Administrador
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-700">Fornecedor:</span>{' '}
                <span className="text-slate-900">{selectedHistoryItem.fornecedor}</span>
              </div>

              <div>
                <span className="font-bold text-slate-700">Tipo:</span>{' '}
                <span className="bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-800">
                  {selectedHistoryItem.tipo}
                </span>
              </div>

              {selectedHistoryItem.anexoDocumento && (
                <div className="bg-sky-50/70 p-3 rounded-lg border border-sky-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="p-2 bg-white rounded-lg shadow-xs border border-sky-100 shrink-0">
                      {selectedHistoryItem.anexoDocumento.tipo === 'PDF' ? (
                        <FileText className="w-5 h-5 text-red-600" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-sky-600" />
                      )}
                    </div>
                    <div className="truncate">
                      <span className="font-bold text-slate-800 truncate block text-xs">
                        {selectedHistoryItem.anexoDocumento.nome}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {selectedHistoryItem.anexoDocumento.tipo} original arquivado para auditoria
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingDocumentService(selectedHistoryItem)}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                  >
                    <Eye className="w-3.5 h-3.5" /> Visualizar Nota
                  </button>
                </div>
              )}

              {selectedHistoryItem.observacoes && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-1">Observações do Serviço:</span>
                  <p className="text-slate-600">{selectedHistoryItem.observacoes}</p>
                </div>
              )}

              {/* Peças */}
              {selectedHistoryItem.pecas && selectedHistoryItem.pecas.length > 0 && (
                <div>
                  <span className="font-bold text-slate-800 block mb-1.5">Peças Utilizadas:</span>
                  <div className="space-y-1">
                    {selectedHistoryItem.pecas.map((p, i) => (
                      <div
                        key={i}
                        className="flex justify-between bg-slate-50 p-2 rounded border border-slate-200"
                      >
                        <span>
                          {p.quantidade}x {p.descricao}
                        </span>
                        <span className="font-bold">R$ {p.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Serviços */}
              {selectedHistoryItem.servicos && selectedHistoryItem.servicos.length > 0 && (
                <div>
                  <span className="font-bold text-slate-800 block mb-1.5">Mão de Obra:</span>
                  <div className="space-y-1">
                    {selectedHistoryItem.servicos.map((s, i) => (
                      <div
                        key={i}
                        className="flex justify-between bg-slate-50 p-2 rounded border border-slate-200"
                      >
                        <span>{s.descricao}</span>
                        <span className="font-bold">R$ {s.valor.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Financial summary */}
              <div className="pt-2 border-t flex justify-between font-bold text-sm text-slate-900">
                <span>Total Geral:</span>
                <span className="text-emerald-700">R$ {selectedHistoryItem.valorTotal.toFixed(2)}</span>
              </div>

              {selectedHistoryItem.recomendacaoIA && (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-emerald-900">
                  <span className="font-bold flex items-center gap-1 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Parecer Técnico da IA ({selectedHistoryItem.provedorIA || 'IA'}):
                  </span>
                  <p className="text-[11px]">{selectedHistoryItem.recomendacaoIA}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <button
                type="button"
                onClick={() => {
                  const srv = selectedHistoryItem;
                  handleStartEdit(srv);
                }}
                className="bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Editar Este Lançamento</span>
              </button>

              <button
                onClick={() => setSelectedHistoryItem(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE LANÇAMENTO (COM VALIDAÇÃO DE 24H E ADMIN) */}
      {editingService && editForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-sky-300 max-h-[92vh] overflow-y-auto my-auto animate-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-md">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F2744] text-base">
                    Editar Lançamento de Manutenção
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <LicensePlateBadge placa={editForm.placa} size="sm" />
                    <span className="text-xs text-slate-500">ID: {editingService.id}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingService(null);
                  setEditForm(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                &times;
              </button>
            </div>

            {/* Operator Active Status Banner */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                {activeUser.cargo === 'GESTOR' ? (
                  <Shield className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <div>
                  <span className="text-slate-500">Editando como:</span>{' '}
                  <strong className="text-slate-900">{activeUser.nome}</strong>{' '}
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-bold">
                    {activeUser.cargo === 'GESTOR' ? 'Administrador' : 'Autor do Lançamento'}
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold">
                {activeUser.cargo === 'GESTOR' ? 'Edição Liberada (Admin)' : 'Edição Permitida (<24h)'}
              </span>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                handleSaveEdit();
              }}
              className="space-y-4 text-xs"
            >
              {/* Primary vehicle & service details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Placa do Veículo:</label>
                  <input
                    type="text"
                    required
                    value={editForm.placa}
                    onChange={e => setEditForm({ ...editForm, placa: e.target.value.toUpperCase() })}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Modelo:</label>
                  <input
                    type="text"
                    required
                    value={editForm.modelo}
                    onChange={e => setEditForm({ ...editForm, modelo: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Data da Manutenção:</label>
                  <input
                    type="date"
                    required
                    value={editForm.data}
                    onChange={e => setEditForm({ ...editForm, data: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tipo de Manutenção:</label>
                  <select
                    value={editForm.tipo}
                    onChange={e => setEditForm({ ...editForm, tipo: e.target.value as MaintenanceType })}
                    className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                  >
                    <option value="OLEO">Troca de Óleo</option>
                    <option value="PNEU">Pneus &amp; Suspensão</option>
                    <option value="MECANICA">Mecânica Geral</option>
                    <option value="ELETRICA">Elétrica &amp; Bateria</option>
                    <option value="FUNILARIA">Funilaria &amp; Pintura</option>
                    <option value="REVISAO_PROGRAMADA">Revisão Programada</option>
                    <option value="VISTORIA">Vistoria Preventiva</option>
                    <option value="OUTROS">Outros Serviços</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Fornecedor Credenciado (fornecedor_id):</label>
                  <select
                    value={editForm.fornecedorId || ''}
                    onChange={e => {
                      const selId = e.target.value;
                      const sup = availableSuppliers.find(s => s.id === selId);
                      setEditForm({
                        ...editForm,
                        fornecedorId: selId || undefined,
                        fornecedor: sup ? sup.fantasia : editForm.fornecedor,
                      });
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-slate-50 text-slate-800 text-xs"
                  >
                    <option value="">Texto Livre / Sem vínculo formal</option>
                    <optgroup label="Fornecedores Credenciados">
                      {availableSuppliers.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.fantasia} ({s.cpfCnpj}) {!s.ativo ? '[Inativo]' : ''}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <input
                    type="text"
                    required
                    value={editForm.fornecedor}
                    onChange={e => setEditForm({ ...editForm, fornecedor: e.target.value })}
                    placeholder="Nome da oficina / fornecedor"
                    className="w-full border border-slate-300 rounded-lg p-2 mt-1.5"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Odômetro (km):</label>
                  <input
                    type="number"
                    required
                    value={editForm.odometro}
                    onChange={e => setEditForm({ ...editForm, odometro: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono font-medium"
                  />
                </div>
              </div>

              {/* Peças / Itens da Nota */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">1. Peças e Componentes:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditForm({
                        ...editForm,
                        pecas: [
                          ...editForm.pecas,
                          { descricao: 'Novo Item / Peça', quantidade: 1, valorUnitario: 0, total: 0 },
                        ],
                      });
                    }}
                    className="text-sky-700 hover:text-sky-900 font-bold flex items-center gap-1 text-[11px]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Peça
                  </button>
                </div>

                {editForm.pecas.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">Nenhuma peça lançada nesta OS.</p>
                ) : (
                  editForm.pecas.map((p, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-slate-200">
                      <div className="col-span-6">
                        <input
                          type="text"
                          value={p.descricao}
                          onChange={e => {
                            const newPecas = [...editForm.pecas];
                            newPecas[idx].descricao = e.target.value;
                            setEditForm({ ...editForm, pecas: newPecas });
                          }}
                          placeholder="Descrição da peça"
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          value={p.quantidade}
                          onChange={e => {
                            const q = Math.max(1, Number(e.target.value) || 1);
                            const newPecas = [...editForm.pecas];
                            newPecas[idx].quantidade = q;
                            newPecas[idx].total = q * (newPecas[idx].valorUnitario || 0);
                            setEditForm({ ...editForm, pecas: newPecas });
                          }}
                          placeholder="Qtd"
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-center"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          step="0.01"
                          value={p.valorUnitario}
                          onChange={e => {
                            const unit = Number(e.target.value) || 0;
                            const newPecas = [...editForm.pecas];
                            newPecas[idx].valorUnitario = unit;
                            newPecas[idx].total = (newPecas[idx].quantidade || 1) * unit;
                            setEditForm({ ...editForm, pecas: newPecas });
                          }}
                          placeholder="R$ Unit."
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const newPecas = editForm.pecas.filter((_, i) => i !== idx);
                            setEditForm({ ...editForm, pecas: newPecas });
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remover peça"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Mão de Obra */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">2. Mão de Obra e Serviços:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditForm({
                        ...editForm,
                        servicos: [
                          ...editForm.servicos,
                          { descricao: 'Serviço Mecânico / Troca', valor: 0 },
                        ],
                      });
                    }}
                    className="text-sky-700 hover:text-sky-900 font-bold flex items-center gap-1 text-[11px]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Serviço
                  </button>
                </div>

                {editForm.servicos.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">Nenhum serviço de mão de obra lançado.</p>
                ) : (
                  editForm.servicos.map((s, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-slate-200">
                      <div className="col-span-8">
                        <input
                          type="text"
                          value={s.descricao}
                          onChange={e => {
                            const newServ = [...editForm.servicos];
                            newServ[idx].descricao = e.target.value;
                            setEditForm({ ...editForm, servicos: newServ });
                          }}
                          placeholder="Descrição do serviço executado"
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          step="0.01"
                          value={s.valor}
                          onChange={e => {
                            const newServ = [...editForm.servicos];
                            newServ[idx].valor = Number(e.target.value) || 0;
                            setEditForm({ ...editForm, servicos: newServ });
                          }}
                          placeholder="R$ Valor"
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const newServ = editForm.servicos.filter((_, i) => i !== idx);
                            setEditForm({ ...editForm, servicos: newServ });
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remover serviço"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Financial recalculated summary */}
              {(() => {
                const subPecas = editForm.pecas.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
                const subMO = editForm.servicos.reduce((acc, s) => acc + (Number(s.valor) || 0), 0);
                const subTotal = subPecas + subMO;
                return (
                  <div className="bg-sky-50 border border-sky-200 p-3.5 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-sky-800">Peças: R$ {subPecas.toFixed(2)}</span>
                      <span className="text-[11px] text-sky-800 ml-3">Mão de Obra: R$ {subMO.toFixed(2)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-sky-900 font-medium">Novo Total Recalculado:</span>
                      <div className="text-base font-extrabold text-[#0F2744]">
                        R$ {subTotal.toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Revision planning & Observations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Próxima Revisão (km):</label>
                  <input
                    type="number"
                    value={editForm.proximaRevisaoKm}
                    onChange={e => setEditForm({ ...editForm, proximaRevisaoKm: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Data Prevista da Revisão:</label>
                  <input
                    type="date"
                    value={editForm.proximaRevisaoData}
                    onChange={e => setEditForm({ ...editForm, proximaRevisaoData: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Motivo / Justificativa da Alteração:</label>
                <input
                  type="text"
                  value={editForm.motivoEdicao}
                  onChange={e => setEditForm({ ...editForm, motivoEdicao: e.target.value })}
                  placeholder="Ex: Correção de valor de peça na Danfe, ajuste de odômetro, erro de digitação..."
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Observações do Serviço:</label>
                <textarea
                  rows={2}
                  value={editForm.observacoes}
                  onChange={e => setEditForm({ ...editForm, observacoes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setEditingService(null);
                    setEditForm(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Gravar Correção do Lançamento</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP DE PERMISSÃO BLOQUEADA (QUANDO EXCEDER 24H OU NÃO FOR O AUTOR) */}
      {permissionBlockedInfo && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-amber-300 animate-in zoom-in-95 text-xs">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 mx-auto">
              <Lock className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-base text-slate-900">
                Edição Bloqueada por Regra de Acesso
              </h3>
              <p className="text-slate-600">
                {permissionBlockedInfo.reason}
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <div className="font-bold text-[#0F2744]">📋 Regras do Sistema:</div>
              <ul className="space-y-1 text-slate-600 list-disc list-inside">
                <li>
                  <strong>Administrador:</strong> Pode editar todos os lançamentos a qualquer momento.
                </li>
                <li>
                  <strong>Autor sem perfil Admin:</strong> Só pode editar seu próprio lançamento em até <strong>24 horas</strong> da criação.
                </li>
              </ul>
            </div>

            <div className="flex justify-center pt-2 border-t">
              <button
                type="button"
                onClick={() => setPermissionBlockedInfo(null)}
                className="bg-[#0F2744] hover:bg-[#1E3A5F] text-white px-5 py-2 rounded-lg font-semibold"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE NOVO FORNECEDOR DETECTADO PELA IA */}
      {showQuickSupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-sky-300 max-h-[92vh] overflow-y-auto my-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-700 flex items-center justify-center border border-sky-300">
                  <Building2 className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F2744] text-base">
                    Confirmar Cadastro de Novo Fornecedor
                  </h3>
                  <p className="text-xs text-slate-500">
                    A IA sugeriu estes dados. Revise e confirme para criar o vínculo formal.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickSupplierModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {quickSupplierError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{quickSupplierError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmNewSupplier} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nome Fantasia <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={quickSupplierData.fantasia}
                  onChange={e => setQuickSupplierData({ ...quickSupplierData, fantasia: e.target.value })}
                  placeholder="Ex: Auto Centro Belém Doca"
                  className="w-full border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Razão Social</label>
                <input
                  type="text"
                  value={quickSupplierData.razaoSocial}
                  onChange={e => setQuickSupplierData({ ...quickSupplierData, razaoSocial: e.target.value })}
                  placeholder="Razão social oficial"
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">CPF ou CNPJ</label>
                  <input
                    type="text"
                    value={quickSupplierData.cpfCnpj}
                    onChange={e => setQuickSupplierData({ ...quickSupplierData, cpfCnpj: formatCpfCnpj(e.target.value) })}
                    placeholder="00.000.000/0000-00"
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Categoria</label>
                  <select
                    value={quickSupplierData.categoria}
                    onChange={e => setQuickSupplierData({ ...quickSupplierData, categoria: e.target.value as SupplierCategory })}
                    className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-slate-50 text-slate-800"
                  >
                    <option value="oficina">Oficina Mecânica</option>
                    <option value="pecas">Auto Peças</option>
                    <option value="pneus">Pneus &amp; Geometria</option>
                    <option value="eletrica">Auto Elétrica</option>
                    <option value="funilaria">Funilaria &amp; Pintura</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Cidade</label>
                  <input
                    type="text"
                    value={quickSupplierData.cidade}
                    onChange={e => setQuickSupplierData({ ...quickSupplierData, cidade: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">UF</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={quickSupplierData.uf}
                    onChange={e => setQuickSupplierData({ ...quickSupplierData, uf: e.target.value.toUpperCase() })}
                    className="w-full border border-slate-300 rounded-lg p-2 uppercase font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contato / Responsável</label>
                  <input
                    type="text"
                    value={quickSupplierData.contato}
                    onChange={e => setQuickSupplierData({ ...quickSupplierData, contato: e.target.value })}
                    placeholder="Nome do contato"
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">WhatsApp / Telefone</label>
                  <input
                    type="text"
                    value={quickSupplierData.whatsapp}
                    onChange={e => setQuickSupplierData({ ...quickSupplierData, whatsapp: formatPhone(e.target.value) })}
                    placeholder="(91) 98000-0000"
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickSupplierModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#0F2744] hover:bg-slate-800 text-white px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Confirmar &amp; Vincular Fornecedor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Service Entry Modal without AI */}
      <ManualServiceModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        vehicles={vehicles}
        suppliers={availableSuppliers}
        onSuppliersUpdated={onSuppliersUpdated}
        currentUser={activeUser}
        onServiceAdded={(newService) => {
          onServiceAdded(newService);
          setShowManualModal(false);
        }}
        onSendChatwootAlert={onSendChatwootAlert}
      />

      {/* User Management & Password Control Modal */}
      <UserManagementModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        currentUser={activeUser}
        onUserChanged={(updatedUser) => {
          setActiveUser(updatedUser);
          storage.setActiveUser(updatedUser);
          if (onUpdateCurrentUser) onUpdateCurrentUser(updatedUser);
        }}
        onUsersListUpdated={() => {
          if (onUpdateCurrentUser) onUpdateCurrentUser(storage.getActiveUser());
        }}
      />

      {/* Invoice Document Viewer Modal */}
      <InvoiceDocumentModal
        isOpen={Boolean(viewingDocumentService)}
        onClose={() => setViewingDocumentService(null)}
        service={viewingDocumentService}
      />
    </div>
  );
};

