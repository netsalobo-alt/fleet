import React from 'react';
import {
  Car,
  Activity,
  Wrench,
  CalendarCheck2,
  FileText,
  MapPin,
  Bell,
  Settings,
  ShieldCheck,
  Radio,
  MessageSquare,
  Sparkles,
  BarChart3,
  User,
  Shield,
  Database,
  Building2,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Gauge,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Key,
} from 'lucide-react';
import { TelemetryAlert, Vehicle, SystemUser, RevisionPlan } from '../types';

export type TabType =
  | 'dashboard'
  | 'vehicles'
  | 'suppliers'
  | 'maintenance'
  | 'reports'
  | 'revisions'
  | 'detran'
  | 'tracking'
  | 'alerts'
  | 'config';

interface SidebarProps {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  vehicles: Vehicle[];
  alerts: TelemetryAlert[];
  revisions?: RevisionPlan[];
  currentUser?: SystemUser;
  onSwitchUser?: (user: SystemUser) => void;
  onOpenUserManagement?: () => void;
  users?: SystemUser[];
  chatwootConnected: boolean;
  trackingConnected: boolean;
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  vehicles,
  alerts,
  revisions = [],
  currentUser,
  onSwitchUser,
  onOpenUserManagement,
  users = [],
  chatwootConnected,
  trackingConnected,
  isCollapsed,
  setIsCollapsed,
  mobileOpen,
  setMobileOpen,
}) => {
  const unresolvedAlerts = alerts.filter(a => !a.resolvido).length;
  const criticalAlerts = alerts.filter(a => !a.resolvido && a.nivel === 'CRITICO').length;
  const overdueRevisions = revisions.filter(r => r.status === 'VENCIDO').length;
  const warningRevisions = revisions.filter(r => r.status === 'PROXIMO').length;
  const activeVehicles = vehicles.filter(v => v.status === 'OPERANDO').length;

  const navItems: {
    id: TabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeColor?: string;
    isAi?: boolean;
    section?: string;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity, section: 'PRINCIPAL' },
    { id: 'vehicles', label: 'Frota de Veículos', icon: Car, badge: vehicles.length, section: 'CADASTROS' },
    { id: 'suppliers', label: 'Fornecedores', icon: Building2, section: 'CADASTROS' },
    { id: 'revisions', label: 'Plano de Revisões', icon: CalendarCheck2, badge: overdueRevisions || warningRevisions, badgeColor: overdueRevisions > 0 ? 'bg-red-500 text-white' : 'bg-amber-500 text-white', section: 'OPERAÇÕES' },
    { id: 'maintenance', label: 'Lançar Serviços', icon: Wrench, isAi: true, section: 'OPERAÇÕES' },
    { id: 'tracking', label: 'Rastreamento GPS', icon: MapPin, section: 'OPERAÇÕES' },
    { id: 'detran', label: 'IPVA', icon: FileText, section: 'FISCAL & DOCS' },
    { id: 'reports', label: 'Relatórios de Gastos', icon: BarChart3, section: 'RELATÓRIOS' },
    { id: 'alerts', label: 'Alertas & Chatwoot', icon: Bell, badge: unresolvedAlerts, badgeColor: criticalAlerts > 0 ? 'bg-red-500 text-white' : 'bg-sky-600 text-white', section: 'SISTEMA' },
    { id: 'config', label: 'Configurações', icon: Settings, section: 'SISTEMA' },
  ];

  const handleSelectTab = (id: TabType) => {
    setCurrentTab(id);
    if (mobileOpen) {
      setMobileOpen(false);
    }
  };

  const navContent = (
    <div className="flex flex-col h-full bg-[#0F2744] text-white select-none">
      {/* Brand Header */}
      <div className={`p-4 border-b border-[#1E3A5F] flex items-center justify-between ${isCollapsed ? 'justify-center' : ''}`}>
        <div
          onClick={() => handleSelectTab('dashboard')}
          className={`flex items-center gap-3 cursor-pointer group ${isCollapsed ? 'justify-center' : ''}`}
          title="Fleet Telecom Pará"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center shadow-md shadow-sky-950/50 border border-sky-400/30 shrink-0">
            <Car className="w-5 h-5 text-white" />
          </div>

          {!isCollapsed && (
            <div className="overflow-hidden transition-all duration-200">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-white">Fleet Frota</span>
                <span className="bg-sky-500/25 text-sky-300 border border-sky-400/30 text-[9px] font-black uppercase px-1.5 py-0.2 rounded">
                  PA
                </span>
              </div>
              <p className="text-[10px] text-slate-300 leading-tight">
                Gestão &amp; Telemetria Belém
              </p>
            </div>
          )}
        </div>

        {/* Desktop Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(prev => !prev)}
          className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg text-slate-300 hover:text-white hover:bg-[#1E3A5F] transition-colors"
          title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Mobile Close Button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Quick Launch Action Banner */}
      {!isCollapsed ? (
        <div className="p-3 border-b border-[#1E3A5F]/70">
          <button
            onClick={() => handleSelectTab('maintenance')}
            className="w-full bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all border border-sky-400/30 active:scale-98"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>Lançar com IA</span>
          </button>
        </div>
      ) : (
        <div className="p-2 border-b border-[#1E3A5F]/70 flex justify-center">
          <button
            onClick={() => handleSelectTab('maintenance')}
            className="w-10 h-10 rounded-lg bg-sky-600 hover:bg-sky-500 flex items-center justify-center text-white border border-sky-400/40"
            title="Lançar Nota/Serviço com IA"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
          </button>
        </div>
      )}

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1 custom-scrollbar">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          const prevItem = navItems[index - 1];
          const showSection = !isCollapsed && item.section && (!prevItem || prevItem.section !== item.section);

          return (
            <React.Fragment key={item.id}>
              {showSection && (
                <div className="pt-3 pb-1 px-3 text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                  {item.section}
                </div>
              )}
              <button
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all group ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-sm shadow-sky-950/40'
                    : 'text-slate-300 hover:text-white hover:bg-[#1E3A5F]/60'
                } ${isCollapsed ? 'justify-center px-2' : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                <div className="relative shrink-0">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive
                        ? 'text-white'
                        : item.isAi
                        ? 'text-amber-400 group-hover:text-amber-300'
                        : 'text-slate-300 group-hover:text-white'
                    }`}
                  />
                  {isCollapsed && item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[#0F2744]"></span>
                  )}
                </div>

                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {item.isAi && !isActive && (
                      <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1.5 py-0.2 rounded font-extrabold border border-amber-400/30">
                        IA
                      </span>
                    )}
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          item.badgeColor || (isActive ? 'bg-white text-sky-800' : 'bg-slate-700 text-slate-200')
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Telemetry Quick Status Pill */}
      {!isCollapsed && (
        <div className="p-3 mx-2 my-1 bg-[#0A1A2E] rounded-xl border border-[#1E3A5F] text-[11px] space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              GPS Selsyn
            </span>
            <span className={trackingConnected ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {trackingConnected ? 'Online' : 'Simulador'}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span className="text-slate-300">Frota Ativa:</span>
            <span className="text-white font-mono font-bold">
              {activeVehicles} / {vehicles.length}
            </span>
          </div>
        </div>
      )}

      {/* User Session Footer */}
      <div className={`p-3 border-t border-[#1E3A5F] bg-[#0A1A2E]/60 ${isCollapsed ? 'flex justify-center p-2' : ''}`}>
        {currentUser && (
          <div className={`flex items-center gap-2.5 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
            <div className="flex items-center gap-2.5 min-w-0" title={`${currentUser.nome} (${currentUser.cargo})`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                  currentUser.cargo === 'GESTOR'
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                    : 'bg-sky-400/20 text-sky-300 border border-sky-400/40'
                }`}
              >
                {currentUser.cargo === 'GESTOR' ? (
                  <Shield className="w-4 h-4 text-amber-400" />
                ) : (
                  <User className="w-4 h-4 text-sky-400" />
                )}
              </div>

              {!isCollapsed && (
                <div className="min-w-0 overflow-hidden">
                  <p className="text-xs font-bold text-white truncate">{currentUser.nome}</p>
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-extrabold uppercase ${
                        currentUser.cargo === 'GESTOR'
                          ? 'bg-amber-400/20 text-amber-300'
                          : 'bg-sky-400/20 text-sky-300'
                      }`}
                    >
                      {currentUser.cargo === 'GESTOR' ? 'Administrador' : 'Operador'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              {!isCollapsed && onSwitchUser && users.length > 1 && (
                <select
                  aria-label="Alternar Usuário de Demonstração"
                  value={currentUser.id}
                  onChange={e => {
                    const selected = users.find(u => u.id === e.target.value);
                    if (selected) onSwitchUser(selected);
                  }}
                  className="bg-[#0F2744] text-[10px] text-slate-300 border border-slate-700 rounded px-1.5 py-1 focus:outline-none cursor-pointer"
                  title="Trocar Perfil / Cargo"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.nome.split(' ')[0]} ({u.cargo === 'GESTOR' ? 'Admin' : 'Oper.'})
                    </option>
                  ))}
                </select>
              )}

              {onOpenUserManagement && (
                <button
                  type="button"
                  onClick={onOpenUserManagement}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Gerenciar Usuários, Senhas & Privilégios"
                >
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden md:flex flex-col fixed top-0 left-0 bottom-0 z-40 transition-all duration-300 border-r border-[#1E3A5F] shadow-xl ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {navContent}
      </aside>

      {/* Mobile Off-Canvas Drawer Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        />
      )}

      {/* Mobile Off-Canvas Drawer */}
      <aside
        className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 max-w-[85vw] transform transition-transform duration-300 ease-in-out shadow-2xl ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {navContent}
      </aside>
    </>
  );
};
