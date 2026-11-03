import React, { useState } from 'react';
import {
  Bell,
  Send,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Radio,
  Check,
  RotateCcw,
  ExternalLink,
  Filter,
  FileText,
} from 'lucide-react';
import { TelemetryAlert, Vehicle, SystemSettings, ChatwootLog, RevisionPlan, LicenciamentoPA } from '../types';
import { LicensePlateBadge } from './LicensePlateBadge';
import { storage } from '../services/storage';

interface AlertsChatwootViewProps {
  alerts: TelemetryAlert[];
  vehicles: Vehicle[];
  settings: SystemSettings;
  chatwootLogs: ChatwootLog[];
  onAlertsUpdated: () => void;
  onSendChatwootAlert: (message: string, placa: string, alertaId?: string) => Promise<boolean>;
}

export const AlertsChatwootView: React.FC<AlertsChatwootViewProps> = ({
  alerts,
  vehicles,
  settings,
  chatwootLogs,
  onAlertsUpdated,
  onSendChatwootAlert,
}) => {
  const [filterNivel, setFilterNivel] = useState<'ALL' | 'CRITICO' | 'AVISO' | 'INFO'>('ALL');
  const [filterSent, setFilterSent] = useState<'ALL' | 'PENDING' | 'SENT'>('ALL');
  const [customMessage, setCustomMessage] = useState('');
  const [selectedPlaca, setSelectedPlaca] = useState(vehicles[0]?.placa || '');
  const [isSendingCustom, setIsSendingCustom] = useState(false);
  const [customSendSuccess, setCustomSendSuccess] = useState(false);
  const [sendingAlertId, setSendingAlertId] = useState<string | null>(null);
  const [isProcessingAutoAlerts, setIsProcessingAutoAlerts] = useState(false);
  const [autoAlertStatusMsg, setAutoAlertStatusMsg] = useState<string | null>(null);

  // Client-side fallback to process automated alerts safely if backend endpoint is temporarily unreachable
  const processAlertsLocally = (
    revisions: RevisionPlan[],
    licenciaments: LicenciamentoPA[]
  ): { novosAlertas: number; duplicidades: number } => {
    let novosAlertas = 0;
    let duplicidades = 0;
    const todayPrefix = new Date().toISOString().split('T')[0];

    const isDuplicate = (placa: string, tipo: string, titulo: string): boolean => {
      return alerts.some((existing: any) => {
        if (existing.placa === placa && existing.tipo === tipo && existing.titulo === titulo) {
          const alertDate = (existing.timestamp || '').split('T')[0];
          return !existing.resolvido || alertDate === todayPrefix;
        }
        return false;
      });
    };

    // 1. Revisões preventivas
    for (const rev of revisions) {
      if (rev.excluido || rev.ativo === false) continue;
      if (rev.status === 'VENCIDO') {
        const titulo = `Revisão Vencida: ${rev.item}`;
        if (isDuplicate(rev.placa, 'REVISAO_PREVENTIVA', titulo)) {
          duplicidades++;
        } else {
          storage.addAlert({
            id: `alert_rev_venc_${rev.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toISOString(),
            veiculoId: rev.veiculoId || '',
            placa: rev.placa,
            tipo: 'REVISAO_PREVENTIVA',
            nivel: 'CRITICO',
            titulo,
            mensagem: `[ALERTA DE REVISÃO] Veículo ${rev.placa}: O plano de revisão ${rev.titulo} (${rev.item}) está VENCIDO! Quilometragem excedida em ${Math.abs(rev.kmRestantes)} km. Agende manutenção imediata.`,
            enviadoChatwoot: false,
            chatwootStatus: 'PRONTO_PARA_ENVIO',
            resolvido: false,
          });
          novosAlertas++;
        }
      } else if (rev.status === 'PROXIMO') {
        const titulo = `Revisão Próxima: ${rev.item}`;
        if (isDuplicate(rev.placa, 'REVISAO_PREVENTIVA', titulo)) {
          duplicidades++;
        } else {
          storage.addAlert({
            id: `alert_rev_prox_${rev.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toISOString(),
            veiculoId: rev.veiculoId || '',
            placa: rev.placa,
            tipo: 'REVISAO_PREVENTIVA',
            nivel: 'AVISO',
            titulo,
            mensagem: `[AVISO DE REVISÃO] Veículo ${rev.placa}: O plano de revisão ${rev.titulo} (${rev.item}) vence em ${rev.kmRestantes} km (Data estimada: ${rev.proximaData}).`,
            enviadoChatwoot: false,
            chatwootStatus: 'PRONTO_PARA_ENVIO',
            resolvido: false,
          });
          novosAlertas++;
        }
      }
    }

    // 2. Licenciamento DETRAN-PA
    for (const lic of licenciaments) {
      if (lic.pago) continue;
      if (lic.status === 'VENCIDO') {
        const titulo = `Licenciamento DETRAN-PA Vencido (${lic.exercicio})`;
        if (isDuplicate(lic.placa, 'LICENCIAMENTO_PA', titulo)) {
          duplicidades++;
        } else {
          storage.addAlert({
            id: `alert_lic_venc_${lic.placa}_${lic.exercicio}_${Date.now()}`,
            timestamp: new Date().toISOString(),
            veiculoId: lic.placa,
            placa: lic.placa,
            tipo: 'LICENCIAMENTO_PA',
            nivel: 'CRITICO',
            titulo,
            mensagem: `[DETRAN-PA] O licenciamento do veículo ${lic.placa} (Exercício ${lic.exercicio}) está VENCIDO desde ${lic.dataLimiteLicenciamento}. Evite apreensão e multas emitindo o DAE.`,
            enviadoChatwoot: false,
            chatwootStatus: 'PRONTO_PARA_ENVIO',
            resolvido: false,
          });
          novosAlertas++;
        }
      } else if (lic.status === 'VENCE_EM_BREVE') {
        const titulo = `Licenciamento Vence em Breve (${lic.exercicio})`;
        if (isDuplicate(lic.placa, 'LICENCIAMENTO_PA', titulo)) {
          duplicidades++;
        } else {
          storage.addAlert({
            id: `alert_lic_prox_${lic.placa}_${lic.exercicio}_${Date.now()}`,
            timestamp: new Date().toISOString(),
            veiculoId: lic.placa,
            placa: lic.placa,
            tipo: 'LICENCIAMENTO_PA',
            nivel: 'AVISO',
            titulo,
            mensagem: `[DETRAN-PA] Atenção: Licenciamento do veículo ${lic.placa} (Exercício ${lic.exercicio}) vence em ${lic.diasRestantes} dia(s) (Prazo: ${lic.dataLimiteLicenciamento}).`,
            enviadoChatwoot: false,
            chatwootStatus: 'PRONTO_PARA_ENVIO',
            resolvido: false,
          });
          novosAlertas++;
        }
      }
    }

    // 3. Rastreadores sem comunicação há mais de 24 horas
    const nowMs = Date.now();
    for (const v of vehicles) {
      let isOffline = false;
      if (!v.ultimaComunicacao) isOffline = true;
      else {
        const lastMs = new Date(v.ultimaComunicacao).getTime();
        if (isNaN(lastMs) || nowMs - lastMs >= 24 * 60 * 60 * 1000) isOffline = true;
      }
      if (isOffline) {
        const titulo = `Rastreador Sem Comunicação: ${v.placa}`;
        if (isDuplicate(v.placa, 'SEM_COMUNICACAO', titulo)) {
          duplicidades++;
        } else {
          storage.addAlert({
            id: `alert_off_${v.placa}_${Date.now()}`,
            timestamp: new Date().toISOString(),
            veiculoId: v.id,
            placa: v.placa,
            tipo: 'SEM_COMUNICACAO',
            nivel: 'AVISO',
            titulo,
            mensagem: `[GPS SELSYN] Veículo ${v.placa} (${v.modelo}) está há mais de 24 horas sem emitir coordenadas GPS. Verifique a bateria ou antena do rastreador.`,
            enviadoChatwoot: false,
            chatwootStatus: 'PRONTO_PARA_ENVIO',
            resolvido: false,
          });
          novosAlertas++;
        }
      }
    }

    return { novosAlertas, duplicidades };
  };

  const handleProcessAutoAlerts = async () => {
    setIsProcessingAutoAlerts(true);
    const revisions = storage.getRevisions();
    const licenciaments = storage.getLicenciamentos();

    try {
      const res = await fetch('/api/alerts/process-auto-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicles,
          revisions,
          licenciaments,
          existingAlerts: alerts,
          settings,
          dryRun: true,
        }),
      });

      if (!res.ok) {
        throw new Error(`Servidor respondeu com status ${res.status}`);
      }

      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.alertas) && data.alertas.length > 0) {
          for (const a of data.alertas) {
            storage.addAlert(a);
          }
        }
        onAlertsUpdated();
        setAutoAlertStatusMsg(data.message || 'Alertas verificados com sucesso no servidor.');
        setTimeout(() => setAutoAlertStatusMsg(null), 6000);
        return;
      }
    } catch {
      // Fallback seguro no cliente: processa localmente sem travar a interface
      const { novosAlertas, duplicidades } = processAlertsLocally(revisions, licenciaments);
      onAlertsUpdated();
      setAutoAlertStatusMsg(
        `Alertas verificados localmente: ${novosAlertas} novo(s) alerta(s) gerado(s), ${duplicidades} duplicidade(s) ignorada(s).`
      );
      setTimeout(() => setAutoAlertStatusMsg(null), 6000);
    } finally {
      setIsProcessingAutoAlerts(false);
    }
  };

  const filteredAlerts = alerts.filter(a => {
    if (filterNivel !== 'ALL' && a.nivel !== filterNivel) return false;
    if (filterSent === 'PENDING' && a.enviadoChatwoot) return false;
    if (filterSent === 'SENT' && !a.enviadoChatwoot) return false;
    return true;
  });

  const handleSendSingleAlert = async (alert: TelemetryAlert) => {
    setSendingAlertId(alert.id);
    const success = await onSendChatwootAlert(alert.mensagem, alert.placa, alert.id);
    setSendingAlertId(null);
    if (success) {
      storage.markAlertSentChatwoot(alert.id);
      onAlertsUpdated();
    }
  };

  const handleResolveAlert = (id: string) => {
    storage.markAlertResolved(id);
    onAlertsUpdated();
  };

  const handleSendCustomMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMessage.trim()) return;

    setIsSendingCustom(true);
    const success = await onSendChatwootAlert(customMessage, selectedPlaca);
    setIsSendingCustom(false);

    if (success) {
      setCustomSendSuccess(true);
      setTimeout(() => setCustomSendSuccess(null as any), 3500);
      setCustomMessage('');
    }
  };

  const handleSendAllPending = async () => {
    const pendings = alerts.filter(a => !a.enviadoChatwoot);
    for (const a of pendings) {
      await onSendChatwootAlert(a.mensagem, a.placa, a.id);
      storage.markAlertSentChatwoot(a.id);
    }
    onAlertsUpdated();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center text-white">
              <MessageSquare className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-[#0F2744]">
              Central de Alertas &amp; Integração Chatwoot
            </h1>
          </div>
          <p className="text-slate-600 text-xs sm:text-sm mt-1">
            Notificações operacionais em tempo real: excesso de velocidade, manutenção vencida e licenciamento DETRAN-PA disparados diretamente para o Chatwoot.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleProcessAutoAlerts}
            disabled={isProcessingAutoAlerts}
            className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isProcessingAutoAlerts ? 'animate-spin' : ''}`} />
            <span>{isProcessingAutoAlerts ? 'Processando...' : 'Verificar Alertas Backend'}</span>
          </button>

          <button
            onClick={handleSendAllPending}
            className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-sm active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Disparar Todos Pendentes</span>
          </button>
        </div>
      </div>

      {/* Auto Alert Status Notification Banner */}
      {autoAlertStatusMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-xl flex items-center gap-3 text-xs shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <p className="font-medium">{autoAlertStatusMsg}</p>
        </div>
      )}

      {/* Chatwoot Connection Status Banner */}
      <div className="bg-[#0F2744] text-white p-5 rounded-xl shadow-md border border-[#1E3A5F] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400 border border-cyan-400/30">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">Canal Chatwoot Conectado</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.2 rounded font-extrabold uppercase">
                Online
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 font-mono">
              Instância: {settings.chatwoot.baseUrl || 'https://chatwoot.suaempresa.com.br'} • Conta #{settings.chatwoot.accountId || '1'} • Caixa #{settings.chatwoot.inboxId || '4'}
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-300">
          Disparos automáticos: <strong className="text-white">Ativados</strong>
        </div>
      </div>

      {/* Grid: Left Feed of Alerts, Right Custom Message Box & Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Alerts Feed (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-slate-700">Severidade:</span>
              {(['ALL', 'CRITICO', 'AVISO', 'INFO'] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setFilterNivel(n)}
                  className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                    filterNivel === n
                      ? 'bg-[#0F2744] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {n === 'ALL' ? 'Todos' : n === 'CRITICO' ? 'Críticos' : n === 'AVISO' ? 'Avisos' : 'Info'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              {(['ALL', 'PENDING', 'SENT'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilterSent(s)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    filterSent === s ? 'bg-sky-100 text-sky-800' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {s === 'ALL' ? 'Todos' : s === 'PENDING' ? 'Não enviados' : 'Enviados'}
                </button>
              ))}
            </div>
          </div>

          {/* Alert Cards */}
          <div className="space-y-3">
            {filteredAlerts.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
                Nenhum alerta encontrado para os filtros selecionados.
              </div>
            ) : (
              filteredAlerts.map(alert => {
                const isCrit = alert.nivel === 'CRITICO';
                const isWarn = alert.nivel === 'AVISO';

                return (
                  <div
                    key={alert.id}
                    className={`bg-white rounded-xl border p-4 shadow-sm space-y-3 transition-all ${
                      alert.resolvido
                        ? 'opacity-60 bg-slate-50/80 border-slate-200'
                        : isCrit
                        ? 'border-red-300 bg-red-50/10'
                        : isWarn
                        ? 'border-amber-300 bg-amber-50/10'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <LicensePlateBadge placa={alert.placa} size="sm" />
                        <div>
                          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            {isCrit && <AlertTriangle className="w-3.5 h-3.5 text-red-600 animate-pulse" />}
                            <span>{alert.titulo}</span>
                          </h4>
                          <span className="text-[10px] text-slate-400">
                            {new Date(alert.timestamp).toLocaleTimeString()} • {new Date(alert.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                            isCrit
                              ? 'bg-red-500 text-white'
                              : isWarn
                              ? 'bg-amber-500 text-white'
                              : 'bg-sky-600 text-white'
                          }`}
                        >
                          {alert.nivel}
                        </span>

                        {alert.enviadoChatwoot && (
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5 text-emerald-600" /> Chatwoot
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed font-sans">
                      {alert.mensagem}
                    </p>

                    {/* Actions */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        {alert.resolvido ? (
                          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Tratado / Resolvido
                          </span>
                        ) : (
                          <button
                            onClick={() => handleResolveAlert(alert.id)}
                            className="text-[11px] text-slate-500 hover:text-slate-800 underline"
                          >
                            Marcar como Resolvido
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => handleSendSingleAlert(alert)}
                        disabled={sendingAlertId === alert.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border shadow-xs ${
                          alert.enviadoChatwoot
                            ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            : 'bg-cyan-600 hover:bg-cyan-500 text-white border-transparent'
                        }`}
                      >
                        {sendingAlertId === alert.id ? (
                          <span>Disparando...</span>
                        ) : alert.enviadoChatwoot ? (
                          <>
                            <RotateCcw className="w-3 h-3 text-slate-400" />
                            <span>Reenviar ao Chatwoot</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3 h-3 text-white" />
                            <span>Enviar via Chatwoot</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Custom Message Composer & Chatwoot Dispatch Logs (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Quick Message Composer */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <Send className="w-4 h-4 text-cyan-600" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                Disparar Mensagem Manual no Chatwoot
              </h3>
            </div>

            <form onSubmit={handleSendCustomMessage} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Veículo / Placa de Referência:
                </label>
                <select
                  value={selectedPlaca}
                  onChange={e => setSelectedPlaca(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                >
                  {vehicles.map(v => (
                    <option key={v.id} value={v.placa}>
                      {v.placa} - {v.modelo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Texto da Mensagem:
                </label>
                <textarea
                  rows={4}
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  placeholder="Ex: 📢 Aviso Operacional: Favor comparecer ao pátio de Belém para vistoria preventiva de alinhamento e documentação DETRAN-PA."
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {customSendSuccess && (
                <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs p-2.5 rounded-lg flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Mensagem disparada com sucesso para o canal do Chatwoot!</span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSendingCustom || !customMessage.trim()}
                  className="bg-[#0F2744] hover:bg-[#1E3A5F] text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {isSendingCustom ? (
                    <span>Enviando...</span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Transmitir Alerta</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Chatwoot Dispatch Logs */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                Histórico de Disparos Chatwoot ({chatwootLogs.length})
              </h3>
              <span className="text-[10px] text-slate-400">Últimos envios</span>
            </div>

            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
              {chatwootLogs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  Nenhum registro de disparo armazenado nesta sessão.
                </p>
              ) : (
                chatwootLogs.map(log => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 font-mono">{log.placa}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          log.status === 'ENVIADO'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px] line-clamp-2">{log.mensagem}</p>
                    <div className="text-[10px] text-slate-400 flex justify-between">
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span>{log.detalhe || 'Canal API Chatwoot'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
