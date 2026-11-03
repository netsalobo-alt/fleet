import React, { useState } from 'react';
import {
  CalendarCheck2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Send,
  Plus,
  Car,
  Filter,
  Check,
  ChevronRight,
  ShieldAlert,
  Wrench,
  Edit3,
  Trash2,
  User,
  Info,
  History,
  Droplets,
  Disc,
  RotateCw,
  Layers,
  Thermometer,
  Wind,
  Zap,
  Gauge,
  Calendar,
  LayoutList,
  LayoutGrid,
  Search,
  CheckSquare,
  ArrowRight,
} from 'lucide-react';
import { RevisionPlan, Vehicle, SystemUser } from '../types';
import { LicensePlateBadge } from './LicensePlateBadge';
import {
  storage,
  canUserEditOrDeleteRevision,
  isCreatedTodayInBelem,
  calculateRevisionStatus,
} from '../services/storage';

interface RevisionsMonitorViewProps {
  vehicles: Vehicle[];
  revisions: RevisionPlan[];
  currentUser?: SystemUser;
  onRevisionsUpdated: () => void;
  onSendChatwootAlert: (message: string, placa: string) => Promise<boolean>;
}

export interface ServiceTypeMeta {
  label: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  colorBg: string;
  colorText: string;
  colorBorder: string;
  colorBadge: string;
}

export function getServiceTypeMeta(item: string = '', titulo: string = ''): ServiceTypeMeta {
  const normalized = (item + ' ' + titulo).toLowerCase();

  if (normalized.includes('oleo') || normalized.includes('óleo') || normalized.includes('lubrif')) {
    return {
      label: 'Troca de Óleo',
      category: 'Óleo & Lubrificação',
      icon: Droplets,
      colorBg: 'bg-amber-50',
      colorText: 'text-amber-800',
      colorBorder: 'border-amber-200',
      colorBadge: 'bg-amber-100 text-amber-900 border-amber-300',
    };
  }
  if (
    normalized.includes('pneu') ||
    normalized.includes('alinhamento') ||
    normalized.includes('balanceamento') ||
    normalized.includes('rodizio') ||
    normalized.includes('rodízio')
  ) {
    return {
      label: 'Pneus & Geometria',
      category: 'Pneus & Rodagem',
      icon: Disc,
      colorBg: 'bg-slate-100',
      colorText: 'text-slate-800',
      colorBorder: 'border-slate-300',
      colorBadge: 'bg-slate-200 text-slate-800 border-slate-300',
    };
  }
  if (
    normalized.includes('freio') ||
    normalized.includes('pastilha') ||
    normalized.includes('disco') ||
    normalized.includes('fluido')
  ) {
    return {
      label: 'Freios & Pastilhas',
      category: 'Sistema de Frenagem',
      icon: ShieldAlert,
      colorBg: 'bg-rose-50',
      colorText: 'text-rose-800',
      colorBorder: 'border-rose-200',
      colorBadge: 'bg-rose-100 text-rose-900 border-rose-300',
    };
  }
  if (
    normalized.includes('correia') ||
    normalized.includes('tensor') ||
    normalized.includes('dentada') ||
    normalized.includes('motor')
  ) {
    return {
      label: 'Correia Dentada',
      category: 'Correia & Motor',
      icon: RotateCw,
      colorBg: 'bg-purple-50',
      colorText: 'text-purple-800',
      colorBorder: 'border-purple-200',
      colorBadge: 'bg-purple-100 text-purple-900 border-purple-300',
    };
  }
  if (
    normalized.includes('suspensao') ||
    normalized.includes('suspensão') ||
    normalized.includes('amortecedor') ||
    normalized.includes('mola') ||
    normalized.includes('bucha')
  ) {
    return {
      label: 'Suspensão',
      category: 'Suspensão & Amortecedor',
      icon: Layers,
      colorBg: 'bg-emerald-50',
      colorText: 'text-emerald-800',
      colorBorder: 'border-emerald-200',
      colorBadge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    };
  }
  if (
    normalized.includes('arrefecimento') ||
    normalized.includes('radiador') ||
    normalized.includes('aditivo') ||
    normalized.includes('temperatura')
  ) {
    return {
      label: 'Arrefecimento',
      category: 'Radiador & Fluido Térmico',
      icon: Thermometer,
      colorBg: 'bg-cyan-50',
      colorText: 'text-cyan-800',
      colorBorder: 'border-cyan-200',
      colorBadge: 'bg-cyan-100 text-cyan-900 border-cyan-300',
    };
  }
  if (
    normalized.includes('filtro') ||
    normalized.includes('ar condicionado') ||
    normalized.includes('combustivel') ||
    normalized.includes('combustível')
  ) {
    return {
      label: 'Filtros & Ar',
      category: 'Filtros de Cabine e Motor',
      icon: Wind,
      colorBg: 'bg-yellow-50',
      colorText: 'text-yellow-800',
      colorBorder: 'border-yellow-200',
      colorBadge: 'bg-yellow-100 text-yellow-900 border-yellow-300',
    };
  }
  if (
    normalized.includes('eletrica') ||
    normalized.includes('elétrica') ||
    normalized.includes('bateria') ||
    normalized.includes('alternador') ||
    normalized.includes('vela')
  ) {
    return {
      label: 'Elétrica & Bateria',
      category: 'Sistema Elétrico & Carga',
      icon: Zap,
      colorBg: 'bg-amber-50',
      colorText: 'text-amber-800',
      colorBorder: 'border-amber-300',
      colorBadge: 'bg-amber-100 text-amber-900 border-amber-300',
    };
  }

  return {
    label: 'Revisão Geral',
    category: 'Manutenção Preventiva',
    icon: CheckCircle2,
    colorBg: 'bg-sky-50',
    colorText: 'text-sky-800',
    colorBorder: 'border-sky-200',
    colorBadge: 'bg-sky-100 text-sky-900 border-sky-300',
  };
}

export const RevisionsMonitorView: React.FC<RevisionsMonitorViewProps> = ({
  vehicles,
  revisions,
  currentUser,
  onRevisionsUpdated,
  onSendChatwootAlert,
}) => {
  // View mode: 'table' (Lista) by default as requested, or 'cards' (Bloquinhos)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPlaca, setFilterPlaca] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [sendingChatwootId, setSendingChatwootId] = useState<string | null>(null);
  const [sentSuccessId, setSentSuccessId] = useState<string | null>(null);

  // Active user for permissions
  const activeUser = currentUser || storage.getActiveUser();

  // Quick Complete Revision Modal State
  const [completingRevision, setCompletingRevision] = useState<RevisionPlan | null>(null);
  const [completeKm, setCompleteKm] = useState<number>(0);
  const [completeData, setCompleteData] = useState<string>(new Date().toISOString().split('T')[0]);

  // Edit Revision State
  const [editingRevision, setEditingRevision] = useState<RevisionPlan | null>(null);
  const [editTitulo, setEditTitulo] = useState('');
  const [editItem, setEditItem] = useState<any>('OLEO_FILTRO');
  const [editIntervaloKm, setEditIntervaloKm] = useState(10000);
  const [editIntervaloMeses, setEditIntervaloMeses] = useState(6);
  const [editProximoKm, setEditProximoKm] = useState(0);
  const [editProximaData, setEditProximaData] = useState('');
  const [editJustificativa, setEditJustificativa] = useState('');
  const [editFeedback, setEditFeedback] = useState<{ success?: boolean; message: string } | null>(null);

  // Soft Delete Revision State
  const [deletingRevision, setDeletingRevision] = useState<RevisionPlan | null>(null);
  const [deleteJustificativa, setDeleteJustificativa] = useState('');
  const [deleteFeedback, setDeleteFeedback] = useState<{ success?: boolean; message: string } | null>(null);

  // New revision form
  const [newVeiculoId, setNewVeiculoId] = useState(vehicles[0]?.id || '');
  const [newTitulo, setNewTitulo] = useState('');
  const [newItem, setNewItem] = useState<any>('OLEO_FILTRO');
  const [newIntervaloKm, setNewIntervaloKm] = useState(10000);
  const [newIntervaloMeses, setNewIntervaloMeses] = useState(6);

  // Filtered revisions
  const filtered = revisions.filter(r => {
    if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
    if (filterPlaca !== 'ALL' && r.placa !== filterPlaca) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const vehicle = vehicles.find(v => v.placa === r.placa);
      const matchPlaca = r.placa.toLowerCase().includes(q);
      const matchTitulo = r.titulo.toLowerCase().includes(q);
      const matchModelo = vehicle?.modelo?.toLowerCase().includes(q);
      const matchMotorista = vehicle?.motoristaNome?.toLowerCase().includes(q);
      const matchItem = String(r.item).toLowerCase().includes(q);
      if (!matchPlaca && !matchTitulo && !matchModelo && !matchMotorista && !matchItem) {
        return false;
      }
    }
    return true;
  });

  const countVencidos = revisions.filter(r => r.status === 'VENCIDO').length;
  const countProximos = revisions.filter(r => r.status === 'PROXIMO').length;
  const countEmDia = revisions.filter(r => r.status === 'EM_DIA').length;

  const handleSendChatwootRevision = async (rev: RevisionPlan) => {
    setSendingChatwootId(rev.id);
    const vehicle = vehicles.find(v => v.placa === rev.placa);
    const motorista = vehicle?.motoristaNome ? `Olá, ${vehicle.motoristaNome}!` : 'Atenção, Operador de Frota!';
    const kmReal = vehicle?.odometroEstimado ?? vehicle?.odometroAtual ?? 0;

    const msg = `⚠️ *ALERTA DE REVISÃO PREVENTIVA - FLEET TELECOM PA*
${motorista}

🚗 *Veículo:* ${vehicle?.modelo || 'Veículo'} (Placa: ${rev.placa})
⏱️ *Odômetro Estimado:* ${kmReal.toLocaleString()} km
🔧 *Item de Manutenção:* ${rev.titulo}
🎯 *Limite Programado:* ${rev.proximoKm.toLocaleString()} km (Data estimada: ${rev.proximaData.split('-').reverse().join('/')})

${
  rev.status === 'VENCIDO'
    ? `🚨 *ATENÇÃO: MANUTENÇÃO VENCIDA HÁ ${Math.abs(rev.kmRestantes).toLocaleString()} KM!* Agende imediatamente a entrada na oficina credenciada para evitar quebra mecânica e perda de garantia.`
    : `🗓️ *STATUS:* Faltam apenas *${rev.kmRestantes.toLocaleString()} km* para a revisão. Planeje a parada preventiva nos próximos dias.`
}

📍 Base Operacional Pará: Central de Apoio Fleet Telecom`;

    const success = await onSendChatwootAlert(msg, rev.placa);
    setSendingChatwootId(null);
    if (success) {
      setSentSuccessId(rev.id);
      setTimeout(() => setSentSuccessId(null), 4000);
    }
  };

  const handleCreateRevision = (e: React.FormEvent) => {
    e.preventDefault();
    const vehicle = vehicles.find(v => v.id === newVeiculoId);
    if (!vehicle) return;

    const kmBase = vehicle.odometroEstimado ?? vehicle.odometroAtual;
    const proximoKm = kmBase + Number(newIntervaloKm);
    const proximaData = new Date(Date.now() + newIntervaloMeses * 30 * 86400000)
      .toISOString()
      .split('T')[0];

    const { kmRestantes, status } = calculateRevisionStatus(proximoKm, kmBase, proximaData);

    const newRev: RevisionPlan = {
      id: 'rev-' + Date.now(),
      veiculoId: vehicle.id,
      placa: vehicle.placa,
      titulo: newTitulo || `Revisão de ${newItem.replace('_', ' ')}`,
      item: newItem,
      intervaloKm: Number(newIntervaloKm),
      intervaloMeses: Number(newIntervaloMeses),
      ultimoKmRealizado: kmBase,
      ultimaDataRealizada: new Date().toISOString().split('T')[0],
      proximoKm,
      proximaData,
      kmRestantes,
      status,
      prioridade: status === 'VENCIDO' ? 'CRITICA' : status === 'PROXIMO' ? 'ALTA' : 'MEDIA',
      createdAt: new Date().toISOString(),
      criadoPorId: activeUser.id,
      criadoPorNome: activeUser.nome,
      criadoPorCargo: activeUser.cargo,
      ativo: true,
      excluido: false,
    };

    const currentList = storage.getRevisions();
    currentList.unshift(newRev);
    storage.saveRevisions(currentList);
    onRevisionsUpdated();
    setShowAddModal(false);
    setNewTitulo('');
  };

  // Open Quick Complete Modal
  const handleStartComplete = (rev: RevisionPlan) => {
    const vehicle = vehicles.find(v => v.placa === rev.placa);
    const kmReal = vehicle?.odometroEstimado ?? vehicle?.odometroAtual ?? rev.proximoKm;
    setCompletingRevision(rev);
    setCompleteKm(kmReal);
    setCompleteData(new Date().toISOString().split('T')[0]);
  };

  // Confirm Quick Complete (Renews revision cycle)
  const handleConfirmComplete = () => {
    if (!completingRevision) return;

    const novoUltimoKm = Number(completeKm);
    const novaUltimaData = completeData;
    const novoProximoKm = novoUltimoKm + completingRevision.intervaloKm;
    const novaProximaData = new Date(
      new Date(novaUltimaData).getTime() + completingRevision.intervaloMeses * 30 * 86400000
    )
      .toISOString()
      .split('T')[0];

    const { kmRestantes, status } = calculateRevisionStatus(novoProximoKm, novoUltimoKm, novaProximaData);

    const updatedObj: RevisionPlan = {
      ...completingRevision,
      ultimoKmRealizado: novoUltimoKm,
      ultimaDataRealizada: novaUltimaData,
      proximoKm: novoProximoKm,
      proximaData: novaProximaData,
      kmRestantes,
      status,
      prioridade: status === 'VENCIDO' ? 'CRITICA' : status === 'PROXIMO' ? 'ALTA' : 'MEDIA',
    };

    storage.updateRevisionWithAudit(
      updatedObj,
      activeUser,
      `Conclusão de ciclo preventivo realizada em ${novaUltimaData.split('-').reverse().join('/')} com odômetro ${novoUltimoKm.toLocaleString()} km.`
    );

    onRevisionsUpdated();
    setCompletingRevision(null);
  };

  // Open Edit Modal
  const handleStartEdit = (rev: RevisionPlan) => {
    setEditingRevision(rev);
    setEditTitulo(rev.titulo);
    setEditItem(rev.item);
    setEditIntervaloKm(rev.intervaloKm);
    setEditIntervaloMeses(rev.intervaloMeses);
    setEditProximoKm(rev.proximoKm);
    setEditProximaData(rev.proximaData);
    setEditJustificativa('');
    setEditFeedback(null);
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRevision) return;

    try {
      const perm = canUserEditOrDeleteRevision(editingRevision, activeUser);
      if (!perm.allowed) {
        setEditFeedback({ success: false, message: perm.reason || 'Sem permissão.' });
        return;
      }

      if (perm.requiresJustification && (!editJustificativa || editJustificativa.trim().length < 5)) {
        setEditFeedback({
          success: false,
          message: 'Justificativa obrigatória para administradores alterando registros antigos (mínimo 5 caracteres).',
        });
        return;
      }

      const vehicle = vehicles.find(v => v.placa === editingRevision.placa);
      const kmBase = vehicle?.odometroEstimado ?? vehicle?.odometroAtual ?? editingRevision.ultimoKmRealizado;
      const { kmRestantes, status } = calculateRevisionStatus(Number(editProximoKm), kmBase, editProximaData);

      const updatedObj: RevisionPlan = {
        ...editingRevision,
        titulo: editTitulo.trim() || editingRevision.titulo,
        item: editItem,
        intervaloKm: Number(editIntervaloKm),
        intervaloMeses: Number(editIntervaloMeses),
        proximoKm: Number(editProximoKm),
        proximaData: editProximaData,
        kmRestantes,
        status,
        prioridade: status === 'VENCIDO' ? 'CRITICA' : status === 'PROXIMO' ? 'ALTA' : 'MEDIA',
      };

      storage.updateRevisionWithAudit(updatedObj, activeUser, editJustificativa.trim());

      try {
        await fetch(`/api/revisions/${editingRevision.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            revision: updatedObj,
            user: activeUser,
            justificativa: editJustificativa.trim(),
          }),
        });
      } catch {
        // Fallback local garantido
      }

      onRevisionsUpdated();
      setEditingRevision(null);
    } catch (err: any) {
      setEditFeedback({ success: false, message: err.message || 'Erro ao salvar alteração.' });
    }
  };

  // Open Delete Modal
  const handleStartDelete = (rev: RevisionPlan) => {
    setDeletingRevision(rev);
    setDeleteJustificativa('');
    setDeleteFeedback(null);
  };

  // Confirm Soft Delete
  const handleConfirmDelete = async () => {
    if (!deletingRevision) return;

    try {
      const perm = canUserEditOrDeleteRevision(deletingRevision, activeUser);
      if (!perm.allowed) {
        setDeleteFeedback({ success: false, message: perm.reason || 'Sem permissão.' });
        return;
      }

      if (perm.requiresJustification && (!deleteJustificativa || deleteJustificativa.trim().length < 5)) {
        setDeleteFeedback({
          success: false,
          message: 'Justificativa obrigatória para exclusão administrativa de registros antigos.',
        });
        return;
      }

      storage.softDeleteRevision(deletingRevision.id, activeUser, deleteJustificativa.trim());

      try {
        await fetch(`/api/revisions/${deletingRevision.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user: activeUser,
            justificativa: deleteJustificativa.trim(),
          }),
        });
      } catch {
        // Fallback local garantido
      }

      onRevisionsUpdated();
      setDeletingRevision(null);
    } catch (err: any) {
      setDeleteFeedback({ success: false, message: err.message || 'Erro ao excluir revisão.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Clear Value Proposition */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-xs">
              <CalendarCheck2 className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-[#0F2744]">
              Plano de Revisões Preventivas da Frota
            </h1>
          </div>
          <p className="text-slate-600 text-xs sm:text-sm mt-1">
            Controle transparente de ciclos preventivos: compare claramente quando foi a <strong>Última Revisão</strong> e quando será a <strong>Próxima Revisão</strong> por odômetro e data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-sm active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Plano de Revisão</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setFilterStatus(filterStatus === 'VENCIDO' ? 'ALL' : 'VENCIDO')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            countVencidos > 0
              ? 'bg-red-50/70 border-red-300 hover:border-red-400 ring-1 ring-red-200'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-700 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              Revisões Vencidas
            </span>
            <span className="text-2xl font-extrabold text-red-700 font-mono">
              {countVencidos}
            </span>
          </div>
          <p className="text-[11px] text-red-600/80 mt-1 font-medium">
            Excederam o odômetro limite ou prazo previsto
          </p>
        </div>

        <div
          onClick={() => setFilterStatus(filterStatus === 'PROXIMO' ? 'ALL' : 'PROXIMO')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            countProximos > 0
              ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400 ring-1 ring-amber-200'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              Próximas (&lt; 1.500 km ou 15 dias)
            </span>
            <span className="text-2xl font-extrabold text-amber-800 font-mono">
              {countProximos}
            </span>
          </div>
          <p className="text-[11px] text-amber-700/80 mt-1 font-medium">
            Programar parada na oficina com o condutor
          </p>
        </div>

        <div
          onClick={() => setFilterStatus(filterStatus === 'EM_DIA' ? 'ALL' : 'EM_DIA')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            countEmDia > 0
              ? 'bg-emerald-50/70 border-emerald-300 hover:border-emerald-400'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Em Conformidade
            </span>
            <span className="text-2xl font-extrabold text-emerald-800 font-mono">
              {countEmDia}
            </span>
          </div>
          <p className="text-[11px] text-emerald-700/80 mt-1 font-medium">
            Ciclo preventivo em dia com ampla margem
          </p>
        </div>
      </div>

      {/* Control Bar: Search + Filters + View Mode Toggle (Table List vs Cards) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Left: View Mode Toggle & Status Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Toggle View Mode Buttons */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-sky-800 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Exibir em formato de lista / tabela detalhada"
            >
              <LayoutList className="w-3.5 h-3.5 text-sky-600" />
              <span>Lista</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs transition-all ${
                viewMode === 'cards'
                  ? 'bg-white text-sky-800 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Exibir em formato de cartões / blocos"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-sky-600" />
              <span>Cartões</span>
            </button>
          </div>

          {/* Status filter buttons */}
          <div className="flex items-center gap-1">
            {['ALL', 'VENCIDO', 'PROXIMO', 'EM_DIA'].map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  filterStatus === st
                    ? 'bg-[#0F2744] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st === 'ALL'
                  ? 'Todos'
                  : st === 'VENCIDO'
                  ? 'Vencidos'
                  : st === 'PROXIMO'
                  ? 'Próximos'
                  : 'Em Dia'}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Search box & Vehicle Filter */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar placa, serviço..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Vehicle Select */}
          <select
            value={filterPlaca}
            onChange={e => setFilterPlaca(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:outline-none bg-white text-xs"
          >
            <option value="ALL">Toda a Frota ({vehicles.length})</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.placa}>
                {v.placa} - {v.modelo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main View: TABLE (LISTA) or CARDS (BLOQUINHOS) */}
      {viewMode === 'table' ? (
        /* ======================== TABULAR LIST VIEW ======================== */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
                  <th className="py-3.5 px-4 min-w-[150px]">Veículo / Placa</th>
                  <th className="py-3.5 px-4 min-w-[220px]">Serviço &amp; Categoria</th>
                  <th className="py-3.5 px-4 min-w-[170px] bg-slate-100/60">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <History className="w-3.5 h-3.5 text-slate-500" />
                      <span>Última Revisão</span>
                    </div>
                  </th>
                  <th className="py-3.5 px-4 min-w-[190px] bg-sky-50/50">
                    <div className="flex items-center gap-1.5 text-sky-900 font-extrabold">
                      <CalendarCheck2 className="w-3.5 h-3.5 text-sky-700" />
                      <span>Próxima Revisão</span>
                    </div>
                  </th>
                  <th className="py-3.5 px-4 min-w-[160px]">Status &amp; Saldo</th>
                  <th className="py-3.5 px-4 text-right min-w-[160px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(rev => {
                  const vehicle = vehicles.find(v => v.placa === rev.placa);
                  const kmAtual = vehicle?.odometroEstimado ?? vehicle?.odometroAtual ?? rev.ultimoKmRealizado;
                  const totalCiclo = rev.proximoKm - rev.ultimoKmRealizado;
                  const rodadoNoCiclo = kmAtual - rev.ultimoKmRealizado;
                  const percentualUso = totalCiclo > 0 ? Math.min(100, Math.max(0, (rodadoNoCiclo / totalCiclo) * 100)) : 100;

                  const isOverdue = rev.status === 'VENCIDO';
                  const isWarning = rev.status === 'PROXIMO';
                  const serviceMeta = getServiceTypeMeta(rev.item, rev.titulo);
                  const ServiceIcon = serviceMeta.icon;

                  // Dias restantes
                  const hoje = new Date();
                  hoje.setHours(0, 0, 0, 0);
                  const dataPrev = new Date(rev.proximaData + 'T00:00:00');
                  const diffDias = Math.round((dataPrev.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

                  return (
                    <tr
                      key={rev.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isOverdue
                          ? 'bg-red-50/30'
                          : isWarning
                          ? 'bg-amber-50/20'
                          : ''
                      }`}
                    >
                      {/* Veículo & Placa */}
                      <td className="py-3 px-4 align-middle">
                        <div className="space-y-1">
                          <LicensePlateBadge placa={rev.placa} size="sm" />
                          <div className="text-[11px] font-semibold text-slate-800 leading-tight">
                            {vehicle?.modelo || 'Veículo'}
                          </div>
                          {vehicle?.motoristaNome && (
                            <div className="text-[10px] text-slate-500 truncate max-w-[130px]">
                              {vehicle.motoristaNome}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-600 font-mono font-medium flex items-center gap-1">
                            <Gauge className="w-3 h-3 text-slate-400" />
                            <span>Odôm: {kmAtual.toLocaleString()} km</span>
                          </div>
                        </div>
                      </td>

                      {/* Serviço & Categoria */}
                      <td className="py-3 px-4 align-middle">
                        <div className="space-y-1.5">
                          {/* Service Category Tag with Icon */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${serviceMeta.colorBadge}`}
                            >
                              <ServiceIcon className="w-3 h-3 shrink-0" />
                              <span>{serviceMeta.label}</span>
                            </span>
                            <span className="text-[10px] text-slate-400">
                              (a cada {rev.intervaloKm.toLocaleString()} km / {rev.intervaloMeses}m)
                            </span>
                          </div>

                          <div className="font-bold text-slate-900 text-xs leading-snug">
                            {rev.titulo}
                          </div>

                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{rev.criadoPorNome?.split(' ')[0] || 'Sistema'}</span>
                            {isCreatedTodayInBelem(rev.createdAt) ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1 rounded">
                                Hoje
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Última Revisão (Fundo Neutro) */}
                      <td className="py-3 px-4 align-middle bg-slate-50/50">
                        <div className="p-2 rounded-lg bg-white border border-slate-200/80 space-y-1 text-slate-800">
                          <div className="flex items-center gap-1 text-[11px] font-bold">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{rev.ultimaDataRealizada.split('-').reverse().join('/')}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-slate-700">
                            <Gauge className="w-3 h-3 text-slate-400" />
                            <span>{rev.ultimoKmRealizado.toLocaleString()} km</span>
                          </div>
                          <div className="text-[10px] text-slate-500 pt-0.5 border-t border-slate-100">
                            +{rodadoNoCiclo > 0 ? rodadoNoCiclo.toLocaleString() : 0} km rodados
                          </div>
                        </div>
                      </td>

                      {/* Próxima Revisão (Destaque Sky/Alert) */}
                      <td className="py-3 px-4 align-middle bg-sky-50/30">
                        <div
                          className={`p-2 rounded-lg border space-y-1.5 ${
                            isOverdue
                              ? 'bg-red-50/80 border-red-200 text-red-900'
                              : isWarning
                              ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                              : 'bg-white border-sky-200 text-sky-900'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 text-xs font-black font-mono">
                            <span className="flex items-center gap-1">
                              <CalendarCheck2 className="w-3 h-3 text-sky-600" />
                              <span>{rev.proximoKm.toLocaleString()} km</span>
                            </span>
                          </div>

                          <div className="text-[11px] font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Data: {rev.proximaData.split('-').reverse().join('/')}</span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isOverdue ? 'bg-red-600' : isWarning ? 'bg-amber-500' : 'bg-sky-600'
                              }`}
                              style={{ width: `${percentualUso}%` }}
                            />
                          </div>
                          <div className="text-[9px] text-slate-500 text-right">
                            {percentualUso.toFixed(0)}% do ciclo
                          </div>
                        </div>
                      </td>

                      {/* Status & Saldo */}
                      <td className="py-3 px-4 align-middle">
                        <div className="space-y-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              isOverdue
                                ? 'bg-red-500 text-white shadow-xs'
                                : isWarning
                                ? 'bg-amber-500 text-white'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {isOverdue && <AlertTriangle className="w-3 h-3 animate-pulse" />}
                            {isWarning && <Clock className="w-3 h-3" />}
                            {rev.status.replace('_', ' ')}
                          </span>

                          <div
                            className={`text-xs font-bold ${
                              isOverdue
                                ? 'text-red-700'
                                : isWarning
                                ? 'text-amber-800'
                                : 'text-emerald-700'
                            }`}
                          >
                            {rev.kmRestantes < 0
                              ? `Vencido há ${Math.abs(rev.kmRestantes).toLocaleString()} km`
                              : `Faltam ${rev.kmRestantes.toLocaleString()} km`}
                          </div>

                          <div className="text-[10px] text-slate-500">
                            {diffDias < 0
                              ? `Venceu há ${Math.abs(diffDias)} dias`
                              : diffDias === 0
                              ? 'Vence hoje'
                              : `Restam ${diffDias} dias`}
                          </div>
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 align-middle text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          {/* Registrar Realização Rápida */}
                          <button
                            onClick={() => handleStartComplete(rev)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1 transition-colors whitespace-nowrap shadow-xs"
                            title="Registrar que esta revisão foi realizada e atualizar o ciclo preventivo"
                          >
                            <CheckSquare className="w-3 h-3 text-emerald-600" />
                            <span>Realizado</span>
                          </button>

                          {/* Notificar Chatwoot */}
                          <button
                            onClick={() => handleSendChatwootRevision(rev)}
                            disabled={sendingChatwootId === rev.id || sentSuccessId === rev.id}
                            className={`text-[11px] px-2 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors border shadow-xs whitespace-nowrap ${
                              sentSuccessId === rev.id
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : isOverdue
                                ? 'bg-red-600 hover:bg-red-700 text-white border-transparent'
                                : 'bg-white hover:bg-sky-50 text-slate-700 border-slate-300'
                            }`}
                            title="Disparar aviso ao condutor no WhatsApp via Chatwoot"
                          >
                            {sentSuccessId === rev.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Notificado</span>
                              </>
                            ) : sendingChatwootId === rev.id ? (
                              <span>Enviando...</span>
                            ) : (
                              <>
                                <Send className="w-3 h-3 text-cyan-500" />
                                <span>Avisar</span>
                              </>
                            )}
                          </button>

                          {/* Botões secundários: Editar e Excluir */}
                          <div className="flex items-center gap-1 pt-0.5">
                            <button
                              onClick={() => handleStartEdit(rev)}
                              title="Editar Plano de Revisão"
                              className="p-1 rounded text-slate-500 hover:text-sky-700 hover:bg-slate-100 transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleStartDelete(rev)}
                              title="Excluir Plano (Lógico)"
                              className="p-1 rounded text-slate-500 hover:text-red-600 hover:bg-slate-100 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ======================== CARDS (GRID) VIEW ======================== */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(rev => {
            const vehicle = vehicles.find(v => v.placa === rev.placa);
            const kmAtual = vehicle?.odometroEstimado ?? vehicle?.odometroAtual ?? rev.ultimoKmRealizado;
            const totalCiclo = rev.proximoKm - rev.ultimoKmRealizado;
            const rodadoNoCiclo = kmAtual - rev.ultimoKmRealizado;
            const percentualUso = totalCiclo > 0 ? Math.min(100, Math.max(0, (rodadoNoCiclo / totalCiclo) * 100)) : 100;

            const isOverdue = rev.status === 'VENCIDO';
            const isWarning = rev.status === 'PROXIMO';
            const serviceMeta = getServiceTypeMeta(rev.item, rev.titulo);
            const ServiceIcon = serviceMeta.icon;

            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const dataPrev = new Date(rev.proximaData + 'T00:00:00');
            const diffDias = Math.round((dataPrev.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

            return (
              <div
                key={rev.id}
                className={`bg-white rounded-xl border p-5 shadow-sm space-y-4 transition-all hover:shadow-md ${
                  isOverdue
                    ? 'border-red-300 bg-red-50/20 ring-1 ring-red-200'
                    : isWarning
                    ? 'border-amber-300 bg-amber-50/10'
                    : 'border-slate-200'
                }`}
              >
                {/* Header with Plate & Category Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <LicensePlateBadge placa={rev.placa} size="md" />
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${serviceMeta.colorBadge}`}
                        >
                          <ServiceIcon className="w-3 h-3 shrink-0" />
                          <span>{serviceMeta.label}</span>
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm mt-1">{rev.titulo}</h3>
                      <p className="text-xs text-slate-500 font-medium">
                        {vehicle?.modelo} {vehicle?.motoristaNome ? `• ${vehicle.motoristaNome}` : ''}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      isOverdue
                        ? 'bg-red-500 text-white'
                        : isWarning
                        ? 'bg-amber-500 text-white'
                        : 'bg-emerald-500 text-white'
                    }`}
                  >
                    {isOverdue && <AlertTriangle className="w-3 h-3 animate-pulse" />}
                    {rev.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Progress Bar & Current Odometer */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <span>Odômetro Atual:</span>
                      <strong className="text-slate-900 font-mono font-black">{kmAtual.toLocaleString()} km</strong>
                      {vehicle?.odometroRastreador ? (
                        <span className="text-[10px] text-slate-400 font-normal">
                          (GPS: {vehicle.odometroRastreador.toLocaleString()} km)
                        </span>
                      ) : null}
                    </span>
                    <span>
                      Meta: <strong className="text-sky-800 font-mono">{rev.proximoKm.toLocaleString()} km</strong>
                    </span>
                  </div>

                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOverdue
                          ? 'bg-red-600'
                          : isWarning
                          ? 'bg-amber-500'
                          : 'bg-sky-600'
                      }`}
                      style={{ width: `${percentualUso}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>{percentualUso.toFixed(0)}% do ciclo percorrido</span>
                    <span className={isOverdue ? 'font-bold text-red-600' : isWarning ? 'font-bold text-amber-700' : 'text-slate-600'}>
                      {rev.kmRestantes < 0
                        ? `Vencido há ${Math.abs(rev.kmRestantes).toLocaleString()} km`
                        : `Restam ${rev.kmRestantes.toLocaleString()} km`}
                    </span>
                  </div>
                </div>

                {/* Clear Side-by-Side Comparison: Última Revisão vs Próxima Revisão */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {/* Bloco Última Revisão */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <History className="w-3 h-3 text-slate-400" />
                      Última Revisão
                    </span>
                    <div className="font-bold text-slate-800 text-sm">
                      {rev.ultimaDataRealizada.split('-').reverse().join('/')}
                    </div>
                    <div className="text-slate-600 font-mono font-semibold text-xs">
                      {rev.ultimoKmRealizado.toLocaleString()} km
                    </div>
                    <div className="text-[10px] text-slate-400">
                      +{rodadoNoCiclo > 0 ? rodadoNoCiclo.toLocaleString() : 0} km rodados
                    </div>
                  </div>

                  {/* Bloco Próxima Revisão */}
                  <div
                    className={`p-3 rounded-lg border space-y-1 ${
                      isOverdue
                        ? 'bg-red-50 border-red-200'
                        : isWarning
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-sky-50 border-sky-200'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider flex items-center gap-1">
                      <CalendarCheck2 className="w-3 h-3 text-sky-600" />
                      Próxima Revisão
                    </span>
                    <div className="font-extrabold text-slate-900 text-sm font-mono">
                      {rev.proximoKm.toLocaleString()} km
                    </div>
                    <div className="text-xs font-semibold text-slate-700">
                      Prev: {rev.proximaData.split('-').reverse().join('/')}
                    </div>
                    <div className={`text-[10px] font-bold ${isOverdue ? 'text-red-700' : isWarning ? 'text-amber-800' : 'text-emerald-700'}`}>
                      {diffDias < 0 ? `Venceu há ${Math.abs(diffDias)} dias` : `Restam ${diffDias} dias`}
                    </div>
                  </div>
                </div>

                {/* Dispatch & Completion Actions */}
                <div className="flex items-center justify-between pt-1 gap-2">
                  <button
                    onClick={() => handleStartComplete(rev)}
                    className="text-xs px-3 py-1.5 rounded-lg font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 transition-colors"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Concluir Revisão</span>
                  </button>

                  <button
                    onClick={() => handleSendChatwootRevision(rev)}
                    disabled={sendingChatwootId === rev.id || sentSuccessId === rev.id}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors border shadow-xs ${
                      sentSuccessId === rev.id
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : isOverdue
                        ? 'bg-red-600 hover:bg-red-700 text-white border-transparent'
                        : 'bg-white hover:bg-sky-50 text-slate-700 border-slate-300'
                    }`}
                  >
                    {sentSuccessId === rev.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Notificado</span>
                      </>
                    ) : sendingChatwootId === rev.id ? (
                      <span>Enviando...</span>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 text-cyan-500" />
                        <span>Notificar WhatsApp</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Revision Author & Management */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {rev.criadoPorNome || 'Sistema'}
                    </span>
                    {isCreatedTodayInBelem(rev.createdAt) ? (
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded">
                        Hoje (Belém)
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleStartEdit(rev)}
                      title="Editar Plano de Revisão"
                      className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-800 border border-slate-200 transition-colors flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3 text-sky-600" />
                      <span>Editar</span>
                    </button>

                    <button
                      onClick={() => handleStartDelete(rev)}
                      title="Excluir Plano de Revisão (Exclusão Lógica)"
                      className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3 text-red-600" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto">
            <Wrench className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Nenhum plano de revisão encontrado</h3>
            <p className="text-slate-500 text-xs max-w-md mx-auto mt-1">
              Nenhum item corresponde aos filtros selecionados. Limpe a busca ou cadastre um novo plano no botão superior.
            </p>
          </div>
        </div>
      )}

      {/* Modal Quick Complete Revision */}
      {completingRevision && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F2744] text-base">
                    Registrar Realização de Revisão
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Veículo: {completingRevision.placa} • {completingRevision.titulo}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setCompletingRevision(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border text-xs text-slate-700 space-y-1">
              <p>
                Ao confirmar, a data e o odômetro registrados serão gravados como a nova <strong>Última Revisão</strong> e a <strong>Próxima Revisão</strong> será reprogramada para:
              </p>
              <div className="font-mono font-bold text-sky-900 pt-1">
                + {completingRevision.intervaloKm.toLocaleString()} km (Meta: {(Number(completeKm) + completingRevision.intervaloKm).toLocaleString()} km)
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Odômetro na Realização (KM):</label>
                <input
                  type="number"
                  value={completeKm}
                  onChange={e => setCompleteKm(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Data da Realização:</label>
                <input
                  type="date"
                  value={completeData}
                  onChange={e => setCompleteData(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setCompletingRevision(null)}
                className="px-4 py-2 border rounded-lg text-slate-600 font-semibold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmComplete}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirmar &amp; Renovar Ciclo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Revision */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-[#0F2744] text-base">
                Novo Plano de Revisão Preventiva
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRevision} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Veículo da Frota:</label>
                <select
                  value={newVeiculoId}
                  onChange={e => setNewVeiculoId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                >
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.placa} - {v.modelo} ({v.odometroAtual.toLocaleString()} km)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Item / Componente:</label>
                <select
                  value={newItem}
                  onChange={e => setNewItem(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                >
                  <option value="OLEO_FILTRO">Troca de Óleo &amp; Filtros</option>
                  <option value="PASTILHAS_FREIO">Pastilhas &amp; Fluido de Freio</option>
                  <option value="CORREIA_DENTADA">Correia Dentada / Tensores</option>
                  <option value="PNEUS">Pneus, Alinhamento &amp; Rodízio</option>
                  <option value="FILTRO_AR_COMBUSTIVEL">Filtro de Ar e Combustível</option>
                  <option value="SISTEMA_ARREFECIMENTO">Arrefecimento &amp; Radiador</option>
                  <option value="SUSPENSAO">Suspensão &amp; Amortecedores</option>
                  <option value="ELETRICA_BATERIA">Elétrica &amp; Bateria</option>
                  <option value="REVISAO_GERAL">Revisão Geral Periódica</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Título Personalizado:</label>
                <input
                  type="text"
                  value={newTitulo}
                  onChange={e => setNewTitulo(e.target.value)}
                  placeholder="Ex: Troca de Óleo 10.000 km Sintético"
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Intervalo em KM:</label>
                  <input
                    type="number"
                    value={newIntervaloKm}
                    onChange={e => setNewIntervaloKm(Number(e.target.value))}
                    step={1000}
                    min={1000}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Intervalo em Meses:</label>
                  <input
                    type="number"
                    value={newIntervaloMeses}
                    onChange={e => setNewIntervaloMeses(Number(e.target.value))}
                    min={1}
                    max={60}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0F2744] hover:bg-[#1E3A5F] text-white rounded-lg font-semibold"
                >
                  Cadastrar Revisão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Revisão */}
      {editingRevision && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-bold">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F2744] text-base">
                    Editar Plano de Revisão Preventiva
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Placa: {editingRevision.placa} • ID: {editingRevision.id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setEditingRevision(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Permission Banner */}
            {(() => {
              const perm = canUserEditOrDeleteRevision(editingRevision, activeUser);
              const isToday = isCreatedTodayInBelem(editingRevision.createdAt);
              if (!perm.allowed) {
                return (
                  <div className="bg-red-50 border border-red-300 text-red-800 p-3 rounded-lg text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Alteração Bloqueada por Regra de Negócio</span>
                    </div>
                    <p>{perm.reason}</p>
                    <p className="text-[11px] text-red-600">
                      Usuário Atual: <strong>{activeUser.nome}</strong> ({activeUser.cargo})
                    </p>
                  </div>
                );
              }
              if (perm.requiresJustification) {
                return (
                  <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-lg text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Info className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>Permissão Administrativa Requerida</span>
                    </div>
                    <p>
                      Este registro foi criado em data anterior à de hoje no fuso <strong>America/Belem</strong>. Como Administrador (Gestor), informe obrigatoriamente a justificativa para registrar a trilha de auditoria.
                    </p>
                  </div>
                );
              }
              return (
                <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-2.5 rounded-lg text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Autor no mesmo dia do lançamento ({isToday ? 'Hoje' : 'Fuso Belém'}). Alteração permitida.
                  </span>
                </div>
              );
            })()}

            {editFeedback && (
              <div
                className={`p-3 rounded-lg text-xs font-semibold ${
                  editFeedback.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                    : 'bg-red-50 text-red-800 border border-red-300'
                }`}
              >
                {editFeedback.message}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Título do Plano:</label>
                <input
                  type="text"
                  value={editTitulo}
                  onChange={e => setEditTitulo(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Componente / Item:</label>
                <select
                  value={editItem}
                  onChange={e => setEditItem(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                >
                  <option value="OLEO_FILTRO">Troca de Óleo &amp; Filtros</option>
                  <option value="PASTILHAS_FREIO">Pastilhas e Discos de Freio</option>
                  <option value="CORREIA_DENTADA">Correia Dentada &amp; Tensores</option>
                  <option value="PNEUS">Pneus (Rodízio e Troca)</option>
                  <option value="FILTRO_AR_COMBUSTIVEL">Filtro de Ar &amp; Combustível</option>
                  <option value="SISTEMA_ARREFECIMENTO">Sistema de Arrefecimento &amp; Radiador</option>
                  <option value="SUSPENSAO">Suspensão &amp; Amortecedores</option>
                  <option value="ELETRICA_BATERIA">Elétrica &amp; Bateria</option>
                  <option value="REVISAO_GERAL">Revisão Geral Preventiva</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Intervalo KM:</label>
                  <input
                    type="number"
                    value={editIntervaloKm}
                    onChange={e => setEditIntervaloKm(Number(e.target.value))}
                    step={1000}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Intervalo Meses:</label>
                  <input
                    type="number"
                    value={editIntervaloMeses}
                    onChange={e => setEditIntervaloMeses(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Próxima Meta KM:</label>
                  <input
                    type="number"
                    value={editProximoKm}
                    onChange={e => setEditProximoKm(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono font-bold text-sky-900"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Data Estimada Limite:</label>
                  <input
                    type="date"
                    value={editProximaData}
                    onChange={e => setEditProximaData(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                    required
                  />
                </div>
              </div>

              {/* Justificativa Obrigatória para Administrador em Registros Antigos */}
              {(() => {
                const perm = canUserEditOrDeleteRevision(editingRevision, activeUser);
                if (perm.requiresJustification) {
                  return (
                    <div className="space-y-1 pt-1">
                      <label className="font-bold text-amber-900 flex items-center justify-between">
                        <span>Justificativa da Alteração (Obrigatória):</span>
                        <span className="text-[10px] text-amber-700">Mínimo 5 caracteres</span>
                      </label>
                      <textarea
                        value={editJustificativa}
                        onChange={e => setEditJustificativa(e.target.value)}
                        placeholder="Descreva o motivo técnico ou operacional para retificação deste registro de revisão..."
                        rows={2}
                        className="w-full border border-amber-300 bg-amber-50/40 rounded-lg p-2 text-xs"
                        required
                      />
                    </div>
                  );
                }
                return null;
              })()}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingRevision(null)}
                  className="px-4 py-2 border rounded-lg text-slate-600 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!canUserEditOrDeleteRevision(editingRevision, activeUser).allowed}
                  className="px-4 py-2 bg-[#0F2744] hover:bg-[#1E3A5F] disabled:bg-slate-300 text-white rounded-lg font-semibold flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvar Alterações &amp; Auditar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Exclusão Lógica de Revisão */}
      {deletingRevision && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-red-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-red-950 text-base">
                    Excluir Plano de Revisão
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Operação com Exclusão Lógica &amp; Auditoria
                  </span>
                </div>
              </div>
              <button
                onClick={() => setDeletingRevision(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs text-slate-700 space-y-1">
              <p>
                Veículo: <strong>{deletingRevision.placa}</strong> • Item: <strong>{deletingRevision.titulo}</strong>
              </p>
              <p className="text-[11px] text-slate-500">
                O registro será inativado logicamente no sistema e preservado para auditoria com data/hora e identificação do usuário.
              </p>
            </div>

            {(() => {
              const perm = canUserEditOrDeleteRevision(deletingRevision, activeUser);
              if (!perm.allowed) {
                return (
                  <div className="bg-red-50 border border-red-300 text-red-800 p-3 rounded-lg text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Exclusão Não Permitida</span>
                    </div>
                    <p>{perm.reason}</p>
                  </div>
                );
              }
              if (perm.requiresJustification) {
                return (
                  <div className="space-y-1.5 text-xs">
                    <label className="font-bold text-slate-800 block">
                      Justificativa Obrigatória do Administrador:
                    </label>
                    <textarea
                      value={deleteJustificativa}
                      onChange={e => setDeleteJustificativa(e.target.value)}
                      placeholder="Motivo formal para a exclusão lógica deste plano de revisão..."
                      rows={3}
                      className="w-full border border-amber-300 bg-amber-50/30 rounded-lg p-2 text-xs"
                      required
                    />
                  </div>
                );
              }
              return (
                <p className="text-xs text-slate-600">
                  Você é o autor deste plano e ele foi registrado hoje ({new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Belem' })}). Deseja confirmar a exclusão lógica?
                </p>
              );
            })()}

            {deleteFeedback && (
              <div
                className={`p-2.5 rounded-lg text-xs font-semibold ${
                  deleteFeedback.success
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-red-50 text-red-800 border border-red-300'
                }`}
              >
                {deleteFeedback.message}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setDeletingRevision(null)}
                className="px-4 py-2 border rounded-lg text-slate-600 font-semibold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={!canUserEditOrDeleteRevision(deletingRevision, activeUser).allowed}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirmar Exclusão Lógica</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
