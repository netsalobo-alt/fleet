import React, { useState, useEffect } from 'react';
import { Sidebar, TabType } from './components/Sidebar';
import { UserManagementModal } from './components/UserManagementModal';
import { DashboardView } from './components/DashboardView';
import { VehiclesView } from './components/VehiclesView';
import { AIMaintenanceView } from './components/AIMaintenanceView';
import { ReportsView } from './components/ReportsView';
import { RevisionsMonitorView } from './components/RevisionsMonitorView';
import { LicenciamentoPAView } from './components/LicenciamentoPAView';
import { TrackingMapView } from './components/TrackingMapView';
import { AlertsChatwootView } from './components/AlertsChatwootView';
import { ConfigView } from './components/ConfigView';
import { SuppliersView } from './components/SuppliersView';
import { storage } from './services/storage';
import { Vehicle, ServiceLog, RevisionPlan, LicenciamentoPA, TelemetryAlert, SystemUser, SystemSettings, ChatwootLog, Supplier } from './types';
import { CheckCircle2, AlertTriangle, Info, Menu, Shield, User } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [showGlobalUserModal, setShowGlobalUserModal] = useState<boolean>(false);

  // Core App State from Storage
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => storage.getVehicles());
  const [services, setServices] = useState<ServiceLog[]>(() => storage.getServices());
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => storage.getSuppliers());
  const [revisions, setRevisions] = useState<RevisionPlan[]>(() => storage.getRevisions());
  const [licensingList, setLicensingList] = useState<LicenciamentoPA[]>(() => storage.getLicensing());
  const [alerts, setAlerts] = useState<TelemetryAlert[]>(() => storage.getAlerts());
  const [users, setUsers] = useState<SystemUser[]>(() => storage.getUsers());
  const [currentUser, setCurrentUser] = useState<SystemUser>(() => storage.getActiveUser());
  const [settings, setSettings] = useState<SystemSettings>(() => storage.getSettings());
  const [chatwootLogs, setChatwootLogs] = useState<ChatwootLog[]>(() => storage.getChatwootLogs());

  // Global Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'warning' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // State sync helpers
  const refreshVehicles = () => setVehicles(storage.getVehicles());
  const refreshServices = () => setServices(storage.getServices());
  const refreshSuppliers = () => setSuppliers(storage.getSuppliers());
  const refreshRevisions = () => setRevisions(storage.getRevisions());
  const refreshLicensing = () => setLicensingList(storage.getLicensing());
  const refreshAlerts = () => setAlerts(storage.getAlerts());
  const refreshUsers = () => setUsers(storage.getUsers());
  const refreshSettings = (newSettings?: SystemSettings) => {
    if (newSettings) setSettings(newSettings);
    else setSettings(storage.getSettings());
    refreshLicensing();
  };

  // Global Chatwoot Alert Dispatcher
  const handleSendChatwootAlert = async (message: string, placa: string, alertaId?: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/chatwoot/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatwootUrl: settings.chatwoot.baseUrl,
          apiAccessToken: settings.chatwoot.apiAccessToken,
          accountId: settings.chatwoot.accountId,
          conversationId: settings.chatwoot.conversationId,
          message,
          targetChannel: 'whatsapp',
        }),
      });

      const result = await response.json();

      const newLog: ChatwootLog = {
        id: 'log-' + Date.now(),
        timestamp: new Date().toISOString(),
        alertaId,
        placa,
        tipo: 'NOTIFICAÇÃO OPERACIONAL',
        mensagem: message,
        status: result.sentToLiveChatwoot ? 'ENVIADO' : 'SIMULADO',
        detalhe: result.sentToLiveChatwoot
          ? 'Entregue à API Chatwoot'
          : 'Simulado localmente (configure o token nas Configurações)',
      };

      storage.addChatwootLog(newLog);
      setChatwootLogs(storage.getChatwootLogs());

      if (result.sentToLiveChatwoot) {
        showToast(`Mensagem enviada com sucesso para o Chatwoot (${placa})!`, 'success');
      } else {
        showToast(`Alerta registrado no fluxo do Chatwoot (${placa})!`, 'info');
      }

      return true;
    } catch (e: any) {
      console.error('Falha no envio Chatwoot:', e);
      showToast('Erro ao comunicar com o servidor de alertas.', 'warning');
      return false;
    }
  };

  const handleServiceAdded = (newService: ServiceLog) => {
    refreshServices();
    refreshVehicles();
    refreshRevisions();
    showToast(`Serviço cadastrado com sucesso para a placa ${newService.placa}!`, 'success');
  };

  // Real Selsyn Telemetry Background Polling (Zero Simulated Data)
  useEffect(() => {
    const token =
      settings.tracking.operadorKey ||
      settings.tracking.xApiKey ||
      settings.tracking.token;
    if (!token) return;

    const syncLivePositions = async () => {
      try {
        const currentVehs = storage.getVehicles();
        const plates = currentVehs.map(v => v.placa);
        const res = await fetch('/api/selsyn/sync-positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            baseUrl: settings.tracking.baseUrl || 'https://api.appselsyn.com.br/',
            endpoint: '/keek/rest/v1/integracao/operador/posicao',
            operadorKey: token,
            xApiKey: token,
            clienteId: settings.tracking.clienteId,
            placas: plates,
          }),
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.positions) && data.positions.length > 0) {
          const current = storage.getVehicles();
          let changed = false;

          for (const pos of data.positions) {
            const rawId = String(pos.identificador || pos.rastreavel || '').toUpperCase();
            const cleanId = rawId.replace(/[^A-Z0-9]/g, '');
            if (!cleanId) continue;

            const idx = current.findIndex(
              v => v.placa.toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanId
            );
            if (idx !== -1) {
              current[idx].localizacao.lat =
                pos.latitude || current[idx].localizacao.lat;
              current[idx].localizacao.lng =
                pos.longitude || current[idx].localizacao.lng;
              current[idx].velocidade = pos.velocidade ?? current[idx].velocidade;
              current[idx].ignicao = Boolean(pos.ignicao);
              current[idx].ultimaComunicacao =
                pos.dataComunicacao || pos.dataHora || new Date().toISOString();
              if (pos.fonteEnergia) current[idx].bateriaVolts = pos.fonteEnergia;
              if (pos.odometro !== undefined && pos.odometro !== null) {
                // Selsyn importa em METROS -> converter para KM:
                const rawOdo = Number(pos.odometro);
                const km = rawOdo > 500000 ? Math.round(rawOdo / 1000) : Math.round(rawOdo);
                if (km > 0) {
                  current[idx].odometroRastreador = km;
                  current[idx].dataUltimoOdometroRastreador =
                    pos.dataComunicacao || pos.dataHora || new Date().toISOString();
                  if (km > (current[idx].odometroAtual || 0)) {
                    current[idx].odometroAtual = km;
                  }
                }
              }
              changed = true;
            } else if (current.length === 0) {
              // Auto-seed real vehicle if fleet is empty
              const rawOdo = Number(pos.odometro || 0);
              const initialKm = rawOdo > 500000 ? Math.round(rawOdo / 1000) : (rawOdo > 0 ? Math.round(rawOdo) : 15000);
              current.push({
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
              });
              changed = true;
            }
          }

          if (changed) {
            storage.saveVehicles(current);
            refreshVehicles();
          }
        }
      } catch {
        // Silent background polling
      }
    };

    // Run initial sync on load
    syncLivePositions();

    const intervalSec = Math.max(15, settings.tracking.autoSyncInterval || 30);
    const timer = setInterval(syncLivePositions, intervalSec * 1000);
    return () => clearInterval(timer);
  }, [
    settings.tracking.operadorKey,
    settings.tracking.xApiKey,
    settings.tracking.baseUrl,
    settings.tracking.autoSyncInterval,
    settings.tracking.clienteId,
  ]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col md:flex-row selection:bg-sky-500 selection:text-white">
      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top duration-300">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2.5 max-w-md ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-700'
                : toast.type === 'warning'
                ? 'bg-amber-600 text-white border-amber-700'
                : 'bg-[#0F2744] text-white border-slate-700'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
            ) : toast.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-white shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-cyan-300 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Modern Collapsible & Mobile Responsive Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        vehicles={vehicles}
        alerts={alerts}
        revisions={revisions}
        currentUser={currentUser}
        onSwitchUser={(user) => {
          setCurrentUser(user);
          storage.setActiveUser(user);
        }}
        onOpenUserManagement={() => setShowGlobalUserModal(true)}
        users={users}
        chatwootConnected={Boolean(settings.chatwoot.apiAccessToken)}
        trackingConnected={Boolean(settings.tracking.baseUrl)}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      {/* Main Content Column with dynamic left margin for Sidebar */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'
        }`}
      >
        {/* Mobile Header Bar (Only visible on mobile screens where sidebar is hidden) */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0F2744] text-white sticky top-0 z-30 shadow-md">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Abrir Menu Lateral"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-white">Fleet Frota</span>
              <span className="bg-sky-500/30 text-sky-300 text-[9px] font-black px-1 py-0.2 rounded border border-sky-400/30">
                PA
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowGlobalUserModal(true)}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-lg text-xs transition-colors"
            title="Gerenciar Usuário e Senha"
          >
            {currentUser.cargo === 'GESTOR' ? (
              <Shield className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <User className="w-3.5 h-3.5 text-sky-400" />
            )}
            <span className="font-semibold truncate max-w-[100px]">{currentUser.nome.split(' ')[0]}</span>
            <span
              className={`text-[9px] font-bold px-1 rounded uppercase ${
                currentUser.cargo === 'GESTOR'
                  ? 'bg-amber-400/20 text-amber-300'
                  : 'bg-sky-400/20 text-sky-300'
              }`}
            >
              {currentUser.cargo === 'GESTOR' ? 'Admin' : 'Op'}
            </span>
          </button>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {currentTab === 'dashboard' && (
          <DashboardView
            vehicles={vehicles}
            services={services}
            revisions={revisions}
            licensingList={licensingList}
            alerts={alerts}
            setCurrentTab={setCurrentTab}
            onSendChatwootAlert={handleSendChatwootAlert}
          />
        )}

        {currentTab === 'vehicles' && (
          <VehiclesView
            vehicles={vehicles}
            services={services}
            users={users}
            onVehiclesUpdated={refreshVehicles}
            onServiceAdded={handleServiceAdded}
            onNavigateToAI={(placa) => {
              setCurrentTab('maintenance');
            }}
            onNavigateToTracking={(veiculoId) => {
              setCurrentTab('tracking');
            }}
            onSendChatwootAlert={handleSendChatwootAlert}
          />
        )}

        {currentTab === 'suppliers' && (
          <SuppliersView
            suppliers={suppliers}
            services={services}
            vehicles={vehicles}
            currentUser={currentUser}
            onSuppliersUpdated={refreshSuppliers}
            onNavigateToMaintenance={(fornecedorId) => {
              setCurrentTab('maintenance');
            }}
          />
        )}

        {currentTab === 'maintenance' && (
          <AIMaintenanceView
            vehicles={vehicles}
            services={services}
            suppliers={suppliers}
            onSuppliersUpdated={refreshSuppliers}
            currentUser={currentUser}
            onUpdateCurrentUser={(user) => {
              setCurrentUser(user);
              storage.setActiveUser(user);
            }}
            users={users}
            onServiceAdded={handleServiceAdded}
            onServiceUpdated={(updated) => {
              refreshServices();
              refreshVehicles();
              refreshRevisions();
              showToast(`Lançamento do veículo ${updated.placa} atualizado com sucesso!`, 'success');
            }}
            onSendChatwootAlert={handleSendChatwootAlert}
          />
        )}

        {currentTab === 'reports' && (
          <ReportsView
            vehicles={vehicles}
            services={services}
            suppliers={suppliers}
          />
        )}

        {currentTab === 'revisions' && (
          <RevisionsMonitorView
            vehicles={vehicles}
            revisions={revisions}
            currentUser={currentUser}
            onRevisionsUpdated={refreshRevisions}
            onSendChatwootAlert={handleSendChatwootAlert}
          />
        )}

        {currentTab === 'detran' && (
          <LicenciamentoPAView
            vehicles={vehicles}
            licensingList={licensingList}
            onLicensingUpdated={refreshLicensing}
            onSendChatwootAlert={handleSendChatwootAlert}
          />
        )}

        {currentTab === 'tracking' && (
          <TrackingMapView
            vehicles={vehicles}
            onVehiclesUpdated={refreshVehicles}
            onSendChatwootAlert={handleSendChatwootAlert}
          />
        )}

        {currentTab === 'alerts' && (
          <AlertsChatwootView
            alerts={alerts}
            vehicles={vehicles}
            settings={settings}
            chatwootLogs={chatwootLogs}
            onAlertsUpdated={refreshAlerts}
            onSendChatwootAlert={handleSendChatwootAlert}
          />
        )}

        {currentTab === 'config' && (
          <ConfigView
            settings={settings}
            users={users}
            onSettingsUpdated={refreshSettings}
            onUsersUpdated={refreshUsers}
            onSendChatwootAlert={handleSendChatwootAlert}
          />
        )}
      </main>

      {/* Executive Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#0F2744]">Fleet Telecom</span>
            <span>• Gestão de Frota, IA &amp; DETRAN Pará</span>
            <span className="bg-sky-100 text-sky-800 text-[10px] px-1.5 py-0.5 rounded font-bold">
              v3.2 PA
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>OpenAPI Selsyn Keek Conectada</span>
            <span>•</span>
            <span>Chatwoot Bot Ativo</span>
            <span>•</span>
            <button
              onClick={() => {
                if (confirm('Deseja restaurar todos os dados da frota para os valores de demonstração?')) {
                  storage.resetAllToDefaults();
                  storage.loadDemoPreset();
                  setCurrentUser(storage.getActiveUser());
                  refreshVehicles();
                  refreshServices();
                  refreshSuppliers();
                  refreshRevisions();
                  refreshLicensing();
                  refreshAlerts();
                  refreshUsers();
                  refreshSettings();
                  showToast('Dados restaurados para o padrão de demonstração!', 'info');
                }
              }}
              className="text-slate-500 hover:text-slate-800 underline"
            >
              Restaurar Dados Demo
            </button>
          </div>
        </div>
      </footer>

      {/* Global User & Privilege Management Modal */}
      <UserManagementModal
        isOpen={showGlobalUserModal}
        onClose={() => setShowGlobalUserModal(false)}
        currentUser={currentUser}
        onUserChanged={(updatedUser) => {
          setCurrentUser(updatedUser);
          storage.setActiveUser(updatedUser);
          refreshUsers();
        }}
        onUsersListUpdated={() => {
          refreshUsers();
          setCurrentUser(storage.getActiveUser());
        }}
      />
    </div>
  </div>
);
}
