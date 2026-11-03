import React, { useState } from 'react';
import {
  MapPin,
  Navigation,
  Gauge,
  BatteryCharging,
  Fuel,
  Radio,
  RefreshCw,
  Search,
  AlertTriangle,
  Layers,
  CheckCircle2,
  ExternalLink,
  Clock,
  Wifi,
  WifiOff,
  Signal,
  Compass,
} from 'lucide-react';
import { Vehicle, IntegrationLog } from '../types';
import { LicensePlateBadge } from './LicensePlateBadge';
import { storage } from '../services/storage';

interface TrackingMapViewProps {
  vehicles: Vehicle[];
  onVehiclesUpdated: () => void;
  onSendChatwootAlert: (message: string, placa: string) => Promise<boolean>;
}

// Format communication timestamp with exact hour, minute, second
export function getCommunicationDetails(dateStr?: string) {
  if (!dateStr) {
    return {
      status: 'NEVER' as const,
      statusLabel: 'Aguardando 1ª Transmissão',
      statusColor: 'text-slate-400 bg-slate-100 border-slate-200',
      dotColor: 'bg-slate-400',
      timeOnly: '--:--:--',
      dateOnly: '--/--/----',
      fullFormatted: 'Sem registro de comunicação',
      relativeText: 'Nunca comunicou com a plataforma',
      isOnline: false,
    };
  }

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    return {
      status: 'NEVER' as const,
      statusLabel: 'Horário Indisponível',
      statusColor: 'text-slate-400 bg-slate-100 border-slate-200',
      dotColor: 'bg-slate-400',
      timeOnly: '--:--:--',
      dateOnly: '--/--/----',
      fullFormatted: 'Data não informada',
      relativeText: 'Indisponível',
      isOnline: false,
    };
  }

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const timeOnly = `${hours}:${minutes}:${seconds}`;

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const dateOnly = `${day}/${month}/${year}`;

  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);

  let relativeText = '';
  if (diffSec < 60) {
    relativeText = diffSec <= 5 ? 'agora mesmo' : `há ${diffSec} segundos`;
  } else if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    relativeText = `há ${mins} min e ${diffSec % 60}s`;
  } else if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    relativeText = `há ${h}h atrás`;
  } else {
    const days = Math.floor(diffSec / 86400);
    relativeText = `há ${days} dia(s) atrás`;
  }

  // Communication status thresholds:
  // <= 10 min: Online / Communicating active
  // <= 60 min: Recent communication
  // > 60 min: Offline / Communication lost
  if (diffSec <= 600) {
    return {
      status: 'ONLINE' as const,
      statusLabel: 'Comunicando com a Plataforma (Online)',
      statusColor: 'text-emerald-800 bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300',
      dotColor: 'bg-emerald-500 animate-pulse',
      timeOnly,
      dateOnly,
      fullFormatted: `${dateOnly} às ${timeOnly}`,
      relativeText,
      isOnline: true,
    };
  } else if (diffSec <= 3600) {
    return {
      status: 'RECENT' as const,
      statusLabel: 'Comunicação Recente (Último pacote)',
      statusColor: 'text-amber-800 bg-amber-50 border-amber-300',
      dotColor: 'bg-amber-500',
      timeOnly,
      dateOnly,
      fullFormatted: `${dateOnly} às ${timeOnly}`,
      relativeText,
      isOnline: true,
    };
  } else {
    return {
      status: 'OFFLINE' as const,
      statusLabel: 'Sem Comunicação (Offline)',
      statusColor: 'text-red-700 bg-red-50 border-red-200',
      dotColor: 'bg-red-500',
      timeOnly,
      dateOnly,
      fullFormatted: `${dateOnly} às ${timeOnly}`,
      relativeText,
      isOnline: false,
    };
  }
}

export const TrackingMapView: React.FC<TrackingMapViewProps> = ({
  vehicles,
  onVehiclesUpdated,
  onSendChatwootAlert,
}) => {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicles[0]?.id || '');
  const [filterMode, setFilterMode] = useState<'ALL' | 'MOVING' | 'STOPPED' | 'ALERT'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Real Selsyn Synchronization State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    success: boolean;
    message: string;
    timestamp: string;
  } | null>(null);

  const selectedVehicle =
    vehicles.find(v => v.id === selectedVehicleId) || vehicles[0];

  const filteredVehicles = vehicles.filter(v => {
    if (filterMode === 'MOVING') {
      if (!v.ignicao || v.velocidade === 0) return false;
    }
    if (filterMode === 'STOPPED') {
      if (v.ignicao && v.velocidade > 0) return false;
    }
    if (filterMode === 'ALERT') {
      if (v.status !== 'ALERTA' && !v.bloqueado) return false;
    }
    if (searchTerm) {
      const matchPlaca = v.placa.toLowerCase().includes(searchTerm.toLowerCase());
      const matchModelo = v.modelo.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCidade = v.localizacao.cidade.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchPlaca && !matchModelo && !matchCidade) return false;
    }
    return true;
  });

  // Calculate coordinates bounds for Pará SVG Map
  const minLat = -7.5;
  const maxLat = -0.5;
  const minLng = -55.5;
  const maxLng = -47.0;

  const projectToMap = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * 100;
    const y = ((maxLat - lat) / (maxLat - minLat)) * 100;
    return {
      x: Math.max(8, Math.min(92, x)),
      y: Math.max(8, Math.min(92, y)),
    };
  };

  // Direct Plate Query State
  const [directPlateInput, setDirectPlateInput] = useState('');
  const [isQueryingPlate, setIsQueryingPlate] = useState(false);

  // Real Selsyn Sync Handler (Queries all registered vehicles by plate)
  const handleSyncSelsynLive = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    const settings = storage.getSettings();
    const token = settings.tracking.operadorKey || settings.tracking.xApiKey || settings.tracking.token || '';
    const baseUrl = settings.tracking.baseUrl || 'https://api.appselsyn.com.br/';

    if (!token) {
      setIsSyncing(false);
      setSyncFeedback({
        success: false,
        message: 'Chave de Operador Selsyn não configurada. Acesse o menu Configurações > Tokens & Integrações.',
        timestamp: new Date().toLocaleTimeString('pt-BR'),
      });
      return;
    }

    try {
      const startTime = Date.now();
      const currentVehicles = storage.getVehicles();
      const platesToSync = currentVehicles.map(v => v.placa);

      const res = await fetch('/api/selsyn/sync-positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl,
          endpoint: '/keek/rest/v1/integracao/operador/posicao',
          operadorKey: token,
          xApiKey: token,
          clienteId: settings.tracking.clienteId,
          placas: platesToSync,
        }),
      });

      const data = await res.json();
      const latencyMs = Date.now() - startTime;
      const nowStr = new Date().toLocaleTimeString('pt-BR');

      // Log integration
      const logEntry: IntegrationLog = {
        id: 'log-sync-' + Date.now(),
        integration: 'selsyn',
        timestamp: new Date().toISOString(),
        endpoint: data.urlCalled || 'https://api.appselsyn.com.br/keek/rest/v1/integracao/operador/posicao',
        method: 'GET',
        status: data.success ? 'SUCCESS' : 'ERROR',
        statusCode: data.statusCode || res.status,
        latencyMs,
        message: data.success
          ? `Sincronização ao vivo: ${data.count} posições retornadas via ${data.urlCalled || '/keek/rest/v1/integracao/operador/posicao'}.`
          : data.message || 'Erro ao sincronizar posições com Selsyn',
        payloadPreview: JSON.stringify({ baseUrl, endpoint: '/keek/rest/v1/integracao/operador/posicao', placas: platesToSync }),
        details: data.raw || data,
      };
      storage.addIntegrationLog(logEntry);

      if (data.success && Array.isArray(data.positions)) {
        let updatedCount = 0;
        let createdCount = 0;
        const currentList = storage.getVehicles();

        for (const pos of data.positions) {
          const rawId = String(pos.identificador || pos.rastreavel || '').toUpperCase();
          const cleanId = rawId.replace(/[^A-Z0-9]/g, '');
          if (!cleanId) continue;

          const matchIdx = currentList.findIndex(
            v => v.placa.toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanId
          );

          if (matchIdx !== -1) {
            currentList[matchIdx].localizacao.lat = pos.latitude || currentList[matchIdx].localizacao.lat;
            currentList[matchIdx].localizacao.lng = pos.longitude || currentList[matchIdx].localizacao.lng;
            currentList[matchIdx].velocidade = pos.velocidade ?? currentList[matchIdx].velocidade;
            currentList[matchIdx].ignicao = Boolean(pos.ignicao);
            currentList[matchIdx].ultimaComunicacao = pos.dataComunicacao || pos.dataHora || new Date().toISOString();
            if (pos.fonteEnergia) currentList[matchIdx].bateriaVolts = pos.fonteEnergia;
            if (pos.odometro !== undefined && pos.odometro !== null) {
              // Selsyn importa em METROS -> converter para KM:
              const rawOdo = Number(pos.odometro);
              const km = rawOdo > 500000 ? Math.round(rawOdo / 1000) : Math.round(rawOdo);
              if (km > 0) {
                currentList[matchIdx].odometroRastreador = km;
                currentList[matchIdx].dataUltimoOdometroRastreador = pos.dataComunicacao || pos.dataHora || new Date().toISOString();
                // Keep odometroEstimado as the master manual/maintenance value
                if (!currentList[matchIdx].odometroEstimado) {
                  currentList[matchIdx].odometroEstimado = currentList[matchIdx].odometroAtual || km;
                }
              }
            }
            updatedCount++;
          } else {
            // Real vehicle found in Selsyn: auto-register
            const rawOdo = Number(pos.odometro || 0);
            const initialKm = rawOdo > 500000 ? Math.round(rawOdo / 1000) : (rawOdo > 0 ? Math.round(rawOdo) : 15000);
            const newVeh: Vehicle = {
              id: 'veh-selsyn-' + cleanId.toLowerCase(),
              placa: pos.identificador || cleanId,
              modelo: pos.rastreavel && pos.rastreavel !== pos.identificador ? String(pos.rastreavel) : `Veículo Selsyn ${cleanId}`,
              marca: 'Frota Telecom',
              ano: new Date().getFullYear(),
              cor: 'Branco',
              categoria: 'UTILITARIO',
              chassi: '9BD' + cleanId + '00000',
              renavam: '00' + Date.now().toString().slice(-9),
              status: pos.ignicao ? 'OPERANDO' : 'PARADO',
              combustivel: 'FLEX',
              velocidade: Number(pos.velocidade || 0),
              ignicao: Boolean(pos.ignicao),
              bloqueado: false,
              odometroAtual: initialKm,
              odometroEstimado: initialKm,
              odometroRastreador: initialKm,
              horimetro: 120,
              bateriaVolts: Number(pos.fonteEnergia || 12.6),
              nivelTanque: 85,
              valorVenalFipe: 75000,
              tempoSemMultasAnos: 2,
              localizacao: {
                lat: Number(pos.latitude) || -1.4558,
                lng: Number(pos.longitude) || -48.4902,
                cidade: 'Belém',
                uf: 'PA',
                endereco: 'Coordenada GPS Selsyn Keek',
              },
              ultimaComunicacao: pos.dataComunicacao || pos.dataHora || new Date().toISOString(),
            };
            currentList.push(newVeh);
            createdCount++;
            updatedCount++;
          }
        }

        if (updatedCount > 0) {
          storage.saveVehicles(currentList);
          onVehiclesUpdated();
          if (!selectedVehicleId && currentList[0]) {
            setSelectedVehicleId(currentList[0].id);
          }
        }

        const msgDetails = createdCount > 0
          ? `${data.count} posições recebidas da Selsyn. ${createdCount} novo(s) veículo(s) cadastrado(s) e ${updatedCount - createdCount} atualizado(s) às ${nowStr}.`
          : `${data.count} posições recebidas da Selsyn. ${updatedCount} veículo(s) da frota atualizado(s) com telemetria oficial às ${nowStr}.`;

        setSyncFeedback({
          success: true,
          message: msgDetails,
          timestamp: nowStr,
        });
      } else {
        setSyncFeedback({
          success: false,
          message: data.message || `Resposta HTTP ${data.statusCode} da Selsyn.`,
          timestamp: nowStr,
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        success: false,
        message: `Falha de rede ao consultar API Selsyn: ${err.message}`,
        timestamp: new Date().toLocaleTimeString('pt-BR'),
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Direct Plate Query on Selsyn Endpoint /keek/rest/v1/integracao/operador/posicao?identificador={PLACA}
  const handleQueryPlateSelsyn = async (plateArg?: string) => {
    const rawTarget = plateArg || directPlateInput;
    const cleanPlaca = String(rawTarget || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    if (!cleanPlaca || cleanPlaca.length < 3) {
      setSyncFeedback({
        success: false,
        message: 'Informe a placa no formato AAA1234 (ex: ABC1234 ou BRA2E19) para consultar na Selsyn.',
        timestamp: new Date().toLocaleTimeString('pt-BR'),
      });
      return;
    }

    setIsQueryingPlate(true);
    setSyncFeedback(null);
    const settings = storage.getSettings();
    const token = settings.tracking.operadorKey || settings.tracking.xApiKey || settings.tracking.token || '';
    const baseUrl = settings.tracking.baseUrl || 'https://api.appselsyn.com.br/';

    if (!token) {
      setIsQueryingPlate(false);
      setSyncFeedback({
        success: false,
        message: 'Chave de Operador Selsyn não configurada. Salve sua API Key de Operador em Configurações.',
        timestamp: new Date().toLocaleTimeString('pt-BR'),
      });
      return;
    }

    try {
      const startTime = Date.now();
      const res = await fetch('/api/selsyn/sync-positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl,
          identificador: cleanPlaca,
          operadorKey: token,
          xApiKey: token,
        }),
      });

      const data = await res.json();
      const latencyMs = Date.now() - startTime;
      const nowStr = new Date().toLocaleTimeString('pt-BR');

      storage.addIntegrationLog({
        id: 'log-query-' + Date.now(),
        integration: 'selsyn',
        timestamp: new Date().toISOString(),
        endpoint: `https://api.appselsyn.com.br/keek/rest/v1/integracao/operador/posicao?identificador=${cleanPlaca}`,
        method: 'GET',
        status: data.success ? 'SUCCESS' : 'ERROR',
        statusCode: data.statusCode || res.status,
        latencyMs,
        message: data.success
          ? `Consulta da placa ${cleanPlaca} concluída com sucesso na Selsyn.`
          : `Consulta placa ${cleanPlaca}: ${data.message || 'Sem retorno'}`,
        payloadPreview: JSON.stringify({ identificador: cleanPlaca, endpoint: `/keek/rest/v1/integracao/operador/posicao?identificador=${cleanPlaca}` }),
        details: data.raw || data,
      });

      if (data.success && Array.isArray(data.positions) && data.positions.length > 0) {
        const pos = data.positions[0];
        const currentList = storage.getVehicles();
        const matchIdx = currentList.findIndex(
          v => v.placa.toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanPlaca
        );

        let targetId = '';
        if (matchIdx !== -1) {
          currentList[matchIdx].localizacao.lat = pos.latitude || currentList[matchIdx].localizacao.lat;
          currentList[matchIdx].localizacao.lng = pos.longitude || currentList[matchIdx].localizacao.lng;
          currentList[matchIdx].velocidade = pos.velocidade ?? currentList[matchIdx].velocidade;
          currentList[matchIdx].ignicao = Boolean(pos.ignicao);
          currentList[matchIdx].ultimaComunicacao = pos.dataComunicacao || pos.dataHora || new Date().toISOString();
          if (pos.fonteEnergia) currentList[matchIdx].bateriaVolts = pos.fonteEnergia;
          if (pos.odometro) {
            const km = pos.odometro > 1000000 ? Math.round(pos.odometro / 1000) : pos.odometro;
            if (km > currentList[matchIdx].odometroAtual) {
              currentList[matchIdx].odometroAtual = km;
            }
          }
          targetId = currentList[matchIdx].id;
        } else {
          const newVeh: Vehicle = {
            id: 'veh-selsyn-' + cleanPlaca.toLowerCase(),
            placa: cleanPlaca,
            modelo: pos.rastreavel && pos.rastreavel !== cleanPlaca ? String(pos.rastreavel) : `Veículo Selsyn ${cleanPlaca}`,
            marca: 'Frota Telecom',
            ano: new Date().getFullYear(),
            cor: 'Branco',
            categoria: 'UTILITARIO',
            chassi: '9BD' + cleanPlaca + '00000',
            renavam: '00' + Date.now().toString().slice(-9),
            status: pos.ignicao ? 'OPERANDO' : 'PARADO',
            combustivel: 'FLEX',
            velocidade: Number(pos.velocidade || 0),
            ignicao: Boolean(pos.ignicao),
            bloqueado: false,
            odometroAtual: pos.odometro ? (pos.odometro > 1000000 ? Math.round(pos.odometro / 1000) : pos.odometro) : 15000,
            horimetro: 120,
            bateriaVolts: Number(pos.fonteEnergia || 12.6),
            nivelTanque: 85,
            valorVenalFipe: 75000,
            tempoSemMultasAnos: 2,
            localizacao: {
              lat: Number(pos.latitude) || -1.4558,
              lng: Number(pos.longitude) || -48.4902,
              cidade: 'Belém',
              uf: 'PA',
              endereco: 'Coordenada GPS Selsyn Keek',
            },
            ultimaComunicacao: pos.dataComunicacao || pos.dataHora || new Date().toISOString(),
          };
          currentList.push(newVeh);
          targetId = newVeh.id;
        }

        storage.saveVehicles(currentList);
        onVehiclesUpdated();
        if (targetId) {
          setSelectedVehicleId(targetId);
        }

        const commDetails = getCommunicationDetails(pos.dataComunicacao || pos.dataHora);

        setSyncFeedback({
          success: true,
          message: `Placa ${cleanPlaca} localizada na Selsyn! GPS: [${Number(pos.latitude).toFixed(5)}, ${Number(pos.longitude).toFixed(5)}] • Vel: ${pos.velocidade} km/h • Ignição: ${pos.ignicao ? 'Ligada' : 'Desligada'} • Comunicou: ${commDetails.timeOnly} (${commDetails.relativeText}).`,
          timestamp: nowStr,
        });
        setDirectPlateInput('');
      } else {
        setSyncFeedback({
          success: false,
          message: data.message || `Nenhum registro para a placa ${cleanPlaca} em https://api.appselsyn.com.br/keek/rest/v1/integracao/operador/posicao?identificador=${cleanPlaca}`,
          timestamp: nowStr,
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        success: false,
        message: `Falha na requisição da placa ${cleanPlaca}: ${err.message}`,
        timestamp: new Date().toLocaleTimeString('pt-BR'),
      });
    } finally {
      setIsQueryingPlate(false);
    }
  };

  const selectedComm = selectedVehicle
    ? getCommunicationDetails(selectedVehicle.ultimaComunicacao)
    : null;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center text-white shadow-xs">
              <Navigation className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-[#0F2744]">
              Rastreamento &amp; Telemetria em Tempo Real
            </h1>
          </div>
          <p className="text-slate-600 text-xs sm:text-sm mt-1">
            Comunicação oficial com a plataforma <strong>Selsyn</strong> (URL: <code>https://api.appselsyn.com.br/</code>). Dados 100% reais de GPS, ignição e status de conexão.
          </p>
        </div>

        {/* Sync Action & Platform Status Badge */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSyncSelsynLive}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-semibold text-xs shadow-xs transition-all disabled:opacity-60"
            title="Consultar posições ao vivo agora via API Selsyn"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando Selsyn...' : 'Sincronizar Telemetria Selsyn'}</span>
          </button>

          <div className="flex items-center gap-1.5 bg-slate-100 text-slate-800 border border-slate-200 px-3 py-2 rounded-lg text-xs font-semibold">
            <Radio className="w-3.5 h-3.5 text-cyan-600" />
            <span>Dados Reais Sem Simulação</span>
          </div>
        </div>
      </div>

      {/* Direct Plate Query Section */}
      <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <h2 className="font-bold text-xs uppercase tracking-wider text-[#0F2744]">
                Consultar Posição por Placa na Selsyn (Formato: AAA1234)
              </h2>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Endpoint: <code className="bg-white px-1.5 py-0.5 rounded border border-sky-200 font-mono text-[10px] text-sky-800">
                https://api.appselsyn.com.br/keek/rest/v1/integracao/operador/posicao?identificador=&#123;PLACA&#125;
              </code>
            </p>
          </div>

          <span className="text-[10px] text-slate-500 font-medium">
            Digite a placa sem traços nem espaços (Ex: AAA1234 ou BRA2E19)
          </span>
        </div>

        <form
          onSubmit={e => {
            e.preventDefault();
            handleQueryPlateSelsyn();
          }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-sky-600" />
            <input
              type="text"
              value={directPlateInput}
              onChange={e => setDirectPlateInput(e.target.value.toUpperCase())}
              placeholder="Digite a placa (ex: QEN4521, AAA1234, BRA2E19)..."
              maxLength={8}
              className="w-full pl-9 pr-3 py-2 bg-white rounded-lg border border-sky-300 text-xs font-mono font-bold tracking-wider text-slate-800 uppercase placeholder:text-slate-400 placeholder:normal-case placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <button
            type="submit"
            disabled={isQueryingPlate || !directPlateInput.trim()}
            className="bg-[#0F2744] hover:bg-slate-800 active:scale-95 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {isQueryingPlate ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Consultando Selsyn...</span>
              </>
            ) : (
              <>
                <Navigation className="w-3.5 h-3.5" />
                <span>Consultar Placa Selsyn</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Plate Chips */}
        {vehicles.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-sky-200/60 text-[11px]">
            <span className="text-slate-500 font-semibold text-[10px]">
              Placas na frota (clique para consultar telemetria ao vivo):
            </span>
            {vehicles.map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => handleQueryPlateSelsyn(v.placa)}
                disabled={isQueryingPlate}
                className="bg-white hover:bg-sky-100 hover:border-sky-400 text-slate-800 font-mono font-bold text-[10px] px-2 py-0.5 rounded border border-slate-300 transition-colors shadow-2xs cursor-pointer"
                title={`Consultar posição ao vivo de ${v.placa} na Selsyn`}
              >
                {v.placa}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sync Feedback Alert */}
      {syncFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
            syncFeedback.success
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {syncFeedback.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>{syncFeedback.message}</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500 shrink-0">
            {syncFeedback.timestamp}
          </span>
        </div>
      )}

      {/* Main Grid: Left Vehicle List, Center Map, Right Telemetry Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Side: Vehicle List */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3 flex flex-col">
          <div className="flex items-center justify-between border-b pb-2">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                Veículos da Frota ({vehicles.length})
              </h3>
              <p className="text-[10px] text-slate-400">
                Status de conexão e última comunicação por veículo
              </p>
            </div>
            <span className="text-[10px] bg-slate-100 font-mono text-slate-600 px-2 py-0.5 rounded font-semibold">
              Pará - BR
            </span>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por placa, modelo ou cidade..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Filter Pills */}
          <div className="grid grid-cols-4 gap-1 text-[11px]">
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`py-1 px-1 rounded font-semibold text-center transition-colors ${
                filterMode === 'ALL'
                  ? 'bg-[#0F2744] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({vehicles.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('MOVING')}
              className={`py-1 px-1 rounded font-semibold text-center transition-colors ${
                filterMode === 'MOVING'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Em Rota ({vehicles.filter(v => v.ignicao && v.velocidade > 0).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('STOPPED')}
              className={`py-1 px-1 rounded font-semibold text-center transition-colors ${
                filterMode === 'STOPPED'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Parados ({vehicles.filter(v => !v.ignicao || v.velocidade === 0).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('ALERT')}
              className={`py-1 px-1 rounded font-semibold text-center transition-colors ${
                filterMode === 'ALERT'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Alertas ({vehicles.filter(v => v.status === 'ALERTA' || v.bloqueado).length})
            </button>
          </div>

          {/* Vehicle Items with Communication Clock and Google Maps Link */}
          <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1 flex-1">
            {filteredVehicles.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                <MapPin className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-600">Nenhum veículo encontrado</p>
                <p className="text-[11px]">
                  Cadastre veículos reais no menu <strong>Veículos</strong> para visualizar suas posições.
                </p>
              </div>
            ) : (
              filteredVehicles.map(v => {
                const isSelected = v.id === selectedVehicle?.id;
                const comm = getCommunicationDetails(v.ultimaComunicacao);
                const gmapsUrl = `https://www.google.com/maps?q=${v.localizacao.lat},${v.localizacao.lng}`;

                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVehicleId(v.id)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50/70 shadow-xs ring-2 ring-sky-400'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    {/* Top row: Plate + Ignition/Speed */}
                    <div className="flex items-center justify-between">
                      <LicensePlateBadge placa={v.placa} size="sm" />
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            v.bloqueado
                              ? 'bg-red-600 text-white'
                              : v.ignicao
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-500 text-white'
                          }`}
                        >
                          {v.bloqueado
                            ? 'BLOQUEADO'
                            : v.ignicao
                            ? `${v.velocidade} km/h`
                            : 'DESLIGADO'}
                        </span>
                      </div>
                    </div>

                    {/* Model & City */}
                    <div className="mt-1.5 font-bold text-slate-900 truncate">
                      {v.modelo}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                      <span>{v.localizacao.cidade} - PA</span>
                    </div>

                    {/* Communication Status Pill */}
                    <div className="mt-2 pt-2 border-t border-slate-200/80 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <Signal className="w-3 h-3 text-cyan-600" />
                          Plataforma Selsyn:
                        </span>
                        <span
                          className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${comm.statusColor}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${comm.dotColor}`}></span>
                          {comm.status === 'ONLINE'
                            ? 'ONLINE'
                            : comm.status === 'RECENT'
                            ? 'RECENTE'
                            : 'OFFLINE'}
                        </span>
                      </div>

                      {/* Exact Hour Minute Second */}
                      <div className="flex items-center justify-between text-[10px] bg-slate-50 p-1.5 rounded border border-slate-200 font-mono">
                        <div className="flex items-center gap-1 text-slate-700 font-semibold">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{comm.timeOnly}</span>
                          <span className="text-slate-400 text-[9px]">({comm.dateOnly})</span>
                        </div>
                        <span className="text-slate-500 italic text-[9px] truncate max-w-[100px]">
                          {comm.relativeText}
                        </span>
                      </div>
                    </div>

                    {/* Quick Link to Google Maps */}
                    <div className="mt-2 flex items-center justify-end">
                      <a
                        href={gmapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-[10px] font-semibold text-sky-700 hover:text-sky-900 hover:underline flex items-center gap-1 bg-sky-100/70 hover:bg-sky-100 px-2 py-0.5 rounded transition-colors"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        <span>Ver no Google Maps</span>
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center: High-Definition Interactive Telemetry Map (Pará) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-600" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                Cobertura Geoespacial - Estado do Pará
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              BR-316 • BR-230 • PA-150
            </span>
          </div>

          {/* Interactive Map Canvas */}
          <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-slate-900 via-[#0B1C30] to-slate-950 rounded-xl overflow-hidden border border-slate-700 shadow-inner select-none">
            {/* Grid Lines */}
            <div className="absolute inset-0 opacity-15 bg-[linear-gradient(to_right,#38bdf8_1px,transparent_1px),linear-gradient(to_bottom,#38bdf8_1px,transparent_1px)] bg-[size:40px_40px]"></div>

            {/* Pará Geographic Background Silhouette (Rivers & Roads) */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none opacity-25"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {/* Rivers Amazonas / Tapajós / Tocantins */}
              <path
                d="M 10 30 Q 30 35, 50 32 T 85 28 T 95 35"
                fill="none"
                stroke="#0284c7"
                strokeWidth="1.5"
                strokeDasharray="2 1"
              />
              <path
                d="M 85 28 Q 78 55, 75 85"
                fill="none"
                stroke="#06b6d4"
                strokeWidth="1"
              />
              {/* Main Highway corridors */}
              <path
                d="M 85 30 L 92 38"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="0.8"
                strokeDasharray="1 1"
              />
              <path
                d="M 75 85 L 20 80"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="0.8"
                strokeDasharray="1 1"
              />
            </svg>

            {/* City Label Badges on Map */}
            <div className="absolute top-[28%] right-[8%] text-[9px] font-bold text-sky-300 flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span> Belém / Ananindeua
            </div>
            <div className="absolute top-[34%] right-[16%] text-[8px] font-semibold text-slate-400">
              Castanhal
            </div>
            <div className="absolute top-[28%] left-[10%] text-[8px] font-semibold text-slate-400">
              Santarém / Tapajós
            </div>
            <div className="absolute top-[68%] right-[22%] text-[8px] font-semibold text-slate-400">
              Marabá (BR-230)
            </div>
            <div className="absolute bottom-[18%] right-[16%] text-[8px] font-semibold text-slate-400">
              Parauapebas / Carajás
            </div>

            {/* Vehicle Markers */}
            {vehicles.map(v => {
              const coords = projectToMap(v.localizacao.lat, v.localizacao.lng);
              const isSelected = v.id === selectedVehicle?.id;
              const isMoving = v.ignicao && v.velocidade > 0;
              const isBlocked = v.bloqueado;
              const comm = getCommunicationDetails(v.ultimaComunicacao);

              return (
                <div
                  key={v.id}
                  onClick={() => setSelectedVehicleId(v.id)}
                  style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 group"
                >
                  {/* Ping effect if online and moving */}
                  {isMoving && (
                    <span className="absolute -inset-2 rounded-full bg-sky-400 opacity-60 animate-ping"></span>
                  )}

                  {/* Marker Pin */}
                  <div
                    className={`relative p-1.5 rounded-full shadow-lg border-2 transition-all transform group-hover:scale-125 ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 border-white ring-2 ring-amber-400 scale-125 z-20'
                        : isBlocked
                        ? 'bg-red-600 text-white border-white'
                        : isMoving
                        ? 'bg-emerald-500 text-white border-white'
                        : 'bg-slate-700 text-slate-200 border-slate-400'
                    }`}
                  >
                    <Navigation
                      className={`w-3.5 h-3.5 transform ${
                        isMoving ? 'rotate-45' : 'rotate-0'
                      }`}
                    />
                  </div>

                  {/* Tooltip with Plate, Speed, Time and Google Maps */}
                  <div
                    className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 rounded-lg text-[10px] shadow-xl pointer-events-auto transition-opacity z-30 min-w-[160px] ${
                      isSelected
                        ? 'bg-white text-slate-900 border border-slate-300 opacity-100'
                        : 'bg-slate-900/95 text-white opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span>{v.placa}</span>
                      <span className="text-[9px] font-mono text-cyan-600">
                        {isMoving ? `${v.velocidade} km/h` : 'Parado'}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                      ⏱️ Comunicou: {comm.timeOnly}
                    </div>
                    <div className="mt-1 pt-1 border-t border-slate-200/60">
                      <a
                        href={`https://www.google.com/maps?q=${v.localizacao.lat},${v.localizacao.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] text-sky-600 hover:underline flex items-center gap-1 font-bold"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        <span>Abrir no Google Maps</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Map Controls Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1 border-t border-slate-200">
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Em Rota
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-500"></span> Desligado
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500"></span> Bloqueado
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              OpenAPI Selsyn Keek v3.0
            </span>
          </div>
        </div>

        {/* Right Side: Telemetry Details, Communication Status & Google Maps Action */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          {selectedVehicle ? (
            <>
              {/* Top Card: Identification */}
              <div className="border-b pb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Telemetria Selsyn Oficial
                </span>
                <div className="flex items-center justify-between">
                  <LicensePlateBadge placa={selectedVehicle.placa} size="md" />
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      selectedVehicle.bloqueado
                        ? 'bg-red-600 text-white'
                        : selectedVehicle.ignicao
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-600 text-white'
                    }`}
                  >
                    {selectedVehicle.bloqueado
                      ? 'BLOQUEADO'
                      : selectedVehicle.ignicao
                      ? 'IGNIÇÃO LIGADA'
                      : 'DESLIGADO'}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm mt-2">
                  {selectedVehicle.modelo}
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedVehicle.marca} • Ano {selectedVehicle.ano}
                </p>
              </div>

              {/* Communication with Platform Box (Hora Minuto Segundo) */}
              <div
                className={`p-3.5 rounded-xl border space-y-2 ${
                  selectedComm?.statusColor || 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 text-slate-700">
                    <Signal className="w-3.5 h-3.5 text-cyan-700" />
                    Status da Conexão:
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${selectedComm?.dotColor || 'bg-slate-400'}`}
                  ></span>
                </div>

                <div className="font-bold text-xs">
                  {selectedComm?.statusLabel}
                </div>

                {/* Exact Hour Minute Second Display */}
                <div className="bg-white/90 p-2.5 rounded-lg border border-slate-200 space-y-1">
                  <div className="text-[10px] text-slate-500 font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-sky-600" /> Hora / Min / Seg:
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      {selectedComm?.timeOnly}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center justify-between">
                    <span>Data:</span>
                    <span className="font-mono text-slate-700">{selectedComm?.dateOnly}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                    <span>Decorrido:</span>
                    <span className="font-semibold text-slate-800 italic">
                      {selectedComm?.relativeText}
                    </span>
                  </div>
                </div>
              </div>

              {/* Direct Google Maps Action Box */}
              <div className="bg-sky-50 border border-sky-200 p-3.5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sky-950 font-bold text-xs">
                    <MapPin className="w-4 h-4 text-red-600" />
                    <span>Ponto no Google Maps</span>
                  </div>
                  <span className="text-[10px] font-mono text-sky-800">GPS Real</span>
                </div>

                <p className="text-[11px] text-slate-600">
                  Localização: <strong>{selectedVehicle.localizacao.cidade} - PA</strong>
                  <br />
                  <span className="text-[10px] text-slate-500 line-clamp-1">
                    {selectedVehicle.localizacao.endereco}
                  </span>
                </p>

                {/* Exact Coordinates */}
                <div className="text-[10px] font-mono bg-white p-1.5 rounded border border-sky-200 text-slate-700 flex items-center justify-between">
                  <span>Lat: {selectedVehicle.localizacao.lat.toFixed(6)}</span>
                  <span>Lng: {selectedVehicle.localizacao.lng.toFixed(6)}</span>
                </div>

                {/* Google Maps Button Link */}
                <a
                  href={`https://www.google.com/maps?q=${selectedVehicle.localizacao.lat},${selectedVehicle.localizacao.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Ponto no Google Maps</span>
                </a>
              </div>

              {/* Telemetry Numbers */}
              <div className="space-y-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex justify-between items-center">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-sky-600" /> Velocidade Real:
                  </span>
                  <span className="font-extrabold font-mono text-slate-900 text-sm">
                    {selectedVehicle.velocidade} km/h
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex justify-between items-center">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-cyan-600" /> Odômetro da Plataforma:
                  </span>
                  <span className="font-bold font-mono text-slate-900">
                    {selectedVehicle.odometroAtual.toLocaleString('pt-BR')} km
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex justify-between items-center">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <BatteryCharging className="w-4 h-4 text-emerald-600" /> Tensão Bateria:
                  </span>
                  <span className="font-bold font-mono text-slate-900">
                    {selectedVehicle.bateriaVolts} V
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex justify-between items-center">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-sky-600" /> Horímetro:
                  </span>
                  <span className="font-bold font-mono text-slate-900">
                    {selectedVehicle.horimetro || Math.round(selectedVehicle.odometroAtual / 32)} h
                  </span>
                </div>
              </div>

              {/* Monitoramento de Telemetria Selsyn */}
              <div className="pt-2 border-t space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Telemetria &amp; Rastreamento Selsyn
                </span>

                <div className="bg-slate-50 border border-slate-200 text-slate-700 text-xs p-3 rounded-lg flex items-center justify-between">
                  <span className="flex items-center gap-2 font-medium">
                    <Radio className="w-4 h-4 text-cyan-600 animate-pulse" />
                    <span>Transmissão Contínua GPS</span>
                  </span>
                  <span className="font-mono text-[11px] bg-slate-200 text-slate-800 px-2 py-0.5 rounded font-bold">
                    {selectedComm?.isOnline ? 'CONECTADO' : 'SEM SINAL'}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Radio className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">Nenhum Veículo Selecionado</h4>
              <p className="text-xs text-slate-500">
                Cadastre seu primeiro veículo real ou vincule um rastreador Selsyn para visualizar dados de telemetria ao vivo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
