import React, { useState } from 'react';
import {
  X,
  Users,
  UserCheck,
  Shield,
  User,
  Key,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Wrench,
  Car,
  Building2,
  ShieldCheck,
  Check,
  Clock,
  Sparkles,
  LogIn,
  Search,
} from 'lucide-react';
import { SystemUser, UserRole, UserPermissions } from '../types';
import { storage, getDefaultPermissionsByRole } from '../services/storage';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: SystemUser;
  onUserChanged: (user: SystemUser) => void;
  onUsersListUpdated: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChanged,
  onUsersListUpdated,
}) => {
  const [users, setUsers] = useState<SystemUser[]>(() => storage.getUsers());
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Form State
  const [formNome, setFormNome] = useState('');
  const [formLogin, setFormLogin] = useState('');
  const [formSenha, setFormSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formEmail, setFormEmail] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [formCpf, setFormCpf] = useState('');
  const [formCargo, setFormCargo] = useState<UserRole>('OPERADOR');
  const [formStatus, setFormStatus] = useState<'ATIVO' | 'INATIVO'>('ATIVO');
  const [formCnh, setFormCnh] = useState('');
  const [formCnhValidade, setFormCnhValidade] = useState('');
  const [formCnhCategoria, setFormCnhCategoria] = useState('');

  // Permissions State
  const [formModulos, setFormModulos] = useState<string[]>([
    'dashboard',
    'vehicles',
    'suppliers',
    'revisions',
    'maintenance',
    'detran',
  ]);
  const [podeLancarNotas, setPodeLancarNotas] = useState(true);
  const [podeEditarNotasProprias, setPodeEditarNotasProprias] = useState(true);
  const [limiteHorasEdicaoPropria, setLimiteHorasEdicaoPropria] = useState(24);
  const [podeEditarQualquerNota, setPodeEditarQualquerNota] = useState(false);
  const [podeExcluirNotas, setPodeExcluirNotas] = useState(false);
  const [podeGerenciarVeiculos, setPodeGerenciarVeiculos] = useState(false);
  const [podeGerenciarFornecedores, setPodeGerenciarFornecedores] = useState(false);
  const [podeGerenciarUsuarios, setPodeGerenciarUsuarios] = useState(false);
  const [podeExportarRelatorios, setPodeExportarRelatorios] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Fast Switch with Password Modal
  const [switchTargetUser, setSwitchTargetUser] = useState<SystemUser | null>(null);
  const [switchPasswordInput, setSwitchPasswordInput] = useState('');
  const [switchError, setSwitchError] = useState<string | null>(null);

  if (!isOpen) return null;

  const refreshList = () => {
    const list = storage.getUsers();
    setUsers(list);
    onUsersListUpdated();
  };

  const handleOpenCreate = () => {
    setEditingUserId(null);
    setFormNome('');
    setFormLogin('');
    setFormSenha('123');
    setShowPassword(false);
    setFormEmail('');
    setFormTelefone('');
    setFormCpf('');
    setFormCargo('OPERADOR');
    setFormStatus('ATIVO');
    setFormCnh('');
    setFormCnhValidade('');
    setFormCnhCategoria('');

    // Preenche com permissões de Operador
    applyRoleTemplate('OPERADOR');
    setFormError(null);
    setFormSuccess(null);
    setIsEditingUser(true);
  };

  const handleOpenEdit = (user: SystemUser) => {
    setEditingUserId(user.id);
    setFormNome(user.nome);
    setFormLogin(user.login || user.email.split('@')[0]);
    setFormSenha(user.senha || '123');
    setShowPassword(false);
    setFormEmail(user.email);
    setFormTelefone(user.telefone || '');
    setFormCpf(user.cpf || '');
    setFormCargo(user.cargo);
    setFormStatus(user.status);
    setFormCnh(user.cnh || '');
    setFormCnhValidade(user.cnhValidade || '');
    setFormCnhCategoria(user.cnhCategoria || '');

    const perms = user.permissoes || getDefaultPermissionsByRole(user.cargo);
    setFormModulos(perms.modulosPermitidos || []);
    setPodeLancarNotas(perms.podeLancarNotas ?? true);
    setPodeEditarNotasProprias(perms.podeEditarNotasProprias ?? true);
    setLimiteHorasEdicaoPropria(perms.limiteHorasEdicaoPropria ?? 24);
    setPodeEditarQualquerNota(perms.podeEditarQualquerNota ?? false);
    setPodeExcluirNotas(perms.podeExcluirNotas ?? false);
    setPodeGerenciarVeiculos(perms.podeGerenciarVeiculos ?? false);
    setPodeGerenciarFornecedores(perms.podeGerenciarFornecedores ?? false);
    setPodeGerenciarUsuarios(perms.podeGerenciarUsuarios ?? false);
    setPodeExportarRelatorios(perms.podeExportarRelatorios ?? false);

    setFormError(null);
    setFormSuccess(null);
    setIsEditingUser(true);
  };

  const applyRoleTemplate = (role: UserRole) => {
    const defaultPerms = getDefaultPermissionsByRole(role);
    setFormModulos(defaultPerms.modulosPermitidos);
    setPodeLancarNotas(defaultPerms.podeLancarNotas);
    setPodeEditarNotasProprias(defaultPerms.podeEditarNotasProprias);
    setLimiteHorasEdicaoPropria(defaultPerms.limiteHorasEdicaoPropria ?? 24);
    setPodeEditarQualquerNota(defaultPerms.podeEditarQualquerNota);
    setPodeExcluirNotas(defaultPerms.podeExcluirNotas);
    setPodeGerenciarVeiculos(defaultPerms.podeGerenciarVeiculos);
    setPodeGerenciarFornecedores(defaultPerms.podeGerenciarFornecedores);
    setPodeGerenciarUsuarios(defaultPerms.podeGerenciarUsuarios);
    setPodeExportarRelatorios(defaultPerms.podeExportarRelatorios);
  };

  const handleRoleChange = (newRole: UserRole) => {
    setFormCargo(newRole);
    applyRoleTemplate(newRole);
  };

  const toggleModule = (mod: string) => {
    setFormModulos(prev =>
      prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]
    );
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const cleanNome = formNome.trim();
    const cleanLogin = formLogin.trim().toLowerCase().replace(/\s+/g, '');
    const cleanSenha = formSenha.trim();

    if (!cleanNome) {
      setFormError('Informe o nome completo do usuário.');
      return;
    }

    if (!cleanLogin) {
      setFormError('Informe o login/usuário para acesso.');
      return;
    }

    if (cleanLogin.length < 3) {
      setFormError('O login deve ter pelo menos 3 caracteres.');
      return;
    }

    if (!cleanSenha) {
      setFormError('Informe a senha de acesso.');
      return;
    }

    // Verifica duplicidade de login
    const existingLogin = users.find(
      u => u.login.toLowerCase() === cleanLogin && u.id !== editingUserId
    );
    if (existingLogin) {
      setFormError(`O login "${cleanLogin}" já está em uso por ${existingLogin.nome}. Escolha outro.`);
      return;
    }

    const permissionsPayload: UserPermissions = {
      modulosPermitidos: formModulos,
      podeLancarNotas,
      podeEditarNotasProprias,
      limiteHorasEdicaoPropria: Number(limiteHorasEdicaoPropria) || 24,
      podeEditarQualquerNota,
      podeExcluirNotas,
      podeGerenciarVeiculos,
      podeGerenciarFornecedores,
      podeGerenciarUsuarios,
      podeExportarRelatorios,
    };

    if (editingUserId) {
      const userToUpdate: SystemUser = {
        id: editingUserId,
        nome: cleanNome,
        login: cleanLogin,
        senha: cleanSenha,
        email: formEmail.trim() || `${cleanLogin}@fleet-telecom.com.br`,
        telefone: formTelefone.trim(),
        cpf: formCpf.trim(),
        cargo: formCargo,
        status: formStatus,
        cnh: formCargo === 'MOTORISTA' ? formCnh.trim() : undefined,
        cnhValidade: formCargo === 'MOTORISTA' ? formCnhValidade.trim() : undefined,
        cnhCategoria: formCargo === 'MOTORISTA' ? formCnhCategoria.trim() : undefined,
        dataCriacao: users.find(u => u.id === editingUserId)?.dataCriacao || new Date().toISOString(),
        permissoes: permissionsPayload,
      };

      storage.updateUser(userToUpdate);

      // Se o usuário editado for o usuário atualmente ativo, sincroniza estado ativo
      if (currentUser.id === editingUserId) {
        storage.setActiveUser(userToUpdate);
        onUserChanged(userToUpdate);
      }

      setFormSuccess(`Usuário ${cleanNome} atualizado com sucesso!`);
    } else {
      const newUser: SystemUser = {
        id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        nome: cleanNome,
        login: cleanLogin,
        senha: cleanSenha,
        email: formEmail.trim() || `${cleanLogin}@fleet-telecom.com.br`,
        telefone: formTelefone.trim(),
        cpf: formCpf.trim(),
        cargo: formCargo,
        status: formStatus,
        cnh: formCargo === 'MOTORISTA' ? formCnh.trim() : undefined,
        cnhValidade: formCargo === 'MOTORISTA' ? formCnhValidade.trim() : undefined,
        cnhCategoria: formCargo === 'MOTORISTA' ? formCnhCategoria.trim() : undefined,
        dataCriacao: new Date().toISOString(),
        permissoes: permissionsPayload,
      };

      storage.addUser(newUser);
      setFormSuccess(`Novo usuário ${cleanNome} cadastrado com sucesso!`);
    }

    refreshList();
    setTimeout(() => {
      setIsEditingUser(false);
      setFormSuccess(null);
    }, 900);
  };

  const handleDeleteUser = (user: SystemUser) => {
    if (user.id === currentUser.id) {
      alert('Você não pode excluir o usuário com o qual está atualmente conectado.');
      return;
    }
    if (users.length <= 1) {
      alert('O sistema precisa de pelo menos um usuário administrador cadastrado.');
      return;
    }

    if (confirm(`Tem certeza que deseja excluir o usuário "${user.nome}" (${user.login})? Esta ação não pode ser desfeita.`)) {
      storage.deleteUser(user.id);
      refreshList();
    }
  };

  const handleToggleStatus = (user: SystemUser) => {
    if (user.id === currentUser.id) {
      alert('Você não pode desativar o usuário da sua sessão atual.');
      return;
    }
    const updated: SystemUser = {
      ...user,
      status: user.status === 'ATIVO' ? 'INATIVO' : 'ATIVO',
    };
    storage.updateUser(updated);
    refreshList();
  };

  const handleStartSwitch = (user: SystemUser) => {
    if (user.id === currentUser.id) return;
    setSwitchTargetUser(user);
    setSwitchPasswordInput('');
    setSwitchError(null);
  };

  const handleConfirmSwitch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!switchTargetUser) return;

    if (switchTargetUser.senha && switchPasswordInput !== switchTargetUser.senha) {
      setSwitchError('Senha incorreta para este usuário.');
      return;
    }

    storage.setActiveUser(switchTargetUser);
    onUserChanged(switchTargetUser);
    setSwitchTargetUser(null);
    onClose();
  };

  const filteredUsers = users.filter(u => {
    const s = searchTerm.toLowerCase();
    return (
      u.nome.toLowerCase().includes(s) ||
      u.login.toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s) ||
      u.cargo.toLowerCase().includes(s)
    );
  });

  const availableModules: { id: string; label: string; desc: string }[] = [
    { id: 'dashboard', label: 'Dashboard', desc: 'Métricas, KPIs da frota e gráficos' },
    { id: 'vehicles', label: 'Frota de Veículos', desc: 'Consulta e ficha técnica dos veículos' },
    { id: 'suppliers', label: 'Fornecedores', desc: 'Oficinas, autopeças e serviços' },
    { id: 'maintenance', label: 'Lançar Notas & Serviços', desc: 'Lançamento via IA e Manual de ordens de serviço' },
    { id: 'revisions', label: 'Plano de Revisões', desc: 'Cronograma preventivo de trocas e revisões' },
    { id: 'detran', label: 'IPVA', desc: 'Licenciamento e calendário estadual do Pará' },
    { id: 'tracking', label: 'Rastreamento GPS Selsyn', desc: 'Mapa em tempo real e telemetria' },
    { id: 'reports', label: 'Relatórios de Gastos', desc: 'Estatísticas e centro de custos' },
    { id: 'alerts', label: 'Alertas & Chatwoot', desc: 'Notificações operacionais e bot WhatsApp' },
    { id: 'config', label: 'Configurações', desc: 'Tokens, APIs, calendário e banco de dados' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#0F2744] via-[#16365C] to-[#1E3A5F] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Users className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg">
                  Gestão de Usuários, Senhas &amp; Privilégios
                </h3>
                <span className="bg-sky-500/20 text-sky-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-sky-400/30">
                  Controle de Acessos
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-0.5">
                Crie login e senha para os operadores que lançam notas e defina o que podem editar.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-black/20 hover:bg-black/30 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Active User Callout */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#0F2744] text-white flex items-center justify-center font-bold text-xs">
                {currentUser.cargo === 'GESTOR' ? <Shield className="w-3.5 h-3.5 text-amber-400" /> : <User className="w-3.5 h-3.5 text-sky-400" />}
              </div>
              <div>
                <span className="text-slate-500">Conectado como:</span>{' '}
                <strong className="text-slate-900">{currentUser.nome}</strong>{' '}
                <span className="text-slate-400 font-mono">(@{currentUser.login})</span>
                <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                  currentUser.cargo === 'GESTOR' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
                }`}>
                  {currentUser.cargo === 'GESTOR' ? 'Administrador' : 'Operador'}
                </span>
              </div>
            </div>

            <span className="text-[11px] text-slate-500">
              {currentUser.cargo === 'GESTOR' ? 'Permissão total para criar e editar usuários' : 'Visualizando perfil'}
            </span>
          </div>

          {!isEditingUser ? (
            /* USER LIST VIEW */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nome, login ou cargo..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-sky-500 outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-xs shrink-0 self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Usuário / Operador</span>
                </button>
              </div>

              {/* Users Cards / Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
                {filteredUsers.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    Nenhum usuário encontrado com os termos pesquisados.
                  </div>
                ) : (
                  filteredUsers.map(u => {
                    const perms = u.permissoes || getDefaultPermissionsByRole(u.cargo);
                    const isSelf = u.id === currentUser.id;

                    return (
                      <div
                        key={u.id}
                        className={`p-4 transition-colors ${
                          isSelf ? 'bg-sky-50/40' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          {/* User info */}
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                                u.cargo === 'GESTOR'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-sky-100 text-sky-800 border border-sky-300'
                              }`}
                            >
                              {u.cargo === 'GESTOR' ? (
                                <Shield className="w-5 h-5 text-amber-600" />
                              ) : (
                                <User className="w-5 h-5 text-sky-600" />
                              )}
                            </div>

                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <strong className="text-slate-900 text-sm">{u.nome}</strong>
                                <span className="font-mono text-xs text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                                  @{u.login}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                    u.cargo === 'GESTOR'
                                      ? 'bg-amber-100 text-amber-800'
                                      : u.cargo === 'OPERADOR'
                                      ? 'bg-sky-100 text-sky-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {u.cargo === 'GESTOR'
                                    ? 'Gestor / Administrador'
                                    : u.cargo === 'OPERADOR'
                                    ? 'Operador de Lançamentos'
                                    : u.cargo}
                                </span>

                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                    u.status === 'ATIVO'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-red-50 text-red-700 border border-red-200'
                                  }`}
                                >
                                  {u.status}
                                </span>

                                {isSelf && (
                                  <span className="text-[10px] bg-slate-900 text-white font-bold px-1.5 py-0.5 rounded">
                                    Sua Sessão
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                <span>{u.email}</span>
                                {u.telefone && <span>• {u.telefone}</span>}
                                {u.senha && (
                                  <span className="text-slate-400 font-mono text-[11px]">
                                    • Senha: ••••
                                  </span>
                                )}
                              </div>

                              {/* Privileges summary badges */}
                              <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px]">
                                {perms.podeLancarNotas && (
                                  <span className="bg-emerald-50 text-emerald-800 font-semibold px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    Lança Notas
                                  </span>
                                )}

                                {perms.podeEditarQualquerNota ? (
                                  <span className="bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-200">
                                    Edição Irrestrita de Qualquer Nota
                                  </span>
                                ) : perms.podeEditarNotasProprias ? (
                                  <span className="bg-sky-50 text-sky-800 font-semibold px-2 py-0.5 rounded border border-sky-200 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-sky-600" />
                                    Edita Próprias ({perms.limiteHorasEdicaoPropria || 24}h)
                                  </span>
                                ) : (
                                  <span className="bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded">
                                    Sem permissão de edição
                                  </span>
                                )}

                                {perms.podeGerenciarVeiculos && (
                                  <span className="bg-slate-100 text-slate-700 font-medium px-1.5 py-0.5 rounded">
                                    Cadastra Veículos
                                  </span>
                                )}

                                {perms.podeGerenciarFornecedores && (
                                  <span className="bg-slate-100 text-slate-700 font-medium px-1.5 py-0.5 rounded">
                                    Gerencia Fornecedores
                                  </span>
                                )}

                                {perms.podeGerenciarUsuarios && (
                                  <span className="bg-purple-50 text-purple-700 font-bold px-1.5 py-0.5 rounded border border-purple-200">
                                    Gerencia Usuários
                                  </span>
                                )}

                                <span className="text-slate-400 text-[10px] ml-1">
                                  ({perms.modulosPermitidos.length} módulos liberados)
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 self-end md:self-center shrink-0">
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => handleStartSwitch(u)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                                title="Entrar como este usuário"
                              >
                                <LogIn className="w-3.5 h-3.5 text-sky-600" />
                                <span>Entrar</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenEdit(u)}
                              className="p-1.5 text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                              title="Editar usuário e privilégios"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {!isSelf && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(u)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    u.status === 'ATIVO'
                                      ? 'text-amber-600 hover:bg-amber-50'
                                      : 'text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                  title={u.status === 'ATIVO' ? 'Inativar usuário' : 'Ativar usuário'}
                                >
                                  {u.status === 'ATIVO' ? (
                                    <Lock className="w-4 h-4" />
                                  ) : (
                                    <Unlock className="w-4 h-4" />
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Excluir usuário"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* CREATE / EDIT USER FORM */
            <form onSubmit={handleSaveUser} className="space-y-6 animate-in fade-in">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-sm text-[#0F2744]">
                    {editingUserId ? 'Editar Usuário e Privilégios' : 'Cadastrar Novo Usuário e Senha'}
                  </h4>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditingUser(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 underline font-semibold"
                >
                  Voltar para lista
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-300 text-red-900 rounded-lg text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Basic Credentials Section */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-sky-600" />
                  <span>1. Identificação &amp; Credenciais de Acesso</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div className="sm:col-span-2 md:col-span-1">
                    <label className="font-bold text-slate-700 block mb-1">
                      Nome Completo: *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Marcos Pereira"
                      value={formNome}
                      onChange={e => setFormNome(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 font-semibold focus:border-sky-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Login / Usuário: *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400 font-mono font-bold">@</span>
                      <input
                        type="text"
                        required
                        placeholder="marcos.notas"
                        value={formLogin}
                        onChange={e => setFormLogin(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                        className="w-full border border-slate-300 rounded-lg pl-7 pr-3 py-2.5 bg-white text-slate-900 font-mono font-semibold focus:border-sky-500 outline-none"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Nome de usuário único para login
                    </span>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Senha de Acesso: *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Digite a senha"
                        value={formSenha}
                        onChange={e => setFormSenha(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg pl-3 pr-9 py-2.5 bg-white text-slate-900 font-mono font-semibold focus:border-sky-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                        title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Padrão de demonstração: 123
                    </span>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Perfil / Cargo Base:
                    </label>
                    <select
                      value={formCargo}
                      onChange={e => handleRoleChange(e.target.value as UserRole)}
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-semibold text-slate-900 focus:border-sky-500 outline-none"
                    >
                      <option value="GESTOR">Gestor / Administrador (Acesso e Edição Irrestrita)</option>
                      <option value="OPERADOR">Operador de Lançamentos (Lança e Edita 24h)</option>
                      <option value="MOTORISTA">Motorista Operacional</option>
                      <option value="VISUALIZADOR">Auditor / Visualizador (Somente Leitura)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">E-mail:</label>
                    <input
                      type="email"
                      placeholder="usuario@fleet-telecom.com.br"
                      value={formEmail}
                      onChange={e => setFormEmail(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:border-sky-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Telefone / WhatsApp:</label>
                    <input
                      type="text"
                      placeholder="(91) 98000-0000"
                      value={formTelefone}
                      onChange={e => setFormTelefone(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:border-sky-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Module Navigation Permissions (Onde pode navegar) */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                    <span>2. Onde pode navegar (Módulos Autorizados)</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {formModulos.length} de {availableModules.length} módulos habilitados
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                  {availableModules.map(m => {
                    const isChecked = formModulos.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2.5 transition-all select-none ${
                          isChecked
                            ? 'bg-sky-50/70 border-sky-300 text-sky-950 font-semibold'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleModule(m.id)}
                          className="mt-0.5 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                        <div>
                          <div className="text-xs font-bold">{m.label}</div>
                          <div className="text-[10px] text-slate-500 font-normal">{m.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Granular Editing Privileges (O que pode editar) */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-sky-600" />
                  <span>3. O que pode editar e realizar no sistema (Privilégios)</span>
                </div>

                <div className="space-y-2.5 text-xs">
                  {/* Lançar Notas */}
                  <label className="p-3 rounded-lg border border-slate-200 bg-white flex items-start gap-3 cursor-pointer hover:bg-slate-50 select-none">
                    <input
                      type="checkbox"
                      checked={podeLancarNotas}
                      onChange={e => setPodeLancarNotas(e.target.checked)}
                      className="mt-0.5 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                    <div>
                      <strong className="text-slate-900 block">Lançar Novas Notas &amp; Manutenções (IA e Manual)</strong>
                      <span className="text-[11px] text-slate-500">
                        Permite ao operador usar a inteligência artificial (OCR multimodal) ou o modal manual para registrar despesas e serviços da frota.
                      </span>
                    </div>
                  </label>

                  {/* Edição de Notas Próprias e Regra de 24 horas */}
                  <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-2">
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={podeEditarNotasProprias}
                        onChange={e => setPodeEditarNotasProprias(e.target.checked)}
                        className="mt-0.5 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                      <div>
                        <strong className="text-slate-900 block">Editar Notas Lançadas por Si Mesmo</strong>
                        <span className="text-[11px] text-slate-500">
                          O operador pode corrigir ou ajustar serviços que ele mesmo cadastrou.
                        </span>
                      </div>
                    </label>

                    {podeEditarNotasProprias && (
                      <div className="ml-7 pt-2 border-t border-slate-100 flex items-center gap-3">
                        <label className="text-[11px] font-bold text-slate-700">
                          Limite de tempo para edição própria:
                        </label>
                        <select
                          value={limiteHorasEdicaoPropria}
                          onChange={e => setLimiteHorasEdicaoPropria(Number(e.target.value))}
                          className="border border-slate-300 rounded p-1 text-xs bg-slate-50 font-bold"
                        >
                          <option value="12">Até 12 horas</option>
                          <option value="24">Até 24 horas (Padrão Operacional)</option>
                          <option value="48">Até 48 horas</option>
                          <option value="0">Sem limite de tempo</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Privilégio Administrativo: Editar Qualquer Nota */}
                  <label className="p-3 rounded-lg border border-amber-200 bg-amber-50/40 flex items-start gap-3 cursor-pointer hover:bg-amber-50/80 select-none">
                    <input
                      type="checkbox"
                      checked={podeEditarQualquerNota}
                      onChange={e => setPodeEditarQualquerNota(e.target.checked)}
                      className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-amber-950 block">Privilégio de Gestor: Editar Qualquer Nota a Qualquer Momento</strong>
                        <span className="bg-amber-200 text-amber-900 text-[9px] font-black uppercase px-1.5 py-0.2 rounded">
                          Admin
                        </span>
                      </div>
                      <span className="text-[11px] text-amber-800">
                        Permite alterar lançamentos de qualquer operador mesmo após o prazo de 24 horas expirar.
                      </span>
                    </div>
                  </label>

                  {/* Excluir Notas */}
                  <label className="p-3 rounded-lg border border-slate-200 bg-white flex items-start gap-3 cursor-pointer hover:bg-slate-50 select-none">
                    <input
                      type="checkbox"
                      checked={podeExcluirNotas}
                      onChange={e => setPodeExcluirNotas(e.target.checked)}
                      className="mt-0.5 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                    <div>
                      <strong className="text-slate-900 block">Excluir Lançamentos de Manutenção</strong>
                      <span className="text-[11px] text-slate-500">
                        Permite apagar serviços e despesas da base histórica.
                      </span>
                    </div>
                  </label>

                  {/* Outros Privilégios */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <label className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center gap-2.5 cursor-pointer hover:bg-slate-50 select-none">
                      <input
                        type="checkbox"
                        checked={podeGerenciarVeiculos}
                        onChange={e => setPodeGerenciarVeiculos(e.target.checked)}
                        className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-800">
                        Cadastrar &amp; Editar Veículos
                      </span>
                    </label>

                    <label className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center gap-2.5 cursor-pointer hover:bg-slate-50 select-none">
                      <input
                        type="checkbox"
                        checked={podeGerenciarFornecedores}
                        onChange={e => setPodeGerenciarFornecedores(e.target.checked)}
                        className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-800">
                        Cadastrar &amp; Editar Fornecedores
                      </span>
                    </label>

                    <label className="p-2.5 rounded-lg border border-purple-200 bg-purple-50/30 flex items-center gap-2.5 cursor-pointer hover:bg-purple-50 select-none">
                      <input
                        type="checkbox"
                        checked={podeGerenciarUsuarios}
                        onChange={e => setPodeGerenciarUsuarios(e.target.checked)}
                        className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-purple-950">
                        Gerenciar Usuários &amp; Senhas
                      </span>
                    </label>

                    <label className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center gap-2.5 cursor-pointer hover:bg-slate-50 select-none">
                      <input
                        type="checkbox"
                        checked={podeExportarRelatorios}
                        onChange={e => setPodeExportarRelatorios(e.target.checked)}
                        className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-800">
                        Exportar Relatórios Financeiros
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsEditingUser(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs"
                >
                  {editingUserId ? 'Salvar Alterações do Usuário' : 'Criar e Ativar Usuário'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>Senhas e privilégios salvos no banco local da frota.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-slate-700 hover:text-slate-900 px-3 py-1 bg-white border border-slate-300 rounded-lg"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Switch User with Password Sub-modal */}
      {switchTargetUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 border border-slate-300 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <LogIn className="w-4 h-4 text-sky-600" />
                <h4 className="font-bold text-sm text-[#0F2744]">
                  Confirmar Acesso: {switchTargetUser.nome}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSwitchTargetUser(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Para alternar para o perfil de <strong>{switchTargetUser.nome}</strong> (@{switchTargetUser.login}), informe a senha de acesso:
            </p>

            {switchError && (
              <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                {switchError}
              </div>
            )}

            <form onSubmit={handleConfirmSwitch} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Senha do Usuário:
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="Digite a senha (padrão: 123)"
                  value={switchPasswordInput}
                  onChange={e => setSwitchPasswordInput(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSwitchTargetUser(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold"
                >
                  Entrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
