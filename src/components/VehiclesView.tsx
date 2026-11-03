import React, { useState } from 'react';
import {
  Car,
  Plus,
  Gauge,
  Fuel,
  BatteryCharging,
  MapPin,
  Clock,
  User,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Edit2,
  Trash2,
  Radio,
  Sparkles,
  Download,
  RefreshCw,
  SlidersHorizontal,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  History,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { Vehicle, SystemUser, FuelType, ServiceLog } from '../types';
import { LicensePlateBadge } from './LicensePlateBadge';
import { storage } from '../services/storage';
import { ManualServiceModal } from './ManualServiceModal';

interface VehiclesViewProps {
  vehicles: Vehicle[];
  services?: ServiceLog[];
  users: SystemUser[];
  onVehiclesUpdated: () => void;
  onNavigateToAI: (placa?: string) => void;
  onNavigateToTracking: (veiculoId?: string) => void;
  onSendChatwootAlert: (message: string, placa: string) => Promise<boolean>;
  onServiceAdded?: (service: ServiceLog) => void;
}

export const VehiclesView: React.FC<VehiclesViewProps> = ({
  vehicles,
  services,
  users,
  onVehiclesUpdated,
  onNavigateToAI,
  onNavigateToTracking,
  onSendChatwootAlert,
  onServiceAdded,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [selectedVehicleForHistory, setSelectedVehicleForHistory] = useState<Vehicle | null>(null);
  const [showManualServiceModal, setShowManualServiceModal] = useState(false);
  const [manualServicePlaca, setManualServicePlaca] = useState<string>('');

  // Form State
  const [placa, setPlaca] = useState('');
  const [modelo, setModelo] = useState('');
  const [marca, setMarca] = useState('');
  const [ano, setAno] = useState(2023);
  const [cor, setCor] = useState('Branco');
  const [categoria, setCategoria] = useState<'PASSEIO' | 'UTILITARIO' | 'CAMINHAO' | 'MOTO' | 'VAN'>('PASSEIO');
  const [chassi, setChassi] = useState('');
  const [renavam, setRenavam] = useState('');
  const [odometroAtual, setOdometroAtual] = useState(30000);
  const [odometroEstimado, setOdometroEstimado] = useState(30000);
  const [odometroRastreador, setOdometroRastreador] = useState(0);
  const [dataUltimoOdometroEstimado, setDataUltimoOdometroEstimado] = useState<string | undefined>(undefined);
  const [dataUltimoOdometroRastreador, setDataUltimoOdometroRastreador] = useState<string | undefined>(undefined);
  const [combustivel, setCombustivel] = useState<FuelType>('FLEX');
  const [motoristaId, setMotoristaId] = useState('');
  const [cidade, setCidade] = useState('Belém');
  const [valorVenalFipe, setValorVenalFipe] = useState(80000);

  // Selsyn Telemetry Lookup State
  const [isSearchingSelsyn, setIsSearchingSelsyn] = useState(false);
  const [selsynLookupResult, setSelsynLookupResult] = useState<{
    found: boolean;
    source: string;
    message: string;
    vehicleData?: any;
    canSimulate?: boolean;
  } | null>(null);
  const [selsynEditableData, setSelsynEditableData] = useState<any | null>(null);
  const [showEditBeforeImport, setShowEditBeforeImport] = useState(false);
  const [selsynSearchError, setSelsynSearchError] = useState<string | null>(null);
  const [importSuccessNotice, setImportSuccessNotice] = useState<string | null>(null);
  const lookupTimeoutRef = React.useRef<any>(null);

  // Official FIPE API State
  const [codigoFipe, setCodigoFipe] = useState('');
  const [mesReferenciaFipe, setMesReferenciaFipe] = useState('');
  const [isSearchingFipe, setIsSearchingFipe] = useState(false);
  const [fipeNotice, setFipeNotice] = useState<string | null>(null);

  // Fleet Monthly FIPE Update State
  const [showFleetFipeModal, setShowFleetFipeModal] = useState(false);
  const [isSyncingFleetFipe, setIsSyncingFleetFipe] = useState(false);
  const [fleetFipeResults, setFleetFipeResults] = useState<any[] | null>(null);
  const [fleetFipeSummary, setFleetFipeSummary] = useState<{
    totalProcessados: number;
    atualizadosCount: number;
    valorTotalFrotaFipe: number;
    mesReferencia: string;
  } | null>(null);
  const [fleetFipeSuccessMsg, setFleetFipeSuccessMsg] = useState<string | null>(null);

  const drivers = users.filter(u => u.cargo === 'MOTORISTA' || u.cargo === 'OPERADOR');

  const filteredVehicles = vehicles.filter(v => {
    if (filterStatus !== 'ALL' && v.status !== filterStatus) return false;
    if (searchTerm) {
      const matchPlaca = v.placa.toLowerCase().includes(searchTerm.toLowerCase());
      const matchModelo = v.modelo.toLowerCase().includes(searchTerm.toLowerCase());
      const matchMotorista = v.motoristaNome?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchPlaca && !matchModelo && !matchMotorista) return false;
    }
    return true;
  });

  const handleOpenAddModal = () => {
    setEditingVehicle(null);
    setPlaca('');
    setModelo('');
    setMarca('');
    setAno(2023);
    setCor('Branco');
    setCategoria('PASSEIO');
    setChassi('');
    setRenavam('');
    setOdometroAtual(35000);
    setOdometroEstimado(35000);
    setOdometroRastreador(0);
    setDataUltimoOdometroEstimado(undefined);
    setDataUltimoOdometroRastreador(undefined);
    setCombustivel('FLEX');
    setMotoristaId(drivers[0]?.id || '');
    setCidade('Belém');
    setValorVenalFipe(85000);
    setCodigoFipe('');
    setMesReferenciaFipe('');
    setFipeNotice(null);
    setSelsynLookupResult(null);
    setSelsynEditableData(null);
    setSelsynSearchError(null);
    setShowEditBeforeImport(false);
    setImportSuccessNotice(null);
    setShowModal(true);
  };

  const handleOpenEditModal = (v: Vehicle) => {
    setEditingVehicle(v);
    setPlaca(v.placa);
    setModelo(v.modelo);
    setMarca(v.marca);
    setAno(v.ano);
    setCor(v.cor);
    setCategoria(v.categoria);
    setChassi(v.chassi);
    setRenavam(v.renavam);
    const estVal = v.odometroEstimado ?? v.odometroAtual;
    setOdometroAtual(estVal);
    setOdometroEstimado(estVal);
    setOdometroRastreador(v.odometroRastreador ?? 0);
    setDataUltimoOdometroEstimado(v.dataUltimoOdometroEstimado);
    setDataUltimoOdometroRastreador(v.dataUltimoOdometroRastreador);
    setCombustivel(v.combustivel);
    setMotoristaId(v.motoristaId || '');
    setCidade(v.localizacao.cidade);
    setValorVenalFipe(v.valorVenalFipe);
    setCodigoFipe(v.codigoFipe || '');
    setMesReferenciaFipe(v.mesReferenciaFipe || '');
    setFipeNotice(null);
    setSelsynLookupResult(null);
    setSelsynEditableData(null);
    setSelsynSearchError(null);
    setShowEditBeforeImport(false);
    setImportSuccessNotice(null);
    setShowModal(true);
  };

  // Direct FIPE Plate Lookup
  const handleLookupFipe = async (targetPlaca?: string) => {
    const rawPlate = (targetPlaca !== undefined ? targetPlaca : placa).trim();
    const clean = rawPlate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (clean.length < 5) return;

    setIsSearchingFipe(true);
    setFipeNotice(null);

    try {
      const res = await fetch('/api/fipe/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placa: clean }),
      });
      const data = await res.json();

      if (data.success && data.found && data.data) {
        const info = data.data;
        if (info.valorFipe > 0) {
          setValorVenalFipe(info.valorFipe);
        }
        if (info.codigoFipe) setCodigoFipe(info.codigoFipe);
        if (info.mesReferencia) setMesReferenciaFipe(info.mesReferencia);
        if (info.marca && (!marca || marca.length < 2)) setMarca(info.marca);
        if (info.modelo && (!modelo || modelo.length < 3)) setModelo(info.modelo);
        if (info.ano) setAno(info.ano);
        if (info.cor && cor === 'Branco') setCor(info.cor);

        setFipeNotice(`Tabela FIPE Oficial: ${info.valorFipeFormatado} (Cód: ${info.codigoFipe || 'N/A'} • Ref: ${info.mesReferencia})`);
      } else {
        setFipeNotice(data.message || 'Placa não localizada na Tabela FIPE oficial.');
      }
    } catch (err: any) {
      console.error('Erro na consulta FIPE:', err);
      setFipeNotice('Falha na comunicação com a API FIPE.');
    } finally {
      setIsSearchingFipe(false);
    }
  };

  // Fleet Monthly FIPE Execution
  const handleExecuteFleetFipeSync = async () => {
    if (vehicles.length === 0) return;
    setIsSyncingFleetFipe(true);
    setFleetFipeResults(null);
    setFleetFipeSuccessMsg(null);

    try {
      const res = await fetch('/api/fipe/sync-fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicles: vehicles.map(v => ({
            id: v.id,
            placa: v.placa,
            modelo: v.modelo,
            valorVenalFipe: v.valorVenalFipe,
            codigoFipe: v.codigoFipe,
          })),
        }),
      });

      const resData = await res.json();
      if (resData.success) {
        setFleetFipeResults(resData.resultados || []);
        setFleetFipeSummary({
          totalProcessados: resData.totalProcessados,
          atualizadosCount: resData.atualizadosCount,
          valorTotalFrotaFipe: resData.valorTotalFrotaFipe,
          mesReferencia: resData.mesReferencia,
        });
      }
    } catch (err) {
      console.error('Falha ao sincronizar FIPE da frota:', err);
    } finally {
      setIsSyncingFleetFipe(false);
    }
  };

  // Apply FIPE Updated Values to Storage Fleet
  const handleApplyFleetFipeSync = () => {
    if (!fleetFipeResults || fleetFipeResults.length === 0) return;

    let count = 0;
    const currentVehicles = storage.getVehicles();

    const updatedFleet = currentVehicles.map(v => {
      const cleanPlateCurrent = v.placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const match = fleetFipeResults.find(
        r => r.id === v.id || r.placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === cleanPlateCurrent
      );

      if (match && match.valorNovo > 0) {
        count++;
        return {
          ...v,
          modelo: match.modelo || v.modelo,
          valorVenalFipe: match.valorNovo,
          codigoFipe: match.codigoFipe || v.codigoFipe,
          mesReferenciaFipe: match.mesReferencia,
          dataUltimaAtualizacaoFipe: match.dataAtualizacao || new Date().toISOString(),
          fipePrices: match.fipePrices || v.fipePrices,
        };
      }
      return v;
    });

    storage.saveVehicles(updatedFleet);
    onVehiclesUpdated();
    setFleetFipeSuccessMsg(`Valores FIPE atualizados com sucesso para ${count} veículos da frota!`);
    setTimeout(() => {
      setShowFleetFipeModal(false);
      setFleetFipeSuccessMsg(null);
    }, 1800);
  };

  // Consult Selsyn API by license plate
  const handleLookupSelsyn = async (targetPlaca?: string, forceSimulation = false) => {
    const rawPlate = (targetPlaca !== undefined ? targetPlaca : placa).trim();
    const clean = rawPlate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (clean.length < 5) {
      setSelsynSearchError('Digite uma placa válida com pelo menos 5 dígitos para consultar a Selsyn.');
      return;
    }

    setIsSearchingSelsyn(true);
    setSelsynSearchError(null);
    setImportSuccessNotice(null);

    try {
      const settings = storage.getSettings();
      const trackingConfig = settings.tracking || {
        baseUrl: 'https://api.appselsyn.com.br/',
        xApiKey: '',
        operadorKey: '',
        token: '',
        modoSimulacao: false,
      };

      const response = await fetch('/api/selsyn/lookup-vehicle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placa: clean,
          baseUrl: trackingConfig.baseUrl,
          operadorKey: trackingConfig.operadorKey,
          xApiKey: trackingConfig.xApiKey,
          token: trackingConfig.token,
          modoSimulacao: forceSimulation || trackingConfig.modoSimulacao,
        }),
      });

      const resData = await response.json();
      if (!response.ok && !resData.found) {
        setSelsynSearchError(resData.message || 'Erro ao consultar veículo na Selsyn.');
        setIsSearchingSelsyn(false);
        return;
      }

      setSelsynLookupResult(resData);
      if (resData.found && resData.vehicleData) {
        setSelsynEditableData({ ...resData.vehicleData });
      }
    } catch (err: any) {
      console.error('Falha ao consultar Selsyn:', err);
      setSelsynSearchError('Falha ao conectar com o serviço de rastreamento Selsyn.');
    } finally {
      setIsSearchingSelsyn(false);
    }
  };

  const handlePlacaChange = (val: string) => {
    const upper = val.toUpperCase();
    setPlaca(upper);
    setImportSuccessNotice(null);
    const clean = upper.replace(/[^A-Za-z0-9]/g, '');

    // Reset result if plate has completely changed
    if (selsynLookupResult && selsynLookupResult.vehicleData?.placaLimpa !== clean) {
      setSelsynLookupResult(null);
      setSelsynEditableData(null);
      setShowEditBeforeImport(false);
    }

    // Auto-query when user types a full 7-character plate
    if (clean.length === 7) {
      if (lookupTimeoutRef.current) clearTimeout(lookupTimeoutRef.current);
      lookupTimeoutRef.current = setTimeout(() => {
        handleLookupSelsyn(clean);
      }, 600);
    }
  };

  // Confirm import into the registration form
  const handleConfirmImportToForm = () => {
    if (!selsynEditableData) return;

    if (selsynEditableData.placa) setPlaca(selsynEditableData.placa);
    if (selsynEditableData.modelo) setModelo(selsynEditableData.modelo);
    if (selsynEditableData.marca) setMarca(selsynEditableData.marca);
    if (selsynEditableData.ano) setAno(Number(selsynEditableData.ano));
    if (selsynEditableData.cor) setCor(selsynEditableData.cor);
    if (selsynEditableData.categoria) setCategoria(selsynEditableData.categoria);
    if (selsynEditableData.chassi) setChassi(selsynEditableData.chassi);
    if (selsynEditableData.renavam) setRenavam(selsynEditableData.renavam);
    
    // Set both estimated and tracker odometers (garantindo conversão de METROS para KM da Selsyn)
    const rawEst = Number(selsynEditableData.odometroEstimado ?? selsynEditableData.odometroAtual ?? 35000);
    const estKm = rawEst > 500000 ? Math.round(rawEst / 1000) : rawEst;
    const rawRast = Number(selsynEditableData.odometroRastreador ?? selsynEditableData.odometroAtual ?? 0);
    const rastKm = rawRast > 500000 ? Math.round(rawRast / 1000) : rawRast;

    setOdometroEstimado(estKm);
    setOdometroAtual(estKm);
    setOdometroRastreador(rastKm);
    if (selsynEditableData.dataUltimoOdometroEstimado) setDataUltimoOdometroEstimado(selsynEditableData.dataUltimoOdometroEstimado);
    if (selsynEditableData.dataUltimoOdometroRastreador) setDataUltimoOdometroRastreador(selsynEditableData.dataUltimoOdometroRastreador);

    if (selsynEditableData.combustivel) setCombustivel(selsynEditableData.combustivel);
    if (selsynEditableData.cidade) setCidade(selsynEditableData.cidade);
    if (selsynEditableData.valorVenalFipe) setValorVenalFipe(Number(selsynEditableData.valorVenalFipe));
    if (selsynEditableData.codigoFipe) setCodigoFipe(selsynEditableData.codigoFipe);
    if (selsynEditableData.mesReferenciaFipe) setMesReferenciaFipe(selsynEditableData.mesReferenciaFipe);

    setImportSuccessNotice('Dados da Selsyn importados com sucesso para os campos abaixo! O odômetro foi convertido de metros para KM.');
  };

  // Direct import & immediate save
  const handleDirectImportAndSave = () => {
    if (!selsynEditableData) return;
    const finalData = selsynEditableData;
    const cleanPlaca = (finalData.placa || placa).trim().toUpperCase();
    const selectedDriver = users.find(u => u.id === motoristaId);
    const rawEst = Number(finalData.odometroEstimado ?? finalData.odometroAtual) || 35000;
    const estKm = rawEst > 500000 ? Math.round(rawEst / 1000) : rawEst;
    const rawRast = Number(finalData.odometroRastreador ?? finalData.odometroAtual) || 0;
    const rastKm = rawRast > 500000 ? Math.round(rawRast / 1000) : rawRast;

    const newV: Vehicle = {
      id: 'v-' + Date.now(),
      placa: cleanPlaca,
      modelo: finalData.modelo || 'Veículo Selsyn',
      marca: finalData.marca || '',
      ano: Number(finalData.ano) || 2023,
      cor: finalData.cor || 'Branco',
      categoria: finalData.categoria || 'PASSEIO',
      chassi: finalData.chassi || '9BW' + Math.random().toString(36).substring(2, 12).toUpperCase(),
      renavam: finalData.renavam || '01' + Math.floor(100000000 + Math.random() * 900000000),
      odometroAtual: estKm,
      odometroEstimado: estKm,
      odometroRastreador: rastKm,
      dataUltimoOdometroEstimado: finalData.dataUltimoOdometroEstimado || new Date().toISOString().split('T')[0],
      dataUltimoOdometroRastreador: finalData.dataUltimoOdometroRastreador || (rastKm > 0 ? new Date().toISOString() : undefined),
      horimetro: Number(finalData.horimetro) || Math.round(estKm / 32),
      status: 'OPERANDO',
      combustivel: finalData.combustivel || 'FLEX',
      motoristaId: selectedDriver?.id,
      motoristaNome: selectedDriver?.nome,
      localizacao: {
        lat: Number(finalData.lat || -1.4558),
        lng: Number(finalData.lng || -48.4902),
        cidade: finalData.cidade || 'Belém',
        uf: finalData.uf || 'PA',
        endereco: finalData.endereco || `${finalData.cidade || 'Belém'} - PA`,
      },
      ignicao: Boolean(finalData.ignicao),
      velocidade: Number(finalData.velocidade || 0),
      bloqueado: false,
      nivelTanque: 75,
      bateriaVolts: Number(finalData.bateriaVolts || 13.8),
      ultimaComunicacao: finalData.ultimaComunicacao || new Date().toISOString(),
      valorVenalFipe: Number(finalData.valorVenalFipe) || 85000,
      codigoFipe: finalData.codigoFipe,
      mesReferenciaFipe: finalData.mesReferenciaFipe,
      dataUltimaAtualizacaoFipe: finalData.codigoFipe ? new Date().toISOString() : undefined,
      fipePrices: finalData.fipePrices,
      tempoSemMultasAnos: 2,
    };

    storage.addVehicle(newV);
    onVehiclesUpdated();
    setShowModal(false);
  };

  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPlaca = placa.trim().toUpperCase();
    if (!cleanPlaca || !modelo.trim()) return;

    const selectedDriver = users.find(u => u.id === motoristaId);
    const finalEstKm = Number(odometroEstimado ?? odometroAtual ?? 0);
    const finalRastKm = Number(odometroRastreador ?? 0);

    if (editingVehicle) {
      const updated: Vehicle = {
        ...editingVehicle,
        placa: cleanPlaca,
        modelo,
        marca,
        ano: Number(ano),
        cor,
        categoria,
        chassi,
        renavam,
        odometroAtual: finalEstKm,
        odometroEstimado: finalEstKm,
        odometroRastreador: finalRastKm,
        dataUltimoOdometroEstimado: dataUltimoOdometroEstimado || (finalEstKm !== editingVehicle.odometroEstimado ? new Date().toISOString().split('T')[0] : editingVehicle.dataUltimoOdometroEstimado),
        dataUltimoOdometroRastreador: dataUltimoOdometroRastreador || editingVehicle.dataUltimoOdometroRastreador,
        combustivel,
        motoristaId: selectedDriver?.id,
        motoristaNome: selectedDriver?.nome,
        valorVenalFipe: Number(valorVenalFipe),
        codigoFipe: codigoFipe || editingVehicle.codigoFipe,
        mesReferenciaFipe: mesReferenciaFipe || editingVehicle.mesReferenciaFipe,
        dataUltimaAtualizacaoFipe: codigoFipe ? new Date().toISOString() : editingVehicle.dataUltimaAtualizacaoFipe,
        localizacao: {
          ...editingVehicle.localizacao,
          cidade,
        },
      };
      storage.updateVehicle(updated);
    } else {
      const newV: Vehicle = {
        id: 'v-' + Date.now(),
        placa: cleanPlaca,
        modelo,
        marca,
        ano: Number(ano),
        cor,
        categoria,
        chassi: chassi || '9BW' + Math.random().toString(36).substring(2, 12).toUpperCase(),
        renavam: renavam || '01' + Math.floor(100000000 + Math.random() * 900000000),
        odometroAtual: finalEstKm,
        odometroEstimado: finalEstKm,
        odometroRastreador: finalRastKm,
        dataUltimoOdometroEstimado: new Date().toISOString().split('T')[0],
        dataUltimoOdometroRastreador: finalRastKm > 0 ? new Date().toISOString() : undefined,
        horimetro: Math.round(Number(finalEstKm) / 35),
        status: 'OPERANDO',
        combustivel,
        motoristaId: selectedDriver?.id,
        motoristaNome: selectedDriver?.nome,
        localizacao: {
          lat: -1.4558,
          lng: -48.4902,
          cidade,
          uf: 'PA',
          endereco: `Base Operacional, ${cidade} - PA`,
        },
        ignicao: true,
        velocidade: 35,
        bloqueado: false,
        nivelTanque: 80,
        bateriaVolts: 13.8,
        ultimaComunicacao: new Date().toISOString(),
        valorVenalFipe: Number(valorVenalFipe),
        codigoFipe: codigoFipe || undefined,
        mesReferenciaFipe: mesReferenciaFipe || undefined,
        dataUltimaAtualizacaoFipe: codigoFipe ? new Date().toISOString() : undefined,
        tempoSemMultasAnos: 2,
      };
      storage.addVehicle(newV);
    }

    onVehiclesUpdated();
    setShowModal(false);
  };

  const handleDeleteVehicle = (id: string, placaStr: string) => {
    if (confirm(`Tem certeza que deseja remover o veículo ${placaStr} da frota?`)) {
      storage.deleteVehicle(id);
      onVehiclesUpdated();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0F2744] flex items-center justify-center text-white">
              <Car className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-[#0F2744]">
              Gestão de Frota &amp; Telemetria
            </h1>
          </div>
          <p className="text-slate-600 text-xs sm:text-sm mt-1">
            Controle de cadastro, odômetros, horímetros e telemetria Selsyn ao vivo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setShowFleetFipeModal(true);
              if (!fleetFipeResults) {
                handleExecuteFleetFipeSync();
              }
            }}
            className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold px-3.5 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-sm active:scale-95"
            title="Atualizar mensalmente a tabela FIPE de todos os veículos da frota"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncingFleetFipe ? 'animate-spin' : ''}`} />
            <span>Atualizar FIPE da Frota (Mensal)</span>
          </button>

          <button
            onClick={() => {
              setManualServicePlaca('');
              setShowManualServiceModal(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-sm active:scale-95"
            title="Lançar manutenção manual sem IA para qualquer veículo"
          >
            <Wrench className="w-4 h-4" />
            <span>Lançar Serviço Manual</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Veículo</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-sm bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por placa, modelo ou motorista..."
            className="w-full bg-transparent focus:outline-none text-slate-800 font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          {[
            { id: 'ALL', label: 'Todos' },
            { id: 'OPERANDO', label: 'Operando' },
            { id: 'PARADO', label: 'Parados' },
            { id: 'ALERTA', label: 'Em Alerta' },
            { id: 'MANUTENCAO', label: 'Manutenção' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterStatus(f.id)}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                filterStatus === f.id
                  ? 'bg-[#0F2744] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vehicles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredVehicles.map(v => {
          const isBlocked = v.bloqueado;
          const isOperando = v.status === 'OPERANDO';
          const isAlerta = v.status === 'ALERTA';
          const allServicesList = services || storage.getServices();
          const cleanVPlaca = v.placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          const vehicleServicesCount = allServicesList.filter(
            s => s.placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === cleanVPlaca
          ).length;

          return (
            <div
              key={v.id}
              className={`bg-white rounded-xl border p-5 shadow-sm space-y-4 transition-all hover:shadow-md flex flex-col justify-between ${
                isBlocked
                  ? 'border-red-300 bg-red-50/10 ring-1 ring-red-200'
                  : isAlerta
                  ? 'border-amber-300 bg-amber-50/10'
                  : 'border-slate-200 hover:border-sky-300'
              }`}
            >
              {/* Card Top: Plate, Category & Status (Clickable to view maintenance history) */}
              <div
                onClick={() => setSelectedVehicleForHistory(v)}
                className="cursor-pointer group/card"
                title="Clique para ver o histórico completo de manutenções deste veículo"
              >
                <div className="flex items-start justify-between gap-2">
                  <LicensePlateBadge placa={v.placa} size="md" />

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                        isBlocked
                          ? 'bg-red-600 text-white'
                          : isAlerta
                          ? 'bg-amber-500 text-white'
                          : isOperando
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-600 text-white'
                      }`}
                    >
                      {isBlocked ? 'BLOQUEADO' : v.status}
                    </span>

                    <span className="text-[10px] font-semibold text-slate-500">
                      {v.categoria}
                    </span>
                  </div>
                </div>

                {/* Model & Driver Info */}
                <div className="mt-3">
                  <h3 className="font-bold text-slate-900 text-base group-hover/card:text-sky-700 transition-colors flex items-center justify-between">
                    <span>{v.modelo}</span>
                    <span className="text-[11px] font-semibold text-sky-600 underline opacity-0 group-hover/card:opacity-100 transition-opacity">
                      Histórico ↗
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {v.marca} • Ano {v.ano} • {v.cor}
                  </p>
                </div>

                {/* Driver Tag */}
                <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <User className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                  <span className="truncate">
                    Motorista: <strong>{v.motoristaNome || 'Não atribuído'}</strong>
                  </span>
                </div>

                {/* Dual Odometers & Telemetry Grid (Estimado vs Rastreador) */}
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* Odômetro Estimado / Manual */}
                    <div className="bg-sky-50/80 p-2.5 rounded-lg border border-sky-200">
                      <div className="flex items-center justify-between text-[11px] text-sky-900 font-semibold mb-0.5">
                        <div className="flex items-center gap-1">
                          <Gauge className="w-3.5 h-3.5 text-sky-700" />
                          <span className="font-bold">Odômetro Estimado</span>
                        </div>
                        <span className="text-[9px] bg-sky-200 text-sky-900 px-1 py-0.2 rounded font-black">Manual/OS</span>
                      </div>
                      <span className="font-black font-mono text-sky-950 text-sm block">
                        {(v.odometroEstimado ?? v.odometroAtual).toLocaleString('pt-BR')} km
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {v.dataUltimoOdometroEstimado ? `OS: ${v.dataUltimoOdometroEstimado.split('-').reverse().join('/')}` : 'Base p/ Revisões'}
                      </span>
                    </div>

                    {/* Odômetro (Rastreador Selsyn) */}
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between text-[11px] text-slate-700 font-semibold mb-0.5">
                        <div className="flex items-center gap-1">
                          <Radio className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-bold">Odômetro (Rastreador)</span>
                        </div>
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-black">GPS</span>
                      </div>
                      <span className="font-black font-mono text-slate-900 text-sm block">
                        {v.odometroRastreador ? `${v.odometroRastreador.toLocaleString('pt-BR')} km` : 'Aguardando'}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        📡 Telemetria Selsyn
                      </span>
                    </div>
                  </div>

                  {/* Secondary Telemetry: Horímetro, Velocidade & Bateria */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2 rounded border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-slate-500 font-medium">
                        <Clock className="w-3.5 h-3.5 text-sky-600" />
                        <span>Horímetro</span>
                      </div>
                      <span className="font-bold font-mono text-slate-900">
                        {v.horimetro || Math.round((v.odometroEstimado || v.odometroAtual) / 32)} h
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2 rounded border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-slate-500 font-medium">
                        <BatteryCharging className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Bateria / Vel.</span>
                      </div>
                      <span className="font-bold font-mono text-slate-900">
                        {v.bateriaVolts}V • {v.velocidade}km/h
                      </span>
                    </div>
                  </div>

                  {/* Divergence Warning between GPS and Estimated */}
                  {Boolean(v.odometroRastreador && Math.abs((v.odometroEstimado ?? v.odometroAtual) - v.odometroRastreador) > 1000) && (
                    <div className="p-2 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Divergência Rastreador vs Estimado:</span>
                      </span>
                      <strong className="font-mono text-amber-950 font-black">
                        ±{Math.abs((v.odometroEstimado ?? v.odometroAtual) - v.odometroRastreador!).toLocaleString('pt-BR')} km
                      </strong>
                    </div>
                  )}
                </div>

                {/* Current Location in Pará */}
                <div className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  <span className="line-clamp-2" title={v.localizacao.endereco}>
                    <strong>{v.localizacao.cidade} - PA:</strong> {v.localizacao.endereco}
                  </span>
                </div>

                {/* Tabela FIPE Badge */}
                <div className="mt-2.5 flex items-center justify-between bg-emerald-50/70 px-2.5 py-1.5 rounded-lg border border-emerald-200/80 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-950 font-medium">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>FIPE:</span>
                    <strong className="font-mono text-emerald-800 font-extrabold">
                      R$ {(v.valorVenalFipe || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-700">
                    {v.mesReferenciaFipe ? (
                      <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold text-[10px]">
                        Ref: {v.mesReferenciaFipe}
                      </span>
                    ) : v.codigoFipe ? (
                      <span className="text-slate-500 font-mono text-[10px]">Cód: {v.codigoFipe}</span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">Oficial</span>
                    )}
                  </div>
                </div>

                {/* Botões de Acesso Rápido: Lançamento Manual & Histórico */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setManualServicePlaca(v.placa);
                      setShowManualServiceModal(true);
                    }}
                    className="py-2 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs group/btn"
                    title={`Lançar serviço manual para a placa ${v.placa}`}
                  >
                    <Wrench className="w-3.5 h-3.5 text-emerald-700 group-hover/btn:rotate-12 transition-transform" />
                    <span>Lançar Manual</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedVehicleForHistory(v);
                    }}
                    className="py-2 px-2.5 rounded-lg bg-sky-50/80 hover:bg-sky-100 border border-sky-200/90 text-sky-900 text-xs font-bold flex items-center justify-between transition-colors shadow-2xs group/hist"
                    title="Ver histórico de manutenções"
                  >
                    <span className="flex items-center gap-1">
                      <History className="w-3.5 h-3.5 text-sky-700" />
                      <span>Histórico</span>
                    </span>
                    <span className="bg-sky-200 text-sky-950 px-1.5 py-0.2 rounded-full text-[10px] font-black font-mono">
                      {vehicleServicesCount}
                    </span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2 text-xs">
                {/* Selsyn Telemetry Badge */}
                <div className="flex items-center gap-1.5 text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold">
                  <Radio className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Selsyn Telemetria</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Launch Manual Service */}
                  <button
                    onClick={() => {
                      setManualServicePlaca(v.placa);
                      setShowManualServiceModal(true);
                    }}
                    title={`Lançar manutenção manual para ${v.placa}`}
                    className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                  </button>

                  {/* Launch AI Service */}
                  <button
                    onClick={() => onNavigateToAI(v.placa)}
                    title={`Lançar manutenção com IA para ${v.placa}`}
                    className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                  </button>

                  {/* View on Map */}
                  <button
                    onClick={() => onNavigateToTracking(v.id)}
                    title="Ver no Mapa de Rastreamento"
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => handleOpenEditModal(v)}
                    title="Editar Veículo"
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteVehicle(v.id, v.placa)}
                    title="Remover Veículo"
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State Banner */}
      {filteredVehicles.length === 0 && (
        <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto">
            <Car className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">Nenhum veículo cadastrado na frota</h3>
            <p className="text-slate-500 text-xs max-w-md mx-auto mt-1">
              O banco de dados foi limpo para que você cadastre veículos e telemetria reais. Comece adicionando seu primeiro veículo abaixo.
            </p>
          </div>
          <button
            onClick={() => handleOpenAddModal()}
            className="bg-[#0F2744] hover:bg-[#1E3A5F] text-white font-semibold text-xs px-4 py-2.5 rounded-lg inline-flex items-center gap-2 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Primeiro Veículo</span>
          </button>
        </div>
      )}

      {/* Add / Edit Vehicle Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-xl border border-slate-200 max-h-[92vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-[#0F2744] text-base flex items-center gap-2">
                  <Car className="w-5 h-5 text-sky-600" />
                  <span>{editingVehicle ? 'Editar Veículo da Frota' : 'Cadastrar Novo Veículo'}</span>
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  Consulte a placa para puxar automaticamente os dados cadastrados e telemetria da Selsyn.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 rounded-md hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* Selsyn Search Header Box */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-end gap-2.5">
                <div className="flex-1">
                  <label className="font-bold text-[#0F2744] block mb-1 flex items-center justify-between">
                    <span>Placa do Veículo (Mercosul ou Padrão Antigo):</span>
                    <span className="text-[10px] font-normal text-slate-500">Ex: QEN-4521 ou BRA2E19</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={placa}
                      onChange={e => handlePlacaChange(e.target.value)}
                      placeholder="DIGITE A PLACA..."
                      maxLength={8}
                      className="w-full border-2 border-sky-600/40 focus:border-sky-600 rounded-lg p-2.5 font-mono uppercase font-black text-sm tracking-wider text-slate-800 bg-white shadow-xs"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleLookupSelsyn(placa)}
                  disabled={isSearchingSelsyn || placa.replace(/[^A-Za-z0-9]/g, '').length < 5}
                  className="bg-[#0F2744] hover:bg-[#1E3A5F] disabled:bg-slate-300 text-white font-bold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all shadow-xs h-[42px] shrink-0"
                >
                  {isSearchingSelsyn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-sky-300" />
                      <span>Consultando Selsyn...</span>
                    </>
                  ) : (
                    <>
                      <Radio className="w-4 h-4 text-sky-400" />
                      <span>Consultar Selsyn</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Integração Selsyn Keek ativa (ao digitar 7 caracteres a busca inicia automaticamente)</span>
                </div>
                {!editingVehicle && (
                  <button
                    type="button"
                    onClick={() => handleLookupSelsyn(placa || 'BRA2E19', true)}
                    className="text-sky-700 hover:text-sky-900 font-semibold underline"
                  >
                    Simular Busca Selsyn
                  </button>
                )}
              </div>
            </div>

            {/* Error or Notice Banner */}
            {selsynSearchError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <p className="font-semibold">{selsynSearchError}</p>
                  <p className="text-amber-700 mt-0.5">
                    Você pode prosseguir preenchendo o formulário manualmente abaixo, ou{' '}
                    <button
                      type="button"
                      onClick={() => handleLookupSelsyn(placa || 'QEN4521', true)}
                      className="font-bold underline text-amber-900 hover:text-amber-950"
                    >
                      clique aqui para simular a importação Selsyn com telemetria
                    </button>.
                  </p>
                </div>
              </div>
            )}

            {/* Selsyn Data Found Preview & Pre-Import Card */}
            {selsynLookupResult && selsynLookupResult.found && selsynEditableData && (
              <div className="p-4 bg-emerald-50/70 border-2 border-emerald-300 rounded-xl space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <Radio className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-black text-emerald-950 text-xs sm:text-sm flex items-center gap-1.5">
                        <span>Veículo Localizado no Sistema Selsyn!</span>
                      </h4>
                      <p className="text-[11px] text-emerald-800">
                        {selsynLookupResult.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      selsynLookupResult.source === 'selsyn_live'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-sky-100 text-sky-800 border-sky-300'
                    }`}>
                      {selsynLookupResult.source === 'selsyn_live' ? '📡 Selsyn Ao Vivo' : '🔄 Selsyn Telemetria'}
                    </span>
                  </div>
                </div>

                {/* Quick Info Grid from Selsyn */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white/90 p-3 rounded-lg border border-emerald-200 text-slate-700">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-600 block">Modelo / Marca</span>
                    <span className="font-bold text-slate-800 text-xs truncate block" title={selsynEditableData.modelo}>
                      {selsynEditableData.modelo}
                    </span>
                    <span className="text-[11px] text-slate-600">{selsynEditableData.marca}</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-600 block">Odômetro Selsyn</span>
                    <span className="font-black text-emerald-700 text-sm font-mono block">
                      {Number(selsynEditableData.odometroAtual).toLocaleString('pt-BR')} km
                    </span>
                    <span className="text-[10px] text-slate-600">Horímetro: {selsynEditableData.horimetro}h</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-600 block">Base / Localização</span>
                    <span className="font-bold text-slate-800 text-xs block truncate" title={selsynEditableData.endereco}>
                      {selsynEditableData.cidade} - {selsynEditableData.uf}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {selsynEditableData.ignicao ? '🟢 Ignição Ligada' : '⚪ Desligado'} • {selsynEditableData.velocidade} km/h
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-600 block">Ano / Cor / Categoria</span>
                    <span className="font-bold text-slate-800 text-xs block">
                      {selsynEditableData.ano} • {selsynEditableData.cor}
                    </span>
                    <span className="text-[10px] text-slate-600">{selsynEditableData.categoria} ({selsynEditableData.combustivel})</span>
                  </div>
                </div>

                {selsynEditableData.valorVenalFipe && (
                  <div className="flex items-center justify-between bg-emerald-100/70 px-3 py-1.5 rounded-lg border border-emerald-300 text-xs">
                    <span className="font-semibold text-emerald-950 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>Valor FIPE Oficial:</span>
                      <strong className="font-mono text-emerald-900 font-extrabold">
                        R$ {Number(selsynEditableData.valorVenalFipe).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </strong>
                    </span>
                    <span className="text-[10px] text-emerald-800 font-medium">
                      {selsynEditableData.codigoFipe ? `Cód: ${selsynEditableData.codigoFipe}` : ''} {selsynEditableData.mesReferenciaFipe ? `• Ref: ${selsynEditableData.mesReferenciaFipe}` : ''}
                    </span>
                  </div>
                )}

                {/* Pre-Import Editor Toggle ("possibilidade de editar alguma coisa antes de importar") */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowEditBeforeImport(!showEditBeforeImport)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-800 hover:text-sky-950 bg-sky-100 hover:bg-sky-200 px-2.5 py-1.5 rounded-lg border border-sky-300 transition-colors"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>{showEditBeforeImport ? 'Fechar Edição Pré-Importação' : '✏️ Editar Campos Antes de Importar'}</span>
                      {showEditBeforeImport ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    <span className="text-[11px] text-slate-500">
                      Revise ou altere valores antes de confirmar
                    </span>
                  </div>

                  {showEditBeforeImport && (
                    <div className="p-3 bg-white rounded-lg border border-sky-200 space-y-2.5 animate-fadeIn">
                      <div className="text-[11px] font-bold text-sky-900 border-b border-sky-100 pb-1 flex items-center gap-1">
                        <SlidersHorizontal className="w-3 h-3" />
                        <span>Ajustar dados puxados da Selsyn antes de confirmar a importação:</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <label className="font-semibold text-slate-600 block text-[10px]">Modelo:</label>
                          <input
                            type="text"
                            value={selsynEditableData.modelo || ''}
                            onChange={e => setSelsynEditableData({ ...selsynEditableData, modelo: e.target.value })}
                            className="w-full border border-slate-300 rounded p-1.5 font-medium"
                          />
                        </div>

                        <div>
                          <label className="font-semibold text-slate-600 block text-[10px]">Marca:</label>
                          <input
                            type="text"
                            value={selsynEditableData.marca || ''}
                            onChange={e => setSelsynEditableData({ ...selsynEditableData, marca: e.target.value })}
                            className="w-full border border-slate-300 rounded p-1.5"
                          />
                        </div>

                        <div>
                          <label className="font-semibold text-sky-900 block text-[10px]">Odômetro Estimado / Manual:</label>
                          <input
                            type="number"
                            value={selsynEditableData.odometroEstimado ?? selsynEditableData.odometroAtual ?? 0}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setSelsynEditableData({
                                ...selsynEditableData,
                                odometroEstimado: val,
                                odometroAtual: val,
                              });
                            }}
                            className="w-full border border-sky-300 bg-sky-50/40 rounded p-1.5 font-mono font-bold text-sky-950"
                          />
                        </div>

                        <div>
                          <label className="font-semibold text-slate-600 block text-[10px]">Odômetro (Rastreador):</label>
                          <input
                            type="number"
                            value={selsynEditableData.odometroRastreador ?? selsynEditableData.odometroAtual ?? 0}
                            onChange={e => setSelsynEditableData({ ...selsynEditableData, odometroRastreador: Number(e.target.value) })}
                            className="w-full border border-slate-300 rounded p-1.5 font-mono font-bold text-slate-700"
                          />
                        </div>

                        <div>
                          <label className="font-semibold text-slate-600 block text-[10px]">Ano Fabricação:</label>
                          <input
                            type="number"
                            value={selsynEditableData.ano || 2023}
                            onChange={e => setSelsynEditableData({ ...selsynEditableData, ano: Number(e.target.value) })}
                            className="w-full border border-slate-300 rounded p-1.5 font-mono"
                          />
                        </div>

                        <div>
                          <label className="font-semibold text-slate-600 block text-[10px]">Cor:</label>
                          <input
                            type="text"
                            value={selsynEditableData.cor || 'Branco'}
                            onChange={e => setSelsynEditableData({ ...selsynEditableData, cor: e.target.value })}
                            className="w-full border border-slate-300 rounded p-1.5"
                          />
                        </div>

                        <div>
                          <label className="font-semibold text-slate-600 block text-[10px]">Base no Pará:</label>
                          <select
                            value={selsynEditableData.cidade || 'Belém'}
                            onChange={e => setSelsynEditableData({ ...selsynEditableData, cidade: e.target.value })}
                            className="w-full border border-slate-300 rounded p-1.5"
                          >
                            <option value="Belém">Belém - PA</option>
                            <option value="Ananindeua">Ananindeua - PA</option>
                            <option value="Castanhal">Castanhal - PA</option>
                            <option value="Marabá">Marabá - PA</option>
                            <option value="Parauapebas">Parauapebas - PA</option>
                            <option value="Santarém">Santarém - PA</option>
                            <option value="Barcarena">Barcarena - PA</option>
                            <option value="Altamira">Altamira - PA</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-semibold text-slate-600 block text-[10px]">Categoria:</label>
                          <select
                            value={selsynEditableData.categoria || 'PASSEIO'}
                            onChange={e => setSelsynEditableData({ ...selsynEditableData, categoria: e.target.value })}
                            className="w-full border border-slate-300 rounded p-1.5"
                          >
                            <option value="PASSEIO">Passeio (Automóvel)</option>
                            <option value="UTILITARIO">Utilitário / Caminhonete</option>
                            <option value="CAMINHAO">Caminhão / Pesado</option>
                            <option value="VAN">Van / Transporte</option>
                            <option value="MOTO">Motocicleta</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-semibold text-slate-600 block text-[10px]">Combustível:</label>
                          <select
                            value={selsynEditableData.combustivel || 'FLEX'}
                            onChange={e => setSelsynEditableData({ ...selsynEditableData, combustivel: e.target.value })}
                            className="w-full border border-slate-300 rounded p-1.5"
                          >
                            <option value="FLEX">Flex</option>
                            <option value="DIESEL_S10">Diesel S10</option>
                            <option value="DIESEL_S500">Diesel S500</option>
                            <option value="GASOLINA">Gasolina</option>
                            <option value="ETANOL">Etanol</option>
                            <option value="HIBRIDO">Híbrido</option>
                            <option value="ELETRICO">Elétrico</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-semibold text-slate-600 block text-[10px]">Valor FIPE (R$):</label>
                          <input
                            type="number"
                            value={selsynEditableData.valorVenalFipe || 80000}
                            onChange={e => setSelsynEditableData({ ...selsynEditableData, valorVenalFipe: Number(e.target.value) })}
                            className="w-full border border-slate-300 rounded p-1.5 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Import Confirmation Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-emerald-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleConfirmImportToForm}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-sm active:scale-95 transition-all text-xs"
                    >
                      <Download className="w-4 h-4" />
                      <span>Confirmar &amp; Puxar para o Formulário</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDirectImportAndSave}
                      className="bg-[#0F2744] hover:bg-[#1E3A5F] text-white font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-sm active:scale-95 transition-all text-xs"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Importar &amp; Cadastrar Imediatamente</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelsynLookupResult(null);
                      setSelsynEditableData(null);
                      setShowEditBeforeImport(false);
                    }}
                    className="text-slate-500 hover:text-slate-700 px-2 py-1 text-xs"
                  >
                    Ignorar dados Selsyn
                  </button>
                </div>
              </div>
            )}

            {/* Success Notice if imported */}
            {importSuccessNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold text-xs">{importSuccessNotice}</span>
              </div>
            )}

            {/* Standard Registration Form */}
            <form onSubmit={handleSaveVehicle} className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Placa Confirmada:
                  </label>
                  <input
                    type="text"
                    required
                    value={placa}
                    onChange={e => handlePlacaChange(e.target.value)}
                    placeholder="QEN-4521 ou BRA2E19"
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono uppercase font-bold text-slate-800 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Categoria:</label>
                  <select
                    value={categoria}
                    onChange={e => setCategoria(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                  >
                    <option value="PASSEIO">Passeio (Automóvel)</option>
                    <option value="UTILITARIO">Utilitário / Caminhonete</option>
                    <option value="CAMINHAO">Caminhão / Pesado</option>
                    <option value="VAN">Van / Transporte</option>
                    <option value="MOTO">Motocicleta</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Modelo:</label>
                  <input
                    type="text"
                    required
                    value={modelo}
                    onChange={e => setModelo(e.target.value)}
                    placeholder="Ex: Onix Plus Turbo"
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Marca / Montadora:</label>
                  <input
                    type="text"
                    value={marca}
                    onChange={e => setMarca(e.target.value)}
                    placeholder="Ex: Chevrolet"
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ano Fabricação:</label>
                  <input
                    type="number"
                    value={ano}
                    onChange={e => setAno(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Cor:</label>
                  <input
                    type="text"
                    value={cor}
                    onChange={e => setCor(e.target.value)}
                    placeholder="Ex: Branco"
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Combustível:</label>
                  <select
                    value={combustivel}
                    onChange={e => setCombustivel(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  >
                    <option value="FLEX">Flex</option>
                    <option value="DIESEL_S10">Diesel S10</option>
                    <option value="DIESEL_S500">Diesel S500</option>
                    <option value="GASOLINA">Gasolina</option>
                    <option value="ETANOL">Etanol</option>
                    <option value="HIBRIDO">Híbrido</option>
                    <option value="ELETRICO">Elétrico</option>
                  </select>
                </div>
              </div>

              {/* Dual Odometer Section: Estimado / Manual vs Rastreador */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[#0F2744] text-xs flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-sky-700" />
                    <span>Quilometragem do Veículo: Estimado vs Rastreador</span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Evita erros causados pela imprecisão do GPS telemétrico
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Odômetro Estimado / Manual */}
                  <div className="bg-white p-3 rounded-lg border border-sky-300 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-sky-950 text-xs">
                        Odômetro Estimado / Manual (km):
                      </label>
                      <span className="bg-sky-100 text-sky-900 text-[10px] font-black px-1.5 py-0.5 rounded">
                        Oficial p/ Manutenção
                      </span>
                    </div>
                    <input
                      type="number"
                      required
                      value={odometroEstimado}
                      onChange={e => {
                        const val = Number(e.target.value);
                        setOdometroEstimado(val);
                        setOdometroAtual(val);
                      }}
                      className="w-full border border-sky-300 bg-sky-50/40 rounded-lg p-2 font-mono font-black text-sky-950 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="Ex: 48920"
                    />
                    <p className="text-[10px] text-slate-500">
                      Você pode lançar e ajustar manualmente. Atualiza automaticamente a cada OS de manutenção lançada.
                      {dataUltimoOdometroEstimado && (
                        <span className="block font-semibold text-sky-800 mt-0.5">
                          Última OS / Ajuste: {dataUltimoOdometroEstimado.split('-').reverse().join('/')}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Odômetro Rastreador (GPS Selsyn) */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 text-xs">
                        Odômetro (Rastreador) (km):
                      </label>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-1.5 py-0.5 rounded">
                        📡 GPS Selsyn
                      </span>
                    </div>
                    <input
                      type="number"
                      value={odometroRastreador}
                      onChange={e => setOdometroRastreador(Number(e.target.value))}
                      className="w-full border border-slate-300 bg-slate-50/50 rounded-lg p-2 font-mono font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                      placeholder="0 (aguardando rastreador)"
                    />
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Sincronizado automaticamente via rastreador Selsyn.</span>
                      {odometroRastreador > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setOdometroEstimado(odometroRastreador);
                            setOdometroAtual(odometroRastreador);
                          }}
                          className="text-sky-700 hover:text-sky-900 font-bold underline cursor-pointer"
                          title="Copiar quilometragem do rastreador para o odômetro estimado"
                        >
                          Copiar p/ Estimado
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Divergence warning banner if error between tracker and estimated > 1000 km */}
                {odometroRastreador > 0 && Math.abs(odometroEstimado - odometroRastreador) > 1000 && (
                  <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 flex items-start gap-2 text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed">
                      <strong>Aviso de Divergência Telemétrica:</strong> Há uma diferença de <strong>{Math.abs(odometroEstimado - odometroRastreador).toLocaleString('pt-BR')} km</strong> entre o odômetro do rastreador ({odometroRastreador.toLocaleString('pt-BR')} km) e o odômetro estimado ({odometroEstimado.toLocaleString('pt-BR')} km). O sistema continuará adotando o <strong>Odômetro Estimado / Manual</strong> como referência das manutenções preventivas.
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">Valor FIPE (para IPVA PA):</label>
                    <button
                      type="button"
                      onClick={() => handleLookupFipe()}
                      disabled={isSearchingFipe}
                      className="text-[11px] font-bold text-sky-700 hover:text-sky-900 flex items-center gap-1 bg-sky-50 hover:bg-sky-100 px-2 py-0.5 rounded border border-sky-200 transition-colors cursor-pointer"
                      title="Consultar valor oficial na Tabela FIPE para esta placa"
                    >
                      {isSearchingFipe ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-sky-600" />
                          <span>Buscando FIPE...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3 h-3 text-sky-600" />
                          <span>Buscar FIPE</span>
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    type="number"
                    value={valorVenalFipe}
                    onChange={e => setValorVenalFipe(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-800"
                  />
                  {(codigoFipe || mesReferenciaFipe) && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                      {codigoFipe && (
                        <span className="bg-slate-100 text-slate-700 font-mono px-1.5 py-0.5 rounded border border-slate-200">
                          Cód: <strong>{codigoFipe}</strong>
                        </span>
                      )}
                      {mesReferenciaFipe && (
                        <span className="bg-emerald-50 text-emerald-800 font-medium px-1.5 py-0.5 rounded border border-emerald-200">
                          Ref: {mesReferenciaFipe}
                        </span>
                      )}
                    </div>
                  )}
                  {fipeNotice && (
                    <p className="mt-1 text-[11px] text-sky-900 bg-sky-50 p-1.5 rounded border border-sky-200">
                      {fipeNotice}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Motorista Responsável:</label>
                  <select
                    value={motoristaId}
                    onChange={e => setMotoristaId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  >
                    <option value="">Nenhum motorista associado</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.nome} {d.cnh ? `(CNH: ${d.cnh})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Base no Pará:</label>
                  <select
                    value={cidade}
                    onChange={e => setCidade(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  >
                    <option value="Belém">Belém - PA</option>
                    <option value="Ananindeua">Ananindeua - PA</option>
                    <option value="Castanhal">Castanhal - PA</option>
                    <option value="Marabá">Marabá - PA</option>
                    <option value="Parauapebas">Parauapebas - PA</option>
                    <option value="Santarém">Santarém - PA</option>
                    <option value="Barcarena">Barcarena - PA</option>
                    <option value="Altamira">Altamira - PA</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Chassi:</label>
                  <input
                    type="text"
                    value={chassi}
                    onChange={e => setChassi(e.target.value.toUpperCase())}
                    placeholder="9BG..."
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Renavam:</label>
                  <input
                    type="text"
                    value={renavam}
                    onChange={e => setRenavam(e.target.value)}
                    placeholder="012..."
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0F2744] hover:bg-[#1E3A5F] text-white rounded-lg font-semibold"
                >
                  Salvar Veículo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vehicle Maintenance History Modal */}
      {selectedVehicleForHistory && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-5 sm:p-7 space-y-5 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto text-xs animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b pb-4 gap-3">
              <div className="flex items-start gap-3">
                <LicensePlateBadge placa={selectedVehicleForHistory.placa} size="lg" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-extrabold text-[#0F2744] text-lg sm:text-xl">
                      {selectedVehicleForHistory.modelo}
                    </h3>
                    <span className="bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded">
                      {selectedVehicleForHistory.categoria}
                    </span>
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-medium px-2 py-0.5 rounded">
                      Combustível: {selectedVehicleForHistory.combustivel}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs mt-1">
                    {selectedVehicleForHistory.marca} • Ano {selectedVehicleForHistory.ano} • Cor {selectedVehicleForHistory.cor} • Base {selectedVehicleForHistory.localizacao.cidade} - PA
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600 text-xs mt-1.5 font-medium">
                    <span>
                      Motorista Atual: <strong className="text-slate-800">{selectedVehicleForHistory.motoristaNome || 'Nenhum motorista vinculado'}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Odômetro Estimado: <strong className="font-mono text-sky-800 font-extrabold">{(selectedVehicleForHistory.odometroEstimado ?? selectedVehicleForHistory.odometroAtual).toLocaleString('pt-BR')} km</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Odômetro (Rastreador GPS): <strong className="font-mono text-emerald-700 font-extrabold">{selectedVehicleForHistory.odometroRastreador ? `${selectedVehicleForHistory.odometroRastreador.toLocaleString('pt-BR')} km` : 'Pendente'}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Horímetro: <strong className="font-mono text-slate-700">{selectedVehicleForHistory.horimetro || Math.round((selectedVehicleForHistory.odometroEstimado || selectedVehicleForHistory.odometroAtual) / 32)} h</strong>
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedVehicleForHistory(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 rounded-lg hover:bg-slate-100 transition-colors"
                title="Fechar"
              >
                ✕
              </button>
            </div>

            {/* Metrics Bar & Service History */}
            {(() => {
              const cleanTargetPlaca = selectedVehicleForHistory.placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
              const allLogs = services || storage.getServices();
              const vehicleServices = allLogs
                .filter(s => s.placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === cleanTargetPlaca)
                .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

              const totalGasto = vehicleServices.reduce((sum, s) => sum + (s.valorTotal || 0), 0);
              const totalPecas = vehicleServices.reduce((sum, s) => sum + (s.valorPecas || 0), 0);
              const totalMaoDeObra = vehicleServices.reduce((sum, s) => sum + (s.valorMaoDeObra || 0), 0);
              const lastService = vehicleServices[0];

              return (
                <div className="space-y-5">
                  {/* Summary KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-sky-50/80 border border-sky-200 p-3.5 rounded-xl space-y-1">
                      <span className="text-[10px] font-bold uppercase text-sky-700 block">Total Investido</span>
                      <span className="font-extrabold text-[#0F2744] text-base sm:text-lg font-mono block">
                        R$ {totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {vehicleServices.length} {vehicleServices.length === 1 ? 'ordem de serviço' : 'ordens de serviço'}
                      </span>
                    </div>

                    <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-xl space-y-1">
                      <span className="text-[10px] font-bold uppercase text-emerald-700 block">Peças &amp; Insumos</span>
                      <span className="font-extrabold text-emerald-950 text-base sm:text-lg font-mono block">
                        R$ {totalPecas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">Filtros, fluidos e peças</span>
                    </div>

                    <div className="bg-blue-50/80 border border-blue-200 p-3.5 rounded-xl space-y-1">
                      <span className="text-[10px] font-bold uppercase text-blue-700 block">Mão de Obra</span>
                      <span className="font-extrabold text-blue-950 text-base sm:text-lg font-mono block">
                        R$ {totalMaoDeObra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">Serviços especializados</span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1">
                      <span className="text-[10px] font-bold uppercase text-slate-600 block">Última Parada</span>
                      <span className="font-bold text-slate-800 text-xs sm:text-sm block truncate">
                        {lastService ? lastService.data.split('-').reverse().join('/') : 'Nenhuma OS'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono font-medium">
                        {lastService ? `${lastService.odometro.toLocaleString()} km` : 'Aguardando serviço'}
                      </span>
                    </div>
                  </div>

                  {/* Actions Header Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                        <History className="w-4 h-4 text-sky-600" />
                        <span>Histórico Completo de Manutenções da Frota</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Registro cronológico de paradas preventivas, corretivas e diagnósticos técnicos.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        const targetPlate = selectedVehicleForHistory.placa;
                        setSelectedVehicleForHistory(null);
                        onNavigateToAI(targetPlate);
                      }}
                      className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-xs shrink-0 active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Lançar Manutenção com IA</span>
                    </button>
                  </div>

                  {/* History List */}
                  {vehicleServices.length === 0 ? (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto shadow-2xs">
                        <Wrench className="w-7 h-7" />
                      </div>
                      <h5 className="font-bold text-slate-800 text-sm">
                        Nenhuma ordem de serviço cadastrada para este veículo
                      </h5>
                      <p className="text-slate-500 text-xs max-w-md mx-auto leading-relaxed">
                        Ao lançar revisões, notas fiscais ou relatos de manutenção no menu de IA, todo o histórico ficará gravado e consolidado aqui.
                      </p>
                      <button
                        onClick={() => {
                          const targetPlate = selectedVehicleForHistory.placa;
                          setSelectedVehicleForHistory(null);
                          onNavigateToAI(targetPlate);
                        }}
                        className="bg-[#0F2744] hover:bg-[#1E3A5F] text-white font-bold px-4 py-2.5 rounded-lg inline-flex items-center gap-2 text-xs transition-colors shadow-sm"
                      >
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Registrar Primeiro Serviço para {selectedVehicleForHistory.placa}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3.5 max-h-[50vh] overflow-y-auto pr-1">
                      {vehicleServices.map((service, idx) => (
                        <div
                          key={service.id || idx}
                          className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs hover:border-sky-300 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-black text-slate-900 text-xs sm:text-sm">
                                {service.data.split('-').reverse().join('/')}
                              </span>
                              <span className="bg-slate-100 text-slate-700 font-mono text-[11px] px-2 py-0.5 rounded font-bold">
                                {service.odometro.toLocaleString()} km
                              </span>
                              <span
                                className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
                                  service.tipo === 'OLEO'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : service.tipo === 'PNEU'
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                    : service.tipo === 'MECANICA'
                                    ? 'bg-red-100 text-red-900 border border-red-200'
                                    : service.tipo === 'ELETRICA'
                                    ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                    : 'bg-purple-100 text-purple-900 border border-purple-200'
                                }`}
                              >
                                {service.tipo}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-[11px] text-slate-500">
                                Oficina: <strong className="text-slate-800">{service.fornecedor}</strong>
                              </span>
                              <span className="font-extrabold text-emerald-700 font-mono text-sm sm:text-base">
                                R$ {service.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          {/* Description */}
                          <p className="text-slate-700 text-xs leading-relaxed">
                            {service.observacoes}
                          </p>

                          {/* Items Breakdown */}
                          {(service.pecas?.length > 0 || service.servicos?.length > 0) && (
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 space-y-2 text-[11px]">
                              {service.pecas?.length > 0 && (
                                <div>
                                  <span className="font-bold text-slate-700 block mb-1">Peças e Insumos Substituídos:</span>
                                  <div className="space-y-1">
                                    {service.pecas.map((p, pIdx) => (
                                      <div key={pIdx} className="flex justify-between text-slate-600">
                                        <span>• {p.descricao} ({p.quantidade}x)</span>
                                        <span className="font-mono font-medium">R$ {p.total.toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {service.servicos?.length > 0 && (
                                <div className="pt-1.5 border-t border-slate-200/70">
                                  <span className="font-bold text-slate-700 block mb-1">Mão de Obra Realizada:</span>
                                  <div className="space-y-1">
                                    {service.servicos.map((s, sIdx) => (
                                      <div key={sIdx} className="flex justify-between text-slate-600">
                                        <span>• {s.descricao}</span>
                                        <span className="font-mono font-medium">R$ {s.valor.toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Next revision prediction & AI note */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-sky-600" />
                              <span>
                                Próxima Parada Estimada: <strong className="text-slate-800">{service.proximaRevisaoKm.toLocaleString()} km</strong> ({service.proximaRevisaoData.split('-').reverse().join('/')})
                              </span>
                            </div>

                            {service.recomendacaoIA && (
                              <div className="flex items-center gap-1 text-sky-900 bg-sky-50 px-2.5 py-1 rounded-md font-medium border border-sky-100">
                                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span className="truncate max-w-sm" title={service.recomendacaoIA}>
                                  {service.recomendacaoIA}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Modal Footer */}
            <div className="flex items-center justify-end pt-3 border-t">
              <button
                type="button"
                onClick={() => setSelectedVehicleForHistory(null)}
                className="px-5 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors shadow-2xs"
              >
                Fechar Histórico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fleet Monthly FIPE Update Modal */}
      {showFleetFipeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl max-w-5xl w-full p-5 sm:p-7 space-y-5 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto text-xs animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b pb-4 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#0F2744] text-base sm:text-lg flex items-center gap-2">
                    <span>Atualização Mensal da Tabela FIPE da Frota</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-emerald-300">
                      API Oficial Parallelum
                    </span>
                  </h3>
                  <p className="text-slate-600 text-xs mt-0.5">
                    Atualize os valores venais dos veículos da frota uma vez por mês para manter os cálculos de IPVA no Pará (SEFA-PA) e o patrimônio da empresa 100% alinhados com o mercado.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowFleetFipeModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Actions Bar & Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-800 text-xs sm:text-sm">
                    {fleetFipeSummary?.mesReferencia ? `Mês de Referência Vigente: ${fleetFipeSummary.mesReferencia}` : 'Sincronização Mensal em Lote'}
                  </span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  {vehicles.length} veículo(s) cadastrado(s) na frota aptos para consulta.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExecuteFleetFipeSync}
                  disabled={isSyncingFleetFipe || vehicles.length === 0}
                  className="bg-[#0F2744] hover:bg-[#1E3A5F] text-white font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncingFleetFipe ? 'animate-spin' : ''}`} />
                  <span>{isSyncingFleetFipe ? 'Consultando Tabela FIPE...' : 'Consultar Valores FIPE Agora'}</span>
                </button>
              </div>
            </div>

            {/* Success Alert if applied */}
            {fleetFipeSuccessMsg && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="font-bold text-xs">{fleetFipeSuccessMsg}</span>
              </div>
            )}

            {/* Summary Metrics */}
            {fleetFipeSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-700">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Veículos Processados</span>
                  <span className="font-black text-slate-900 text-lg font-mono">{fleetFipeSummary.totalProcessados}</span>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Localizados na FIPE</span>
                  <span className="font-black text-emerald-800 text-lg font-mono">{fleetFipeSummary.atualizadosCount}</span>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-sky-200 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-sky-700 block">Mês de Referência</span>
                  <span className="font-bold text-sky-900 text-sm truncate block">{fleetFipeSummary.mesReferencia || 'Vigente'}</span>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Patrimônio Total FIPE</span>
                  <span className="font-black text-[#0F2744] text-lg font-mono">
                    R$ {Number(fleetFipeSummary.valorTotalFrotaFipe || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            {/* Comparison Table */}
            {fleetFipeResults && fleetFipeResults.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                        <th className="py-2.5 px-3">Veículo / Placa</th>
                        <th className="py-2.5 px-3">Cód. FIPE</th>
                        <th className="py-2.5 px-3">Valor Anterior</th>
                        <th className="py-2.5 px-3">Novo Valor FIPE</th>
                        <th className="py-2.5 px-3">Variação</th>
                        <th className="py-2.5 px-3">IPVA PA Estimado</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {fleetFipeResults.map((item, i) => {
                        const diff = item.valorNovo - item.valorAnterior;
                        const pct = item.valorAnterior > 0 ? ((diff / item.valorAnterior) * 100).toFixed(1) : '0';
                        const isIncrease = diff > 0;
                        const isDecrease = diff < 0;
                        const isPasseio = !item.categoria || item.categoria === 'PASSEIO';
                        const aliquota = isPasseio ? 0.025 : 0.01;
                        const ipvaEstimado = item.valorNovo * aliquota;

                        return (
                          <tr key={item.id || i} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <LicensePlateBadge placa={item.placa} size="sm" />
                                <div>
                                  <span className="font-bold text-slate-800 block truncate max-w-[180px]">{item.modelo}</span>
                                </div>
                              </div>
                            </td>

                            <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">
                              {item.codigoFipe || 'N/A'}
                            </td>

                            <td className="py-2.5 px-3 font-mono text-slate-500">
                              R$ {item.valorAnterior.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>

                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                              R$ {item.valorNovo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>

                            <td className="py-2.5 px-3 font-mono">
                              {diff === 0 ? (
                                <span className="text-slate-400 font-medium">0.0% (R$ 0,00)</span>
                              ) : isDecrease ? (
                                <span className="text-emerald-700 font-bold">
                                  {pct}% (-R$ {Math.abs(diff).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                                </span>
                              ) : (
                                <span className="text-amber-700 font-bold">
                                  +{pct}% (+R$ {diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-3">
                              <div className="font-mono font-bold text-slate-800">
                                R$ {ipvaEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                              <span className="text-[10px] text-slate-500">
                                Alíquota {aliquota * 100}% SEFA-PA
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-right">
                              {item.status === 'OK' ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">
                                  <Check className="w-3 h-3" />
                                  <span>Atualizado</span>
                                </span>
                              ) : (
                                <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full text-[10px]">
                                  {item.status || 'Pendente'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
              <span className="text-slate-500 text-[11px]">
                * Os novos valores de tabela FIPE atualizam a base venal utilizada para apuração e baixa do IPVA DETRAN-PA.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFleetFipeModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  Fechar
                </button>

                <button
                  type="button"
                  onClick={handleApplyFleetFipeSync}
                  disabled={!fleetFipeResults || fleetFipeResults.length === 0 || isSyncingFleetFipe}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Aplicar Novos Valores à Frota</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Service Entry Modal */}
      <ManualServiceModal
        isOpen={showManualServiceModal}
        onClose={() => {
          setShowManualServiceModal(false);
          setManualServicePlaca('');
        }}
        vehicles={vehicles}
        initialPlaca={manualServicePlaca}
        onServiceAdded={(newSrv) => {
          onVehiclesUpdated();
          if (onServiceAdded) onServiceAdded(newSrv);
        }}
        onSendChatwootAlert={onSendChatwootAlert}
      />
    </div>
  );
};
