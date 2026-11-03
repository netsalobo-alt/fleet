import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Wrench,
  Car,
  Search,
  CheckCircle2,
  Calendar,
  Gauge,
  Store,
  DollarSign,
  Plus,
  Trash2,
  AlertTriangle,
  Building2,
  ChevronDown,
  User,
  ShieldCheck,
  Send,
  FileText,
  Clock,
  Sparkles,
  Info,
  Paperclip,
  UploadCloud,
} from 'lucide-react';
import {
  Vehicle,
  ServiceLog,
  MaintenanceType,
  ServiceItemPart,
  ServiceItemLabor,
  Supplier,
  SupplierCategory,
  SystemUser,
} from '../types';
import { LicensePlateBadge } from './LicensePlateBadge';
import { storage } from '../services/storage';
import { validateCpfCnpj, formatCpfCnpj, formatPhone } from '../utils/validators';

interface ManualServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  suppliers?: Supplier[];
  onSuppliersUpdated?: () => void;
  initialPlaca?: string;
  currentUser?: SystemUser;
  onServiceAdded: (service: ServiceLog) => void;
  onSendChatwootAlert?: (message: string, placa: string) => Promise<boolean>;
}

const MAINTENANCE_TYPES: { id: MaintenanceType; label: string; icon: string; defaultIntervalKm: number; defaultMonths: number; defaultItems: string[] }[] = [
  { id: 'OLEO', label: 'Troca de Óleo e Filtros', icon: '🛢️', defaultIntervalKm: 10000, defaultMonths: 6, defaultItems: ['Troca de Óleo', 'Filtro de Óleo', 'Filtro de Combustível'] },
  { id: 'MECANICA', label: 'Mecânica Geral', icon: '⚙️', defaultIntervalKm: 10000, defaultMonths: 6, defaultItems: ['Inspeção Mecânica', 'Checagem de Correias'] },
  { id: 'PNEU', label: 'Pneus e Geometria', icon: '🛞', defaultIntervalKm: 10000, defaultMonths: 6, defaultItems: ['Rodízio de Pneus', 'Alinhamento 3D', 'Balanceamento'] },
  { id: 'ELETRICA', label: 'Elétrica e Bateria', icon: '⚡', defaultIntervalKm: 15000, defaultMonths: 12, defaultItems: ['Teste de Bateria', 'Alternador', 'Lâmpadas'] },
  { id: 'FUNILARIA', label: 'Funilaria e Pintura', icon: '🔨', defaultIntervalKm: 20000, defaultMonths: 12, defaultItems: ['Inspeção de Lataria'] },
  { id: 'REVISAO_PROGRAMADA', label: 'Revisão Programada', icon: '📋', defaultIntervalKm: 10000, defaultMonths: 6, defaultItems: ['Revisão Periódica Completa', 'Fluidos e Pastilhas'] },
  { id: 'VISTORIA', label: 'Vistoria / Inspeção', icon: '🔍', defaultIntervalKm: 10000, defaultMonths: 6, defaultItems: ['Vistoria Cautelar'] },
  { id: 'OUTROS', label: 'Outros Serviços', icon: '🔧', defaultIntervalKm: 10000, defaultMonths: 6, defaultItems: ['Checagem Geral'] },
];

export const ManualServiceModal: React.FC<ManualServiceModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  suppliers = [],
  onSuppliersUpdated,
  initialPlaca,
  currentUser,
  onServiceAdded,
  onSendChatwootAlert,
}) => {
  if (!isOpen) return null;

  const activeUser = currentUser || storage.getActiveUser();
  const availableSuppliers = suppliers.length > 0 ? suppliers : storage.getSuppliers();

  // Selected Vehicle State
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [plateSearchInput, setPlateSearchInput] = useState('');
  const [isPlateDropdownOpen, setIsPlateDropdownOpen] = useState(false);

  // Form Fields
  const [dataServico, setDataServico] = useState(() => new Date().toISOString().split('T')[0]);
  const [odometroServico, setOdometroServico] = useState<number>(0);
  const [tipoManutencao, setTipoManutencao] = useState<MaintenanceType>('OLEO');
  const [numeroOS, setNumeroOS] = useState('');
  const [statusOS, setStatusOS] = useState<'CONCLUIDO' | 'EM_ANDAMENTO' | 'AGENDADO'>('CONCLUIDO');

  // Supplier Selection & Quick Add
  const [fornecedorModo, setFornecedorModo] = useState<'LISTA' | 'DIGITADO'>('LISTA');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [fornecedorDigitado, setFornecedorDigitado] = useState('');
  const [showQuickSupplierModal, setShowQuickSupplierModal] = useState(false);
  const [quickSupData, setQuickSupData] = useState({
    fantasia: '',
    razaoSocial: '',
    cpfCnpj: '',
    categoria: 'oficina' as SupplierCategory,
    cidade: 'Belém',
    uf: 'PA',
    contato: '',
    whatsapp: '',
  });
  const [quickSupError, setQuickSupError] = useState<string | null>(null);

  // Dynamic Parts List
  const [parts, setParts] = useState<ServiceItemPart[]>([
    { descricao: 'Óleo de Motor Sintético 5W30', quantidade: 4, valorUnitario: 65, total: 260 },
    { descricao: 'Filtro de Óleo', quantidade: 1, valorUnitario: 45, total: 45 },
  ]);

  // Dynamic Labor / Services List
  const [labor, setLabor] = useState<ServiceItemLabor[]>([
    { descricao: 'Mão de obra troca de óleo e filtros', valor: 80 },
  ]);

  // Next Revision Forecast
  const [proximaRevisaoKm, setProximaRevisaoKm] = useState<number>(0);
  const [proximaRevisaoData, setProximaRevisaoData] = useState('');
  const [itensProximaRevisao, setItensProximaRevisao] = useState<string>('Troca de Óleo, Filtros');

  // Observations
  const [observacoes, setObservacoes] = useState('');
  const [notifyChatwoot, setNotifyChatwoot] = useState(false);

  // Attached Document (Invoice / Receipt / OS scan)
  const [attachedDoc, setAttachedDoc] = useState<{
    nome: string;
    tipo: 'IMAGEM' | 'PDF';
    urlBase64?: string;
  } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedDoc({
        nome: file.name,
        tipo: isPdf ? 'PDF' : 'IMAGEM',
        urlBase64: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  // Errors & Feedback
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or preselect vehicle if initialPlaca provided
  useEffect(() => {
    if (initialPlaca) {
      const cleanTarget = initialPlaca.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const found = vehicles.find(
        v => v.placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === cleanTarget
      );
      if (found) {
        handleSelectVehicle(found);
      } else {
        setPlateSearchInput(initialPlaca);
      }
    } else if (vehicles.length > 0 && !selectedVehicle) {
      // Don't auto-force, let user search or pick
      setPlateSearchInput('');
    }
  }, [initialPlaca, vehicles]);

  // Filter vehicles by typed plate or model
  const filteredVehicles = useMemo(() => {
    if (!plateSearchInput.trim()) return vehicles;
    const term = plateSearchInput.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    return vehicles.filter(v => {
      const p = v.placa.toLowerCase().replace(/[^a-z0-9]/g, '');
      const m = v.modelo.toLowerCase();
      const d = (v.motoristaNome || '').toLowerCase();
      return p.includes(term) || m.includes(plateSearchInput.toLowerCase()) || d.includes(plateSearchInput.toLowerCase());
    });
  }, [plateSearchInput, vehicles]);

  // When vehicle selected, sync odometer & calculate next revision
  const handleSelectVehicle = (v: Vehicle) => {
    setSelectedVehicle(v);
    setPlateSearchInput(v.placa);
    setIsPlateDropdownOpen(false);
    setFormError(null);

    const km = Number(v.odometroEstimado ?? v.odometroAtual ?? 0);
    setOdometroServico(km);

    // Calculate revision suggestion based on current selected type
    recalcRevision(km, tipoManutencao);
  };

  // Recalculate revision forecast helper
  const recalcRevision = (baseKm: number, type: MaintenanceType) => {
    const config = MAINTENANCE_TYPES.find(t => t.id === type) || MAINTENANCE_TYPES[0];
    const nextKm = (baseKm || 0) + config.defaultIntervalKm;
    setProximaRevisaoKm(nextKm);

    const d = new Date(dataServico ? new Date(dataServico).getTime() : Date.now());
    d.setMonth(d.getMonth() + config.defaultMonths);
    setProximaRevisaoData(d.toISOString().split('T')[0]);
    setItensProximaRevisao(config.defaultItems.join(', '));
  };

  // Handle Maintenance Type Change
  const handleTypeChange = (type: MaintenanceType) => {
    setTipoManutencao(type);
    recalcRevision(odometroServico, type);
  };

  // Parts handlers
  const handleAddPart = () => {
    setParts(prev => [...prev, { descricao: '', quantidade: 1, valorUnitario: 0, total: 0 }]);
  };

  const handleUpdatePart = (index: number, field: keyof ServiceItemPart, val: any) => {
    setParts(prev => {
      const copy = [...prev];
      const item = { ...copy[index], [field]: val };
      if (field === 'quantidade' || field === 'valorUnitario') {
        const q = field === 'quantidade' ? Number(val) || 0 : item.quantidade;
        const u = field === 'valorUnitario' ? Number(val) || 0 : item.valorUnitario;
        item.total = Number((q * u).toFixed(2));
      }
      copy[index] = item;
      return copy;
    });
  };

  const handleRemovePart = (index: number) => {
    setParts(prev => prev.filter((_, i) => i !== index));
  };

  // Labor handlers
  const handleAddLabor = () => {
    setLabor(prev => [...prev, { descricao: '', valor: 0 }]);
  };

  const handleUpdateLabor = (index: number, field: keyof ServiceItemLabor, val: any) => {
    setLabor(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleRemoveLabor = (index: number) => {
    setLabor(prev => prev.filter((_, i) => i !== index));
  };

  // Financial Totals
  const valorPecas = useMemo(() => {
    return parts.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
  }, [parts]);

  const valorMaoDeObra = useMemo(() => {
    return labor.reduce((acc, l) => acc + (Number(l.valor) || 0), 0);
  }, [labor]);

  const valorTotal = useMemo(() => {
    return valorPecas + valorMaoDeObra;
  }, [valorPecas, valorMaoDeObra]);

  // Quick Supplier Creation
  const handleSaveQuickSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickSupError(null);

    if (!quickSupData.fantasia.trim()) {
      setQuickSupError('Nome fantasia da oficina ou loja é obrigatório.');
      return;
    }

    if (quickSupData.cpfCnpj.trim()) {
      const docVal = validateCpfCnpj(quickSupData.cpfCnpj);
      if (!docVal.isValid) {
        setQuickSupError(docVal.errorMessage || 'CPF/CNPJ inválido');
        return;
      }
    }

    try {
      const cleanDoc = quickSupData.cpfCnpj.replace(/\D/g, '');
      const newSup = storage.addSupplier({
        fantasia: quickSupData.fantasia.trim(),
        razaoSocial: quickSupData.razaoSocial.trim() || quickSupData.fantasia.trim(),
        cpfCnpj: quickSupData.cpfCnpj.trim() ? formatCpfCnpj(quickSupData.cpfCnpj) : '04.912.834/0001-24',
        tipoDocumento: cleanDoc.length === 11 ? 'CPF' : 'CNPJ',
        categoria: quickSupData.categoria,
        cidade: quickSupData.cidade.trim() || 'Belém',
        uf: quickSupData.uf.trim().toUpperCase() || 'PA',
        endereco: '',
        email: '',
        contato: quickSupData.contato.trim(),
        whatsapp: quickSupData.whatsapp.trim() ? formatPhone(quickSupData.whatsapp) : '',
        ativo: true,
        observacoes: 'Cadastrado via lançamento manual de manutenção.',
      });

      if (onSuppliersUpdated) {
        onSuppliersUpdated();
      }

      setSelectedSupplierId(newSup.id);
      setFornecedorModo('LISTA');
      setShowQuickSupplierModal(false);
    } catch (err: any) {
      setQuickSupError(err.message || 'Erro ao cadastrar fornecedor.');
    }
  };

  // Submit Final Service
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedVehicle) {
      // Check if plate typed matches a vehicle
      const cleanTyped = plateSearchInput.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const match = vehicles.find(v => v.placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === cleanTyped);
      if (match) {
        setSelectedVehicle(match);
      } else {
        setFormError('Por favor, selecione ou digite uma placa válida de um veículo da frota.');
        return;
      }
    }

    const currentV = selectedVehicle!;
    const cleanOdo = Number(odometroServico);

    if (isNaN(cleanOdo) || cleanOdo < 0) {
      setFormError('Informe um odômetro válido em quilômetros (km).');
      return;
    }

    // Determine supplier name & ID
    let finalFornecedorNome = '';
    let finalFornecedorId: string | undefined = undefined;

    if (fornecedorModo === 'LISTA') {
      const s = availableSuppliers.find(sup => sup.id === selectedSupplierId);
      if (s) {
        finalFornecedorNome = s.fantasia;
        finalFornecedorId = s.id;
      } else {
        finalFornecedorNome = availableSuppliers[0]?.fantasia || 'Oficina Credenciada';
        finalFornecedorId = availableSuppliers[0]?.id;
      }
    } else {
      finalFornecedorNome = fornecedorDigitado.trim() || 'Oficina Manual';
    }

    // Clean valid parts & labor
    const cleanParts = parts.filter(p => p.descricao.trim() && (Number(p.total) > 0 || Number(p.valorUnitario) > 0));
    const cleanLabor = labor.filter(l => l.descricao.trim() && Number(l.valor) > 0);

    const itemsRevArray = itensProximaRevisao
      ? itensProximaRevisao.split(',').map(i => i.trim()).filter(Boolean)
      : ['Troca de Óleo', 'Filtros'];

    setIsSubmitting(true);

    try {
      const newService: ServiceLog = {
        id: 'srv-man-' + Date.now(),
        veiculoId: currentV.id,
        placa: currentV.placa,
        modelo: currentV.modelo,
        data: dataServico,
        tipo: tipoManutencao,
        fornecedor: finalFornecedorNome,
        fornecedorId: finalFornecedorId,
        fornecedorNome: finalFornecedorNome,
        odometro: cleanOdo,
        pecas: cleanParts,
        servicos: cleanLabor,
        valorPecas,
        valorMaoDeObra,
        valorTotal,
        proximaRevisaoKm: Number(proximaRevisaoKm) || cleanOdo + 10000,
        proximaRevisaoData: proximaRevisaoData || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
        itensProximaRevisao: itemsRevArray,
        observacoes: observacoes.trim() || (numeroOS ? `Ordem de Serviço Nº ${numeroOS}. Lançamento manual.` : 'Lançamento manual direto.'),
        descricaoResumida: numeroOS ? `OS #${numeroOS} - ${tipoManutencao} em ${finalFornecedorNome}` : `${tipoManutencao} em ${finalFornecedorNome}`,
        iaGerado: false,
        status: statusOS,
        anexoDocumento: attachedDoc || undefined,
        createdAt: new Date().toISOString(),
        criadoPorId: activeUser.id,
        criadoPorNome: activeUser.nome,
        criadoPorCargo: activeUser.cargo,
      };

      storage.addService(newService);
      onServiceAdded(newService);

      // Optional Chatwoot notification dispatch
      if (notifyChatwoot && onSendChatwootAlert) {
        const chatMsg = `🔧 *LANÇAMENTO MANUAL DE SERVIÇO - FLEET TELECOM PA*
🚗 *Veículo:* ${currentV.modelo} (Placa: ${currentV.placa})
📍 *Oficina / Fornecedor:* ${finalFornecedorNome} ${numeroOS ? `(OS: #${numeroOS})` : ''}
⏱️ *Odômetro:* ${cleanOdo.toLocaleString('pt-BR')} km
🏷️ *Tipo:* ${tipoManutencao}
💰 *Total:* R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Peças: R$ ${valorPecas.toFixed(2)} | M.O.: R$ ${valorMaoDeObra.toFixed(2)})
📅 *Próxima Revisão:* ${Number(proximaRevisaoKm).toLocaleString('pt-BR')} km em ${proximaRevisaoData.split('-').reverse().join('/')}
👤 *Lançado Manualmente Por:* ${activeUser.nome} (${activeUser.cargo})`;

        await onSendChatwootAlert(chatMsg, currentV.placa);
      }

      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar serviço manual:', err);
      setFormError(err.message || 'Erro ao gravar manutenção no sistema.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="bg-[#0F2744] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Lançamento Manual de Manutenção
                </h2>
                <span className="bg-sky-400/20 text-sky-300 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-sky-400/30">
                  Sem IA / Direto
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Preencha os serviços e peças realizados no veículo sem consumir tokens de IA.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs text-slate-700">
          
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. SELEÇÃO DO VEÍCULO (BUSCA POR PLACA OU SELEÇÃO EM LISTA) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Car className="w-4 h-4 text-sky-600" />
                1. Identificação do Veículo (Placa ou Lista):
              </label>
              {selectedVehicle && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVehicle(null);
                    setPlateSearchInput('');
                  }}
                  className="text-[11px] text-sky-700 hover:underline font-semibold"
                >
                  Trocar Veículo
                </button>
              )}
            </div>

            {!selectedVehicle ? (
              <div className="space-y-3">
                {/* Search Input with Autocomplete */}
                <div className="relative">
                  <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-300 p-2 focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-sky-500">
                    <Search className="w-4 h-4 text-slate-400 ml-1" />
                    <input
                      type="text"
                      value={plateSearchInput}
                      onChange={e => {
                        setPlateSearchInput(e.target.value.toUpperCase());
                        setIsPlateDropdownOpen(true);
                      }}
                      onFocus={() => setIsPlateDropdownOpen(true)}
                      placeholder="Digite a placa (ex: QEN-4521) ou modelo do veículo..."
                      className="w-full text-xs font-bold text-slate-900 bg-transparent focus:outline-none uppercase"
                    />
                    {plateSearchInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setPlateSearchInput('');
                          setIsPlateDropdownOpen(false);
                        }}
                        className="text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Autocomplete Results Dropdown */}
                  {isPlateDropdownOpen && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-60 overflow-y-auto divide-y divide-slate-100">
                      {filteredVehicles.length > 0 ? (
                        filteredVehicles.map(v => (
                          <div
                            key={v.id}
                            onClick={() => handleSelectVehicle(v)}
                            className="p-3 hover:bg-sky-50 cursor-pointer flex items-center justify-between gap-3 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <LicensePlateBadge placa={v.placa} size="sm" />
                              <div>
                                <strong className="text-slate-900 block text-xs">{v.modelo}</strong>
                                <span className="text-[11px] text-slate-500 font-medium">
                                  {v.marca} • Ano {v.ano} • Motorista: {v.motoristaNome || 'Livre'}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-sky-950 block text-xs">
                                {(v.odometroEstimado ?? v.odometroAtual).toLocaleString('pt-BR')} km
                              </span>
                              <span className="text-[10px] text-slate-400">Odômetro Atual</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-slate-500 text-xs">
                          Nenhum veículo encontrado com "{plateSearchInput}".
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick Pick Dropdown Selector */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-medium whitespace-nowrap">Ou selecione na lista completa:</span>
                  <select
                    value=""
                    onChange={e => {
                      const v = vehicles.find(item => item.id === e.target.value);
                      if (v) handleSelectVehicle(v);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">Selecione um dos {vehicles.length} veículos da frota...</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.placa} — {v.modelo} ({(v.odometroEstimado ?? v.odometroAtual).toLocaleString('pt-BR')} km)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              /* Selected Vehicle Card Badge */
              <div className="bg-white p-3.5 rounded-xl border border-sky-300 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <LicensePlateBadge placa={selectedVehicle.placa} size="md" />
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{selectedVehicle.modelo}</h3>
                    <p className="text-[11px] text-slate-500">
                      {selectedVehicle.marca} • {selectedVehicle.ano} • {selectedVehicle.cor} • Combustível: {selectedVehicle.combustivel}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-700 mt-0.5">
                      <User className="w-3 h-3 text-sky-600" />
                      <span>Motorista: <strong>{selectedVehicle.motoristaNome || 'Não atribuído'}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-sky-50/80 px-3 py-2 rounded-lg border border-sky-200 text-xs">
                  <Gauge className="w-4 h-4 text-sky-700" />
                  <div>
                    <span className="text-[10px] text-sky-800 font-bold block uppercase">Odômetro Atual na Frota</span>
                    <strong className="font-mono text-sky-950 font-black text-sm">
                      {(selectedVehicle.odometroEstimado ?? selectedVehicle.odometroAtual).toLocaleString('pt-BR')} km
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. DADOS DA MANUTENÇÃO (DATA, ODÔMETRO, TIPO, OS) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Data do Serviço */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Data do Serviço:
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dataServico}
                  onChange={e => {
                    setDataServico(e.target.value);
                    if (selectedVehicle) recalcRevision(odometroServico, tipoManutencao);
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>
            </div>

            {/* Odômetro no Momento do Serviço */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1 flex items-center justify-between">
                <span>Odômetro do Serviço (km):</span>
                {selectedVehicle && odometroServico < (selectedVehicle.odometroEstimado ?? selectedVehicle.odometroAtual) && (
                  <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5">
                    <Info className="w-3 h-3" /> Histórico antigo
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={odometroServico || ''}
                  onChange={e => {
                    const km = Number(e.target.value) || 0;
                    setOdometroServico(km);
                    recalcRevision(km, tipoManutencao);
                  }}
                  placeholder="Ex: 48900"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>
            </div>

            {/* Tipo de Manutenção */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Tipo / Categoria de Serviço:
              </label>
              <select
                value={tipoManutencao}
                onChange={e => handleTypeChange(e.target.value as MaintenanceType)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {MAINTENANCE_TYPES.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.icon} {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Número da OS / NF */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Nº da Ordem de Serviço / NF:
              </label>
              <input
                type="text"
                value={numeroOS}
                onChange={e => setNumeroOS(e.target.value)}
                placeholder="Ex: OS-9842 ou NF 1420"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* 3. FORNECEDOR / OFICINA */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Store className="w-4 h-4 text-sky-600" />
                2. Oficina ou Fornecedor Credenciado:
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFornecedorModo(fornecedorModo === 'LISTA' ? 'DIGITADO' : 'LISTA')}
                  className="text-[11px] text-sky-700 hover:underline font-semibold"
                >
                  {fornecedorModo === 'LISTA' ? 'Digitar nome livremente' : 'Selecionar de fornecedores cadastrados'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowQuickSupplierModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Cadastrar Fornecedor</span>
                </button>
              </div>
            </div>

            {fornecedorModo === 'LISTA' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <select
                    value={selectedSupplierId}
                    onChange={e => setSelectedSupplierId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">Selecione a oficina / fornecedor credenciado...</option>
                    {availableSuppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.fantasia} ({s.cidade}-{s.uf}) • {s.categoria.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Supplier Details Preview */}
                {selectedSupplierId && (
                  <div className="bg-white p-2 rounded-lg border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
                    {(() => {
                      const s = availableSuppliers.find(sup => sup.id === selectedSupplierId);
                      if (!s) return null;
                      return (
                        <>
                          <div>
                            <strong className="text-slate-900 block">{s.razaoSocial}</strong>
                            <span>CNPJ/CPF: {s.cpfCnpj} • Contato: {s.contato || s.whatsapp || 'N/A'}</span>
                          </div>
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold uppercase">
                            {s.categoria}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={fornecedorDigitado}
                  onChange={e => setFornecedorDigitado(e.target.value)}
                  placeholder="Nome fantasia ou razão social da oficina..."
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            )}
          </div>

          {/* 4. PEÇAS E MATERIAIS UTILIZADOS (TABELA DINÂMICA) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📦 Peças e Materiais Aplicados:</span>
                </label>
                <span className="text-[11px] text-slate-500">
                  Adicione óleo, filtros, pastilhas, pneus ou outros componentes trocados.
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddPart}
                className="bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-300 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Peça</span>
              </button>
            </div>

            {parts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="p-2.5">Descrição do Item / Peça</th>
                      <th className="p-2.5 w-24 text-center">Qtd.</th>
                      <th className="p-2.5 w-32 text-right">Valor Unit. (R$)</th>
                      <th className="p-2.5 w-32 text-right">Total (R$)</th>
                      <th className="p-2.5 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parts.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2">
                          <input
                            type="text"
                            value={p.descricao}
                            onChange={e => handleUpdatePart(idx, 'descricao', e.target.value)}
                            placeholder="Ex: Filtro de Combustível GM"
                            className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="1"
                            value={p.quantidade}
                            onChange={e => handleUpdatePart(idx, 'quantidade', Math.max(1, Number(e.target.value) || 1))}
                            className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-800 text-center font-mono font-bold focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={p.valorUnitario}
                            onChange={e => handleUpdatePart(idx, 'valorUnitario', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-800 text-right font-mono font-bold focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          R$ {(p.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemovePart(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                            title="Remover linha"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                    <tr>
                      <td colSpan={3} className="p-2.5 text-right uppercase text-[11px]">
                        Subtotal Peças:
                      </td>
                      <td className="p-2.5 text-right font-mono text-emerald-700 font-black">
                        R$ {valorPecas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-slate-400 text-xs">
                Nenhuma peça lançada nesta OS (apenas mão de obra ou serviço puro).
              </div>
            )}
          </div>

          {/* 5. MÃO DE OBRA E SERVIÇOS EXECUTADOS */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🛠️ Mão de Obra e Serviços Mecânicos:</span>
                </label>
                <span className="text-[11px] text-slate-500">
                  Descreva alinhamento, balanceamento, limpeza de bicos, troca rápida, etc.
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddLabor}
                className="bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-300 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Serviço</span>
              </button>
            </div>

            {labor.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="p-2.5">Descrição do Serviço / Mão de Obra</th>
                      <th className="p-2.5 w-40 text-right">Valor Cobrado (R$)</th>
                      <th className="p-2.5 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {labor.map((l, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2">
                          <input
                            type="text"
                            value={l.descricao}
                            onChange={e => handleUpdateLabor(idx, 'descricao', e.target.value)}
                            placeholder="Ex: Alinhamento 3D e Balanceamento"
                            className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={l.valor}
                            onChange={e => handleUpdateLabor(idx, 'valor', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-800 text-right font-mono font-bold focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLabor(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                            title="Remover serviço"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                    <tr>
                      <td className="p-2.5 text-right uppercase text-[11px]">
                        Subtotal Mão de Obra:
                      </td>
                      <td className="p-2.5 text-right font-mono text-emerald-700 font-black">
                        R$ {valorMaoDeObra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-slate-400 text-xs">
                Nenhuma mão de obra adicionada.
              </div>
            )}
          </div>

          {/* 6. TOTALIZADOR GERAL */}
          <div className="bg-gradient-to-r from-slate-900 to-[#0F2744] text-white p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
            <div>
              <span className="text-[11px] text-slate-300 font-bold uppercase tracking-wider block">
                Total Geral da Ordem de Serviço
              </span>
              <p className="text-xs text-slate-400">
                Peças (R$ {valorPecas.toFixed(2)}) + Mão de Obra (R$ {valorMaoDeObra.toFixed(2)})
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-sky-400 font-semibold block">Valor a pagar:</span>
              <strong className="text-2xl font-mono font-black text-white">
                R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
          </div>

          {/* 7. PROGRAMAÇÃO DA PRÓXIMA REVISÃO */}
          <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 space-y-3">
            <div className="flex items-center gap-1.5 text-amber-950 font-bold">
              <Calendar className="w-4 h-4 text-amber-700" />
              <span>3. Programação Automática da Próxima Revisão:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-amber-900 block mb-1">
                  Próximo Odômetro Estimado (KM):
                </label>
                <input
                  type="number"
                  value={proximaRevisaoKm || ''}
                  onChange={e => setProximaRevisaoKm(Number(e.target.value) || 0)}
                  className="w-full bg-white border border-amber-300 rounded-lg p-2 font-mono font-bold text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-amber-900 block mb-1">
                  Data Prevista de Vencimento:
                </label>
                <input
                  type="date"
                  value={proximaRevisaoData}
                  onChange={e => setProximaRevisaoData(e.target.value)}
                  className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-amber-900 block mb-1">
                  Itens a Revisar na Próxima:
                </label>
                <input
                  type="text"
                  value={itensProximaRevisao}
                  onChange={e => setItensProximaRevisao(e.target.value)}
                  placeholder="Ex: Troca de Óleo, Filtro de Cabine, Freios"
                  className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* 8. OBSERVAÇÕES & STATUS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Observações Técnicas / Garantia / Relato do Mecânico:
              </label>
              <textarea
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                placeholder="Ex: Garantia de 90 dias nas peças. Nível de fluido de freio verificado. Veículo liberado para rota."
                rows={2}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Status do Atendimento:
              </label>
              <select
                value={statusOS}
                onChange={e => setStatusOS(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 mb-2"
              >
                <option value="CONCLUIDO">Concluído (Veículo Liberado)</option>
                <option value="EM_ANDAMENTO">Em Andamento na Oficina</option>
                <option value="AGENDADO">Agendado para Data Futura</option>
              </select>

              {onSendChatwootAlert && (
                <label className="flex items-center gap-2 cursor-pointer mt-1 text-[11px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={notifyChatwoot}
                    onChange={e => setNotifyChatwoot(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Notificar gestores via Chatwoot</span>
                </label>
              )}
            </div>
          </div>

          {/* 9. ANEXO DE NOTA FISCAL / COMPROVANTE */}
          <div className="bg-sky-50/50 p-3.5 rounded-xl border border-sky-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Paperclip className="w-4 h-4 text-sky-600" />
                  <span>Anexar Nota Fiscal / Recibo / Foto da OS:</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Arquive foto ou PDF para auditoria futura e visualização no histórico de serviços.
                </p>
              </div>

              {!attachedDoc ? (
                <label className="cursor-pointer bg-white hover:bg-sky-50 text-sky-700 border border-sky-300 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors shrink-0">
                  <UploadCloud className="w-4 h-4 text-sky-600" />
                  <span>Selecionar Nota (PDF ou Imagem)</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              ) : (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-bold shrink-0">
                  <span className="truncate max-w-[200px]">{attachedDoc.nome}</span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded uppercase">
                    {attachedDoc.tipo}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAttachedDoc(null)}
                    className="text-red-600 hover:text-red-800 ml-1 font-bold p-0.5"
                    title="Remover anexo"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>
                Lançamento registrado por <strong>{activeUser.nome}</strong> ({activeUser.cargo})
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="w-1/2 sm:w-auto px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !selectedVehicle}
                className="w-1/2 sm:w-auto px-6 py-2.5 rounded-lg bg-[#0F2744] hover:bg-[#1E3A5F] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Gravando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Confirmar e Salvar Serviço</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Quick Supplier Creation Modal */}
        {showQuickSupplierModal && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
              <div className="bg-emerald-800 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-300" />
                  <h3 className="font-bold text-sm">Cadastro Rápido de Fornecedor / Oficina</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickSupplierModal(false)}
                  className="text-emerald-200 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveQuickSupplier} className="p-4 space-y-3 text-xs">
                {quickSupError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                    {quickSupError}
                  </div>
                )}

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nome Fantasia: *</label>
                  <input
                    type="text"
                    value={quickSupData.fantasia}
                    onChange={e => setQuickSupData({ ...quickSupData, fantasia: e.target.value })}
                    placeholder="Ex: Belém Auto Peças"
                    className="w-full border border-slate-300 rounded p-2 text-xs font-semibold"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Razão Social:</label>
                    <input
                      type="text"
                      value={quickSupData.razaoSocial}
                      onChange={e => setQuickSupData({ ...quickSupData, razaoSocial: e.target.value })}
                      placeholder="Ex: Belém Auto Peças Ltda"
                      className="w-full border border-slate-300 rounded p-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">CPF ou CNPJ:</label>
                    <input
                      type="text"
                      value={quickSupData.cpfCnpj}
                      onChange={e => setQuickSupData({ ...quickSupData, cpfCnpj: e.target.value })}
                      placeholder="00.000.000/0001-00"
                      className="w-full border border-slate-300 rounded p-2 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Categoria:</label>
                    <select
                      value={quickSupData.categoria}
                      onChange={e => setQuickSupData({ ...quickSupData, categoria: e.target.value as SupplierCategory })}
                      className="w-full border border-slate-300 rounded p-2 text-xs font-semibold"
                    >
                      <option value="oficina">Oficina Mecânica</option>
                      <option value="pecas">Auto Peças</option>
                      <option value="pneus">Pneus / Geometria</option>
                      <option value="eletrica">Auto Elétrica</option>
                      <option value="funilaria">Funilaria / Pintura</option>
                      <option value="outros">Outros</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Cidade:</label>
                    <input
                      type="text"
                      value={quickSupData.cidade}
                      onChange={e => setQuickSupData({ ...quickSupData, cidade: e.target.value })}
                      className="w-full border border-slate-300 rounded p-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">UF:</label>
                    <input
                      type="text"
                      value={quickSupData.uf}
                      onChange={e => setQuickSupData({ ...quickSupData, uf: e.target.value.toUpperCase() })}
                      maxLength={2}
                      className="w-full border border-slate-300 rounded p-2 text-xs uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Nome do Contato:</label>
                    <input
                      type="text"
                      value={quickSupData.contato}
                      onChange={e => setQuickSupData({ ...quickSupData, contato: e.target.value })}
                      placeholder="Ex: Carlos Mecânico"
                      className="w-full border border-slate-300 rounded p-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">WhatsApp / Telefone:</label>
                    <input
                      type="text"
                      value={quickSupData.whatsapp}
                      onChange={e => setQuickSupData({ ...quickSupData, whatsapp: e.target.value })}
                      placeholder="(91) 98765-4321"
                      className="w-full border border-slate-300 rounded p-2 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowQuickSupplierModal(false)}
                    className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold"
                  >
                    Salvar e Vincular
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
