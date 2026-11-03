import React, { useState } from 'react';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Send,
  ExternalLink,
  DollarSign,
  ShieldCheck,
  Check,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  Receipt,
  Info,
  CalendarDays,
} from 'lucide-react';
import { LicenciamentoPA, Vehicle } from '../types';
import { LicensePlateBadge } from './LicensePlateBadge';
import {
  DETRAN_PA_CALENDARIO_2026,
  formatarMensagemChatwootLicenciamento,
} from '../utils/detranPA';
import { storage } from '../services/storage';

interface LicenciamentoPAViewProps {
  vehicles: Vehicle[];
  licensingList: LicenciamentoPA[];
  onLicensingUpdated: () => void;
  onSendChatwootAlert: (message: string, placa: string) => Promise<boolean>;
}

export const LicenciamentoPAView: React.FC<LicenciamentoPAViewProps> = ({
  vehicles,
  licensingList,
  onLicensingUpdated,
  onSendChatwootAlert,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingPlaca, setSendingPlaca] = useState<string | null>(null);
  const [sentSuccessPlaca, setSentSuccessPlaca] = useState<string | null>(null);

  // Baixa / Quitação Modal States
  const [paymentModalPlaca, setPaymentModalPlaca] = useState<string | null>(null);
  const [paymentModalExercicio, setPaymentModalExercicio] = useState<number>(2026);
  const [dataPagamentoInput, setDataPagamentoInput] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [dataBaixaInput, setDataBaixaInput] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [receiptNumber, setReceiptNumber] = useState('');
  const [baixaObservacoes, setBaixaObservacoes] = useState('');

  // View Baixa Details Modal
  const [viewBaixaItem, setViewBaixaItem] = useState<LicenciamentoPA | null>(null);

  // Official Table Filter & View State - Inicia oculto por padrão facilitando a leitura
  const [tableFinalFilter, setTableFinalFilter] = useState<string>('ALL');
  const [showFullScheduleTable, setShowFullScheduleTable] = useState(false);

  // Agenda Modal States
  const [showAgendaModal, setShowAgendaModal] = useState(false);
  const [agendaMonthFilter, setAgendaMonthFilter] = useState<string>('ALL');
  const [agendaStatusFilter, setAgendaStatusFilter] = useState<string>('ALL');
  const [agendaSearch, setAgendaSearch] = useState('');

  // Count summaries
  const totalVeiculos = licensingList.length;
  const countVencidos = licensingList.filter(l => l.status === 'VENCIDO' && !l.pago).length;
  const countVenceBreve = licensingList.filter(l => l.status === 'VENCE_EM_BREVE' && !l.pago).length;
  const countPagos = licensingList.filter(l => l.pago).length;

  const totalIpvaEstimado = licensingList.reduce((acc, curr) => acc + curr.valorIpvaComDesconto, 0);
  const totalTaxasDetran = licensingList.reduce((acc, curr) => acc + curr.valorTaxaDetran, 0);
  const totalDescontoEconomizado = licensingList.reduce((acc, curr) => acc + curr.descontoAplicado, 0);
  const totalGeralFrota = totalIpvaEstimado + totalTaxasDetran;

  // Filtered list
  const filtered = licensingList.filter(l => {
    if (filterStatus === 'PAGO' && !l.pago) return false;
    if (filterStatus === 'PENDENTE' && l.pago) return false;
    if (filterStatus === 'VENCIDO' && (l.status !== 'VENCIDO' || l.pago)) return false;
    if (filterStatus === 'VENCE_EM_BREVE' && (l.status !== 'VENCE_EM_BREVE' || l.pago)) return false;

    if (searchTerm) {
      const matchPlaca = l.placa.toLowerCase().includes(searchTerm.toLowerCase());
      const matchFinal = l.finalDoisDigitos.includes(searchTerm);
      const matchGrupo = (l.grupoFinal || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchPlaca && !matchFinal && !matchGrupo) return false;
    }
    return true;
  });

  // Filtered list for Agenda Modal
  const agendaFiltered = licensingList.filter(l => {
    if (agendaMonthFilter !== 'ALL' && l.mesVencimento !== agendaMonthFilter) return false;
    if (agendaStatusFilter === 'PAGO' && !l.pago) return false;
    if (agendaStatusFilter === 'PENDENTE' && l.pago) return false;
    if (agendaStatusFilter === 'VENCIDO' && (l.status !== 'VENCIDO' || l.pago)) return false;
    if (agendaStatusFilter === 'VENCE_EM_BREVE' && (l.status !== 'VENCE_EM_BREVE' || l.pago)) return false;

    if (agendaSearch) {
      const vehicle = vehicles.find(v => v.placa === l.placa);
      const matchPlaca = l.placa.toLowerCase().includes(agendaSearch.toLowerCase());
      const matchModelo = vehicle?.modelo?.toLowerCase().includes(agendaSearch.toLowerCase());
      const matchDriver = vehicle?.motoristaNome?.toLowerCase().includes(agendaSearch.toLowerCase());
      const matchFinal = l.finalDoisDigitos.includes(agendaSearch);
      if (!matchPlaca && !matchModelo && !matchDriver && !matchFinal) return false;
    }
    return true;
  });

  // Unique months in agenda
  const agendaMonths = Array.from(new Set(licensingList.map(l => l.mesVencimento))).sort();

  // Group agenda items by month
  const agendaByMonth = agendaMonths.reduce((acc, month) => {
    const items = agendaFiltered.filter(l => l.mesVencimento === month);
    if (items.length > 0) {
      acc[month] = items;
    }
    return acc;
  }, {} as Record<string, LicenciamentoPA[]>);

  const handleSendChatwootAlert = async (lic: LicenciamentoPA) => {
    setSendingPlaca(lic.placa);
    const vehicle = vehicles.find(v => v.placa === lic.placa);
    const message = formatarMensagemChatwootLicenciamento(
      lic,
      vehicle?.modelo || 'Veículo da Frota',
      vehicle?.motoristaNome
    );

    const success = await onSendChatwootAlert(message, lic.placa);
    setSendingPlaca(null);
    if (success) {
      setSentSuccessPlaca(lic.placa);
      setTimeout(() => setSentSuccessPlaca(null), 4000);
    }
  };

  const handleOpenBaixaModal = (lic: LicenciamentoPA) => {
    setPaymentModalPlaca(lic.placa);
    setPaymentModalExercicio(lic.exercicio);
    const today = new Date().toISOString().split('T')[0];
    setDataPagamentoInput(lic.dataPagamento || today);
    setDataBaixaInput(lic.dataBaixa || today);
    setReceiptNumber(lic.comprovanteNumero || '');
    setBaixaObservacoes(lic.observacoesBaixa || '');
  };

  const handleConfirmPayment = () => {
    if (!paymentModalPlaca) return;
    storage.updateLicensingPayment(
      paymentModalPlaca,
      true,
      receiptNumber.trim() || undefined,
      dataPagamentoInput,
      dataBaixaInput,
      baixaObservacoes.trim() || undefined,
      paymentModalExercicio
    );
    onLicensingUpdated();
    setPaymentModalPlaca(null);
    setReceiptNumber('');
    setBaixaObservacoes('');
  };

  const handleToggleUnpay = (placa: string, exercicio: number) => {
    if (window.confirm(`Deseja realmente desfazer a baixa e quitação do veículo ${placa} referente ao exercício ${exercicio}?`)) {
      storage.updateLicensingPayment(placa, false, undefined, undefined, undefined, undefined, exercicio);
      onLicensingUpdated();
    }
  };

  // Filter official calendar entries for display
  const calendarDisplayEntries = DETRAN_PA_CALENDARIO_2026.filter(entry => {
    if (tableFinalFilter === 'ALL') return true;
    return entry.finalPlaca === tableFinalFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-700 flex items-center justify-center text-white">
              <FileText className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-[#0F2744]">
              Gestão de Licenciamento &amp; IPVA - DETRAN Pará (PA)
            </h1>
          </div>
          <p className="text-slate-600 text-xs sm:text-sm mt-1">
            Calendário oficial de vencimentos SEFA-PA e DETRAN-PA: escalonado por <strong>Final de Placa</strong> e <strong>Variação das Terminações</strong> (30 faixas oficiais), com controle rigoroso de <strong>Data da Baixa</strong> e <strong>Data do Pagamento</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Main Action: Open Agenda Modal */}
          <button
            type="button"
            onClick={() => setShowAgendaModal(true)}
            className="bg-sky-600 hover:bg-sky-500 active:scale-95 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-sm cursor-pointer"
            title="Abrir agenda interativa de vencimentos da frota"
          >
            <Calendar className="w-4 h-4" />
            <span>Agenda de Vencimentos IPVA</span>
            <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono">
              {totalVeiculos}
            </span>
          </button>

          <a
            href="https://www.detran.pa.gov.br"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-300"
          >
            <span>Portal DETRAN-PA</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <a
            href="https://www.sefa.pa.gov.br"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#0F2744] hover:bg-[#1E3A5F] text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <span>Portal SEFA-PA</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* KPI Financial & Compliance Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setFilterStatus(filterStatus === 'VENCIDO' ? 'ALL' : 'VENCIDO')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            countVencidos > 0 ? 'bg-red-50/70 border-red-300' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-700 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> Vencidos
            </span>
            <span className="text-2xl font-extrabold text-red-700 font-mono">{countVencidos}</span>
          </div>
          <p className="text-[11px] text-red-600/80 mt-1">Risco de multa e apreensão</p>
        </div>

        <div
          onClick={() => setFilterStatus(filterStatus === 'VENCE_EM_BREVE' ? 'ALL' : 'VENCE_EM_BREVE')}
          className="p-4 rounded-xl border bg-amber-50/70 border-amber-300 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-600" /> Vence em 30d
            </span>
            <span className="text-2xl font-extrabold text-amber-800 font-mono">{countVenceBreve}</span>
          </div>
          <p className="text-[11px] text-amber-700/80 mt-1">Aproveitar desconto IPVA Cidadão</p>
        </div>

        <div
          onClick={() => setFilterStatus(filterStatus === 'PAGO' ? 'ALL' : 'PAGO')}
          className="p-4 rounded-xl border bg-emerald-50/70 border-emerald-300 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Baixados / Quitados
            </span>
            <span className="text-2xl font-extrabold text-emerald-800 font-mono">{countPagos}</span>
          </div>
          <p className="text-[11px] text-emerald-700/80 mt-1">Baixa e pagamento registrados</p>
        </div>

        <div className="p-4 rounded-xl border bg-sky-50/70 border-sky-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-900 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-sky-700" /> Total Previsto
            </span>
            <span className="text-sm font-extrabold text-sky-900 font-mono">
              R$ {totalGeralFrota.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <p className="text-[11px] text-sky-800 mt-1">
            Economia Bom Condutor: <strong>R$ {totalDescontoEconomizado.toFixed(0)}</strong>
          </p>
        </div>
      </div>

      {/* Official DETRAN-PA Reference Table Accordion (Matching User Image Exactly) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div
          onClick={() => setShowFullScheduleTable(!showFullScheduleTable)}
          className={`flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
            showFullScheduleTable ? 'border-b border-slate-200' : ''
          }`}
        >
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-sky-600" />
            <div>
              <h3 className="font-bold text-sm text-[#0F2744] flex items-center gap-2">
                <span>CALENDÁRIO DE VENCIMENTOS DO IPVA 2026</span>
                <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded border border-sky-200">
                  SEFA-PA &amp; DETRAN-PA
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Escala oficial completa: 10 Finais de Placa com 3 Variações de Terminações (30 grupos). Clique para {showFullScheduleTable ? 'recolher' : 'expandir'}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1.5 ${
                showFullScheduleTable
                  ? 'bg-slate-100 text-slate-700 border-slate-300'
                  : 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
              }`}
            >
              <span>{showFullScheduleTable ? 'Ocultar Tabela' : 'Visualizar Tabela'}</span>
              {showFullScheduleTable ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </span>
          </div>
        </div>

        {showFullScheduleTable && (
          <div className="p-4 space-y-4">
            {/* Filter by Final de Placa */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-600 text-[11px] uppercase tracking-wider mr-1">
                Filtrar por Final:
              </span>
              <button
                type="button"
                onClick={() => setTableFinalFilter('ALL')}
                className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                  tableFinalFilter === 'ALL'
                    ? 'bg-[#0F2744] text-white shadow-2xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                Todos (30)
              </button>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map(digito => (
                <button
                  key={digito}
                  type="button"
                  onClick={() => setTableFinalFilter(digito)}
                  className={`w-7 h-7 rounded flex items-center justify-center font-bold font-mono transition-all cursor-pointer ${
                    tableFinalFilter === digito
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                  }`}
                >
                  {digito}
                </button>
              ))}
            </div>

            {/* Official Schedule Table Render */}
            <div className="overflow-x-auto rounded-lg border border-slate-300">
              <table className="w-full text-center text-xs">
                <thead>
                  <tr className="bg-slate-800 text-white text-[11px] uppercase tracking-wider">
                    <th rowSpan={2} className="px-3 py-2.5 border-r border-slate-700 font-bold">
                      FINAL DE PLACA
                    </th>
                    <th rowSpan={2} className="px-3 py-2.5 border-r border-slate-700 font-bold">
                      VARIAÇÃO DAS TERMINAÇÕES
                    </th>
                    <th rowSpan={2} className="px-3 py-2.5 border-r border-slate-700 font-bold bg-sky-900/60">
                      DATA DO LICENCIAMENTO 2026
                    </th>
                    <th colSpan={4} className="px-3 py-1.5 font-bold bg-[#0F2744] border-b border-slate-700">
                      ANTECIPAÇÃO 2026
                    </th>
                  </tr>
                  <tr className="bg-slate-700 text-slate-100 text-[10px] uppercase tracking-wider">
                    <th className="px-3 py-2 border-r border-slate-600 bg-emerald-900/40 font-bold">
                      IPVA CIDADÃO <br />
                      <span className="text-[9px] font-normal text-emerald-300">COTA ÚNICA</span>
                    </th>
                    <th className="px-3 py-2 border-r border-slate-600 font-semibold">
                      PARCELAMENTO SEM DESCONTO <br />
                      <span className="text-[9px] font-normal text-slate-300">1ª COTA</span>
                    </th>
                    <th className="px-3 py-2 border-r border-slate-600 font-semibold">
                      2ª COTA
                    </th>
                    <th className="px-3 py-2 font-semibold bg-sky-900/40">
                      3ª COTA
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
                  {calendarDisplayEntries.map((row, idx) => {
                    const isEvenFinal = parseInt(row.finalPlaca, 10) % 2 === 0;
                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-sky-50/60 transition-colors ${
                          isEvenFinal ? 'bg-slate-50/50' : 'bg-white'
                        }`}
                      >
                        <td className="px-3 py-2 font-extrabold font-mono text-sm text-slate-900 border-r border-slate-200">
                          {row.finalPlaca}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-sky-800 bg-sky-50/30 border-r border-slate-200">
                          {row.grupoFinal}
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap bg-sky-50/20">
                          {row.dataExemploLicenciamento}
                        </td>
                        <td className="px-3 py-2 font-bold text-emerald-800 border-r border-slate-200 whitespace-nowrap bg-emerald-50/30">
                          {row.dataExemploCotaUnica}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-700 border-r border-slate-200 whitespace-nowrap">
                          {row.cota1Parcelamento.split('-').slice(1).reverse().join('/')}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-700 border-r border-slate-200 whitespace-nowrap">
                          {row.cota2Parcelamento.split('-').slice(1).reverse().join('/')}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-sky-900 whitespace-nowrap bg-sky-50/40">
                          {row.cota3Parcelamento.split('-').slice(1).reverse().join('/')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom notice matching the official image */}
            <div className="bg-slate-100 p-3 rounded-lg border border-slate-200 text-center text-xs text-slate-700 font-semibold flex items-center justify-center gap-2">
              <span className="text-base">⚓</span>
              <span>Embarcações e Aeronaves Cota Única - Vencimento <strong>30/06/2026</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por placa, final ou grupo (ex: 01-31)..."
            className="w-full bg-transparent focus:outline-none text-slate-800 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          {[
            { id: 'ALL', label: 'Todos' },
            { id: 'VENCIDO', label: 'Vencidos' },
            { id: 'VENCE_EM_BREVE', label: 'Vence em 30d' },
            { id: 'PENDENTE', label: 'Pendentes' },
            { id: 'PAGO', label: 'Baixados / Quitados' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterStatus(f.id)}
              className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                filterStatus === f.id
                  ? 'bg-[#0F2744] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vehicles DETRAN Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Placa / Veículo</th>
                <th className="px-4 py-3 text-center">
                  Final &amp; Terminação
                  <span className="block text-[9px] font-normal text-slate-500 uppercase">Escala SEFA-PA</span>
                </th>
                <th className="px-4 py-3">
                  Licenciamento 2026
                  <span className="block text-[9px] font-normal text-slate-500 uppercase">Data Limite (3ª Cota)</span>
                </th>
                <th className="px-4 py-3">
                  IPVA Cidadão
                  <span className="block text-[9px] font-normal text-slate-500 uppercase">Cota Única (Desconto)</span>
                </th>
                <th className="px-4 py-3">
                  Parcelamento
                  <span className="block text-[9px] font-normal text-slate-500 uppercase">1ª, 2ª e 3ª Cota</span>
                </th>
                <th className="px-4 py-3 text-right">Total Guia</th>
                <th className="px-4 py-3 text-center">Status / Quitação</th>
                <th className="px-4 py-3 text-center">Ações / Baixa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Nenhum veículo encontrado com os filtros informados.
                  </td>
                </tr>
              ) : (
                filtered.map(lic => {
                  const vehicle = vehicles.find(v => v.placa === lic.placa);
                  const isOverdue = lic.status === 'VENCIDO' && !lic.pago;
                  const isNear = lic.status === 'VENCE_EM_BREVE' && !lic.pago;

                  return (
                    <tr
                      key={lic.placa}
                      className={`hover:bg-slate-50 transition-colors ${
                        lic.pago
                          ? 'bg-emerald-50/20'
                          : isOverdue
                          ? 'bg-red-50/30'
                          : isNear
                          ? 'bg-amber-50/20'
                          : ''
                      }`}
                    >
                      {/* Placa & Veiculo */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <LicensePlateBadge placa={lic.placa} size="sm" highlightLastDigits />
                          <div>
                            <div className="font-bold text-slate-900">{vehicle?.modelo}</div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              {vehicle?.categoria} • Ano {vehicle?.ano}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Final Placa & Grupo de Terminações */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-blue-800 bg-blue-100 px-2 py-0.5 rounded font-mono border border-blue-200 text-xs">
                              Final {lic.finalPlaca || lic.finalSimples}
                            </span>
                            <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                              {lic.grupoFinal || `Terminação ${lic.finalDoisDigitos}`}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Dígitos finais: <strong>{lic.finalDoisDigitos}</strong>
                          </span>
                        </div>
                      </td>

                      {/* Data Limite Licenciamento (3ª Cota) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 text-xs">
                          {lic.dataLimiteLicenciamento.split('-').reverse().join('/')}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          Ref: {lic.mesVencimento}
                        </div>
                      </td>

                      {/* IPVA Cidadão Cota Única */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-emerald-800">
                          {lic.dataCotaUnicaDesconto15.split('-').reverse().join('/')}
                        </div>
                        {lic.descontoAplicado > 0 ? (
                          <div className="text-[10px] text-emerald-600 font-semibold">
                            Desc. 15%: -R$ {lic.descontoAplicado.toFixed(2)}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400">Sem desc. multas</div>
                        )}
                      </td>

                      {/* Parcelamento Sem Desconto */}
                      <td className="px-4 py-3 whitespace-nowrap text-[11px]">
                        <div className="font-mono text-slate-700 space-y-0.5">
                          <div>1ª Cota: <strong>{lic.cota1Parcelamento ? lic.cota1Parcelamento.split('-').reverse().join('/') : lic.dataCotaUnicaDesconto15.split('-').reverse().join('/')}</strong></div>
                          <div>2ª Cota: <strong>{lic.cota2Parcelamento ? lic.cota2Parcelamento.split('-').reverse().join('/') : '-'}</strong></div>
                          <div>3ª Cota: <strong>{lic.cota3Parcelamento ? lic.cota3Parcelamento.split('-').reverse().join('/') : lic.dataLimiteLicenciamento.split('-').reverse().join('/')}</strong></div>
                        </div>
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        <div className="text-sm">R$ {lic.valorTotalEstimado.toFixed(2)}</div>
                        <div className="text-[10px] font-normal text-slate-500">
                          IPVA: R$ {lic.valorIpvaComDesconto.toFixed(2)} + Taxa: R$ {lic.valorTaxaDetran.toFixed(2)}
                        </div>
                      </td>

                      {/* Status / Registro de Baixa & Pagamento */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {lic.pago ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full text-[10px] flex items-center gap-1 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Quitado / Baixado
                            </span>
                            <div className="text-[10px] text-slate-600 font-mono text-left bg-emerald-50/50 p-1 rounded border border-emerald-200/60">
                              <div>Pago em: <strong>{lic.dataPagamento ? lic.dataPagamento.split('-').reverse().join('/') : '-'}</strong></div>
                              <div>Baixa em: <strong>{lic.dataBaixa ? lic.dataBaixa.split('-').reverse().join('/') : '-'}</strong></div>
                              {lic.comprovanteNumero && (
                                <div className="text-[9px] text-slate-500 truncate max-w-[120px]" title={lic.comprovanteNumero}>
                                  Aut: {lic.comprovanteNumero}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : isOverdue ? (
                          <span className="bg-red-500 text-white font-bold px-2.5 py-0.5 rounded-full text-[10px] flex items-center justify-center gap-1">
                            <AlertTriangle className="w-3 h-3 animate-pulse" /> Vencido ({Math.abs(lic.diasRestantes)}d)
                          </span>
                        ) : isNear ? (
                          <span className="bg-amber-500 text-white font-bold px-2 py-0.5 rounded-full text-[10px] flex items-center justify-center gap-1">
                            Vence em {lic.diasRestantes}d
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-full text-[10px]">
                            Em Dia ({lic.diasRestantes}d)
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Chatwoot Alert Button */}
                          <button
                            onClick={() => handleSendChatwootAlert(lic)}
                            disabled={sendingPlaca === lic.placa || sentSuccessPlaca === lic.placa}
                            title="Disparar Alerta com demonstrativo no Chatwoot"
                            className={`p-1.5 rounded-md border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                              sentSuccessPlaca === lic.placa
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-white hover:bg-sky-50 text-slate-700 border-slate-300'
                            }`}
                          >
                            {sentSuccessPlaca === lic.placa ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Send className="w-3.5 h-3.5 text-cyan-600" />
                            )}
                            <span className="hidden sm:inline">
                              {sentSuccessPlaca === lic.placa ? 'Enviado' : 'Chatwoot'}
                            </span>
                          </button>

                          {/* Quitar / Baixa ou Detalhes */}
                          {lic.pago ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setViewBaixaItem(lic)}
                                className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-1 rounded cursor-pointer"
                                title="Visualizar recibo e dados da baixa"
                              >
                                Detalhes
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleUnpay(lic.placa, lic.exercicio)}
                                className="text-[10px] text-slate-400 hover:text-red-600 underline px-1 cursor-pointer"
                                title="Desfazer a baixa do exercício"
                              >
                                Desfazer
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenBaixaModal(lic)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-xs flex items-center gap-1 cursor-pointer"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>Dar Baixa</span>
                            </button>
                          )}
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

      {/* MODAL DE BAIXA DO DOCUMENTO (DATA DA BAIXA + DATA DO PAGAMENTO) */}
      {paymentModalPlaca && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F2744] text-base">
                    Registrar Baixa do Documento
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Licenciamento &amp; IPVA - DETRAN-PA
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPaymentModalPlaca(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Vehicle Card Header in Modal */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">
                  Veículo • Exercício {paymentModalExercicio}
                </span>
                <span className="font-bold text-slate-900 text-xs">
                  {vehicles.find(v => v.placa === paymentModalPlaca)?.modelo || 'Veículo da Frota'}
                </span>
              </div>
              <LicensePlateBadge placa={paymentModalPlaca} size="sm" />
            </div>

            <div className="space-y-3 text-xs">
              {/* Field 1: Data da Baixa */}
              <div>
                <label className="font-bold text-slate-700 flex items-center gap-1 mb-1">
                  <CalendarDays className="w-3.5 h-3.5 text-sky-600" />
                  <span>Data da Baixa (Registro no Sistema):</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={dataBaixaInput}
                  onChange={e => setDataBaixaInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Data em que a gestão deu a baixa no documento interno da empresa.
                </span>
              </div>

              {/* Field 2: Data do Pagamento */}
              <div>
                <label className="font-bold text-slate-700 flex items-center gap-1 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Data do Pagamento Efetivo:</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={dataPagamentoInput}
                  onChange={e => setDataPagamentoInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Data em que o comprovante bancário ou DAE/DUA foi pago (Banco/SEFA-PA).
                </span>
              </div>

              {/* Field 3: Número do Comprovante */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Número do Comprovante / Autenticação Bancária:
                </label>
                <input
                  type="text"
                  value={receiptNumber}
                  onChange={e => setReceiptNumber(e.target.value)}
                  placeholder="Ex: BANPARÁ-84920192 ou PIX-920148..."
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              {/* Field 4: Observações da Baixa */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Observações da Baixa (Opcional):
                </label>
                <textarea
                  rows={2}
                  value={baixaObservacoes}
                  onChange={e => setBaixaObservacoes(e.target.value)}
                  placeholder="Ex: Quitado em Cota Única com 15% de desconto de Bom Condutor..."
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setPaymentModalPlaca(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar Baixa do Documento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW DETALHES DA BAIXA MODAL */}
      {viewBaixaItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F2744] text-base">
                    Comprovante de Baixa do Documento
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Licenciamento &amp; IPVA {viewBaixaItem.exercicio} - DETRAN-PA
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewBaixaItem(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
                <span className="text-slate-600">Veículo:</span>
                <span className="font-bold text-slate-900">
                  {vehicles.find(v => v.placa === viewBaixaItem.placa)?.modelo || viewBaixaItem.placa}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
                <span className="text-slate-600">Placa / Final:</span>
                <div className="flex items-center gap-2">
                  <LicensePlateBadge placa={viewBaixaItem.placa} size="sm" />
                  <span className="font-mono font-bold text-sky-800">
                    {viewBaixaItem.grupoFinal || `Final ${viewBaixaItem.finalDoisDigitos}`}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
                <span className="text-slate-600 font-bold">Data do Pagamento:</span>
                <span className="font-mono font-extrabold text-emerald-800 text-sm">
                  {viewBaixaItem.dataPagamento ? viewBaixaItem.dataPagamento.split('-').reverse().join('/') : '-'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
                <span className="text-slate-600 font-bold">Data da Baixa no Sistema:</span>
                <span className="font-mono font-extrabold text-sky-900 text-sm">
                  {viewBaixaItem.dataBaixa ? viewBaixaItem.dataBaixa.split('-').reverse().join('/') : '-'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
                <span className="text-slate-600">Valor Total Quitado:</span>
                <span className="font-mono font-extrabold text-slate-900">
                  R$ {viewBaixaItem.valorTotalEstimado.toFixed(2)}
                </span>
              </div>

              {viewBaixaItem.comprovanteNumero && (
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
                  <span className="text-slate-600">Autenticação Bancária:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {viewBaixaItem.comprovanteNumero}
                  </span>
                </div>
              )}

              {viewBaixaItem.observacoesBaixa && (
                <div>
                  <span className="text-slate-600 block mb-0.5">Observações:</span>
                  <p className="bg-white p-2 rounded border border-emerald-200 text-slate-800 text-[11px]">
                    {viewBaixaItem.observacoesBaixa}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const placa = viewBaixaItem.placa;
                  setViewBaixaItem(null);
                  handleOpenBaixaModal(viewBaixaItem);
                }}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Editar Baixa
              </button>
              <button
                type="button"
                onClick={() => setViewBaixaItem(null)}
                className="px-4 py-1.5 bg-[#0F2744] hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AGENDA MODAL DE VENCIMENTOS DO IPVA (DETRAN-PA) */}
      {showAgendaModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-[#0F2744] text-white p-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold tracking-tight">
                      Agenda de Vencimentos do IPVA &amp; Licenciamento Anual
                    </h2>
                    <span className="text-[10px] font-extrabold uppercase bg-sky-500/20 text-sky-200 border border-sky-400/30 px-2 py-0.5 rounded-full">
                      DETRAN-PA
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Cronograma completo por Final de Placa e Variação de Terminações com registro de Baixa e Pagamento.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAgendaModal(false)}
                className="text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-colors cursor-pointer"
                title="Fechar agenda"
              >
                ✕
              </button>
            </div>

            {/* Modal KPI Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-4 bg-slate-50 border-b border-slate-200 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Veículos na Agenda</span>
                <span className="text-lg font-bold text-slate-800 font-mono">{licensingList.length}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-amber-200">
                <span className="text-[10px] text-amber-700 font-semibold block">Vence em 30 Dias</span>
                <span className="text-lg font-bold text-amber-700 font-mono">{countVenceBreve}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-red-200">
                <span className="text-[10px] text-red-700 font-semibold block">Vencidos</span>
                <span className="text-lg font-bold text-red-700 font-mono">{countVencidos}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                <span className="text-[10px] text-emerald-700 font-semibold block">Baixados / Quitados</span>
                <span className="text-lg font-bold text-emerald-700 font-mono">{countPagos}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-sky-200 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-sky-800 font-semibold block">Total a Pagar</span>
                <span className="text-sm font-bold text-sky-900 font-mono">
                  R$ {totalGeralFrota.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            {/* Filter Toolbar inside Modal */}
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs bg-white">
              {/* Search */}
              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={agendaSearch}
                  onChange={e => setAgendaSearch(e.target.value)}
                  placeholder="Buscar na agenda (placa, modelo, motorista)..."
                  className="w-full bg-transparent focus:outline-none text-slate-800 text-xs font-medium"
                />
              </div>

              {/* Month Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Mês:</span>
                <button
                  type="button"
                  onClick={() => setAgendaMonthFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    agendaMonthFilter === 'ALL'
                      ? 'bg-[#0F2744] text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todos ({licensingList.length})
                </button>
                {agendaMonths.map(m => {
                  const countInMonth = licensingList.filter(l => l.mesVencimento === m).length;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setAgendaMonthFilter(m)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        agendaMonthFilter === m
                          ? 'bg-sky-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {m.split('/')[0].trim()} ({countInMonth})
                    </button>
                  );
                })}
              </div>

              {/* Status Pills */}
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { id: 'ALL', label: 'Todos Status' },
                  { id: 'PENDENTE', label: 'A Pagar' },
                  { id: 'VENCE_EM_BREVE', label: 'Vence Breve' },
                  { id: 'VENCIDO', label: 'Vencidos' },
                  { id: 'PAGO', label: 'Baixados' },
                ].map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setAgendaStatusFilter(st.id)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                      agendaStatusFilter === st.id
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Body: Chronological List Grouped by Month */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 bg-slate-50/50">
              {Object.keys(agendaByMonth).length === 0 ? (
                <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300 space-y-2">
                  <Calendar className="w-10 h-10 mx-auto text-slate-400" />
                  <h4 className="font-bold text-slate-700 text-sm">
                    Nenhum vencimento encontrado para os filtros selecionados
                  </h4>
                  <p className="text-xs text-slate-500">
                    Tente selecionar outro mês ou limpar o termo de pesquisa na agenda.
                  </p>
                </div>
              ) : (
                Object.entries(agendaByMonth).map(([monthName, list]) => {
                  const monthTotal = list.reduce((sum, item) => sum + item.valorTotalEstimado, 0);
                  const monthOverdueCount = list.filter(l => l.status === 'VENCIDO' && !l.pago).length;

                  return (
                    <div key={monthName} className="space-y-3">
                      {/* Month Header Banner */}
                      <div className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
                          <h3 className="font-extrabold text-sm text-[#0F2744]">
                            🗓️ Vencimentos em {monthName}
                          </h3>
                          <span className="text-xs font-mono font-bold bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded-full">
                            {list.length} veículo(s)
                          </span>
                          {monthOverdueCount > 0 && (
                            <span className="text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-300 px-2 py-0.5 rounded-full animate-pulse">
                              {monthOverdueCount} vencido(s)
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-600 font-medium">
                          Total Previsto no Mês:{' '}
                          <strong className="text-slate-900 font-mono">
                            R$ {monthTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                      </div>

                      {/* Vehicles Cards Grid for this Month */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {list.map(lic => {
                          const vehicle = vehicles.find(v => v.placa === lic.placa);
                          const isOverdue = lic.status === 'VENCIDO' && !lic.pago;
                          const isNear = lic.status === 'VENCE_EM_BREVE' && !lic.pago;

                          return (
                            <div
                              key={lic.placa}
                              className={`p-4 rounded-xl border bg-white shadow-2xs transition-all hover:shadow-sm space-y-3 ${
                                lic.pago
                                  ? 'border-emerald-200 bg-emerald-50/10'
                                  : isOverdue
                                  ? 'border-red-300 ring-1 ring-red-300'
                                  : isNear
                                  ? 'border-amber-300'
                                  : 'border-slate-200'
                              }`}
                            >
                              {/* Card Top: Plate Badge, Category & Status */}
                              <div className="flex items-center justify-between gap-2 border-b pb-2.5">
                                <div className="flex items-center gap-2">
                                  <LicensePlateBadge placa={lic.placa} size="sm" />
                                  <span className="font-mono text-[10px] font-extrabold bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded">
                                    Final {lic.finalPlaca || lic.finalSimples} [{lic.grupoFinal || '01-31'}]
                                  </span>
                                </div>

                                {/* Status Tag */}
                                {lic.pago ? (
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Quitado
                                  </span>
                                ) : isOverdue ? (
                                  <span className="bg-red-100 text-red-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 border border-red-300">
                                    <AlertTriangle className="w-3 h-3 text-red-600" />
                                    Vencido ({Math.abs(lic.diasRestantes)}d)
                                  </span>
                                ) : isNear ? (
                                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-300">
                                    <Calendar className="w-3 h-3 text-amber-600" />
                                    Vence em {lic.diasRestantes}d
                                  </span>
                                ) : (
                                  <span className="bg-sky-50 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-sky-200">
                                    Em dia ({lic.diasRestantes}d)
                                  </span>
                                )}
                              </div>

                              {/* Vehicle Model & Driver */}
                              <div>
                                <h4 className="font-bold text-slate-900 text-xs">
                                  {vehicle?.modelo || 'Veículo Cadastrado na Frota'}
                                </h4>
                                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
                                  <span>{vehicle?.marca || 'Frota Telecom'} • Ano {vehicle?.ano || 2022}</span>
                                  <span>Motorista: <strong className="text-slate-700">{vehicle?.motoristaNome || 'Operador da Frota'}</strong></span>
                                </div>
                              </div>

                              {/* Dates Timeline Box */}
                              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1.5 text-[11px]">
                                <div className="flex items-center justify-between font-bold">
                                  <span className="text-slate-700 flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-sky-600" /> Licenciamento (3ª Cota):
                                  </span>
                                  <span className="font-mono text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
                                    {lic.dataLimiteLicenciamento.split('-').reverse().join('/')}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-emerald-800 text-[10px] pt-1 border-t border-slate-200/60">
                                  <span>IPVA Cidadão (Cota Única):</span>
                                  <span className="font-mono font-semibold">
                                    {lic.dataCotaUnicaDesconto15.split('-').reverse().join('/')}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-slate-600 text-[10px]">
                                  <span>Parcelamento (1ª / 2ª / 3ª):</span>
                                  <span className="font-mono">
                                    {lic.cota1Parcelamento?.split('-').reverse().join('/') || '-'} • {lic.cota2Parcelamento?.split('-').reverse().join('/') || '-'}
                                  </span>
                                </div>

                                {/* If paid, show payment and baixa dates */}
                                {lic.pago && (
                                  <div className="bg-emerald-100/70 p-2 rounded border border-emerald-300 text-[10px] text-emerald-950 font-mono space-y-0.5 mt-1">
                                    <div>✓ Data do Pagamento: <strong>{lic.dataPagamento ? lic.dataPagamento.split('-').reverse().join('/') : '-'}</strong></div>
                                    <div>✓ Data da Baixa: <strong>{lic.dataBaixa ? lic.dataBaixa.split('-').reverse().join('/') : '-'}</strong></div>
                                    {lic.comprovanteNumero && (
                                      <div>Comprovante: <strong>{lic.comprovanteNumero}</strong></div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Values Breakdown */}
                              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                                <div>
                                  <span className="text-[10px] text-slate-500 block">IPVA + Taxa DETRAN</span>
                                  <div className="font-mono text-slate-600 text-[11px]">
                                    R$ {lic.valorIpvaComDesconto.toFixed(2)} + R$ {lic.valorTaxaDetran.toFixed(2)}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-slate-500 block font-semibold">Valor Total da Guia</span>
                                  <div className="font-mono font-extrabold text-slate-900 text-sm">
                                    R$ {lic.valorTotalEstimado.toFixed(2)}
                                  </div>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                                <button
                                  type="button"
                                  onClick={() => handleSendChatwootAlert(lic)}
                                  disabled={sendingPlaca === lic.placa}
                                  className="flex items-center gap-1 text-[11px] font-semibold text-cyan-800 hover:text-cyan-950 bg-cyan-50 hover:bg-cyan-100 px-2.5 py-1.5 rounded-lg border border-cyan-200 transition-colors cursor-pointer"
                                  title="Disparar lembrete via Chatwoot para o motorista deste veículo"
                                >
                                  {sentSuccessPlaca === lic.placa ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Alerta Enviado!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Send className="w-3.5 h-3.5 text-cyan-700" />
                                      <span>Notificar Chatwoot</span>
                                    </>
                                  )}
                                </button>

                                <div className="flex items-center gap-1.5">
                                  {lic.pago ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setViewBaixaItem(lic)}
                                        className="text-[11px] text-emerald-800 font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-300 cursor-pointer"
                                      >
                                        Ver Baixa
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleUnpay(lic.placa, lic.exercicio)}
                                        className="text-[11px] text-slate-500 hover:text-slate-800 underline px-1 cursor-pointer"
                                      >
                                        Desfazer
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenBaixaModal(lic)}
                                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                                    >
                                      <Receipt className="w-3 h-3" />
                                      <span>Dar Baixa</span>
                                    </button>
                                  )}

                                  <a
                                    href="https://www.detran.pa.gov.br"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Abrir Portal DETRAN-PA"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 text-[11px]">
                Regulamentado pela Portaria Anual DETRAN-PA e SEFA-PA • Alíquotas: 2,5% (Passeio) / 1,0% (Utilitários)
              </span>

              <button
                type="button"
                onClick={() => setShowAgendaModal(false)}
                className="w-full sm:w-auto px-5 py-2 bg-[#0F2744] hover:bg-slate-800 text-white font-bold rounded-lg transition-colors cursor-pointer"
              >
                Fechar Agenda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
