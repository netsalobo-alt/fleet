import React, { useState, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  Wrench,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  Edit2,
  Trash2,
  Power,
  ExternalLink,
  ShieldAlert,
  Car,
  Tag,
  FileText,
  Clock,
  Layers,
  Sparkles,
  Info,
  X,
  ChevronRight,
  Package,
} from 'lucide-react';
import { Supplier, SupplierCategory, ServiceLog, SystemUser, Vehicle } from '../types';
import { storage } from '../services/storage';
import { validateCpfCnpj, formatCpfCnpj, formatPhone, cleanDocument } from '../utils/validators';
import { LicensePlateBadge } from './LicensePlateBadge';

interface SuppliersViewProps {
  suppliers: Supplier[];
  services: ServiceLog[];
  vehicles: Vehicle[];
  currentUser?: SystemUser;
  onSuppliersUpdated: () => void;
  onNavigateToMaintenance?: (fornecedorId?: string) => void;
}

const CATEGORY_LABELS: Record<SupplierCategory, { label: string; color: string; bg: string; border: string }> = {
  oficina: { label: 'Oficina Mecânica', color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' },
  pecas: { label: 'Auto Peças', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  pneus: { label: 'Pneus & Geometria', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  eletrica: { label: 'Auto Elétrica', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  funilaria: { label: 'Funilaria & Pintura', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  outros: { label: 'Outros Serviços', color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
};

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers,
  services,
  vehicles,
  currentUser,
  onSuppliersUpdated,
  onNavigateToMaintenance,
}) => {
  const isAdmin = currentUser?.cargo === 'GESTOR' || (currentUser as any)?.cargo === 'ADMIN';

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [viewingHistorySupplier, setViewingHistorySupplier] = useState<Supplier | null>(null);
  const [blockedDeleteInfo, setBlockedDeleteInfo] = useState<{ supplier: Supplier; count: number } | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    razaoSocial: string;
    fantasia: string;
    cpfCnpj: string;
    tipoDocumento: 'CPF' | 'CNPJ';
    categoria: SupplierCategory;
    contato: string;
    whatsapp: string;
    email: string;
    endereco: string;
    cidade: string;
    uf: string;
    observacoes: string;
    ativo: boolean;
  }>({
    razaoSocial: '',
    fantasia: '',
    cpfCnpj: '',
    tipoDocumento: 'CNPJ',
    categoria: 'oficina',
    contato: '',
    whatsapp: '',
    email: '',
    endereco: '',
    cidade: 'Belém',
    uf: 'PA',
    observacoes: '',
    ativo: true,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Compute statistics per supplier from services
  const supplierStats = useMemo(() => {
    const stats: Record<
      string,
      {
        totalServices: number;
        totalSpent: number;
        totalParts: number;
        totalLabor: number;
        lastServiceDate: string | null;
        vehiclesPlates: string[];
      }
    > = {};

    suppliers.forEach(sup => {
      // Match by ID, or fallback by name (preserving old historical logs)
      const matched = services.filter(
        s =>
          s.fornecedorId === sup.id ||
          (s.fornecedor &&
            (s.fornecedor.toLowerCase().trim() === sup.fantasia.toLowerCase().trim() ||
              s.fornecedor.toLowerCase().trim() === sup.razaoSocial.toLowerCase().trim()))
      );

      const totalSpent = matched.reduce((sum, s) => sum + (s.valorTotal || 0), 0);
      const totalParts = matched.reduce((sum, s) => sum + (s.valorPecas || 0), 0);
      const totalLabor = matched.reduce((sum, s) => sum + (s.valorMaoDeObra || 0), 0);

      const sortedDates = matched
        .map(s => s.data)
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a));

      const plates = Array.from(new Set(matched.map(s => s.placa).filter(Boolean)));

      stats[sup.id] = {
        totalServices: matched.length,
        totalSpent,
        totalParts,
        totalLabor,
        lastServiceDate: sortedDates[0] || null,
        vehiclesPlates: plates,
      };
    });

    return stats;
  }, [suppliers, services]);

  // Overall KPIs
  const totalActive = suppliers.filter(s => s.ativo).length;
  const totalInactive = suppliers.filter(s => !s.ativo).length;
  const overallSpent = useMemo(() => {
    return Object.values(supplierStats).reduce((sum, st) => sum + st.totalSpent, 0);
  }, [supplierStats]);

  // Filtered Suppliers list
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(sup => {
      // Status filter
      if (statusFilter === 'ACTIVE' && !sup.ativo) return false;
      if (statusFilter === 'INACTIVE' && sup.ativo) return false;

      // Category filter
      if (selectedCategory !== 'ALL' && sup.categoria !== selectedCategory) return false;

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const cleanTerm = cleanDocument(term);
        const matchName =
          sup.fantasia.toLowerCase().includes(term) ||
          sup.razaoSocial.toLowerCase().includes(term) ||
          (sup.contato && sup.contato.toLowerCase().includes(term)) ||
          (sup.cidade && sup.cidade.toLowerCase().includes(term));
        const matchDoc = cleanTerm && cleanDocument(sup.cpfCnpj).includes(cleanTerm);
        if (!matchName && !matchDoc) return false;
      }

      return true;
    });
  }, [suppliers, statusFilter, selectedCategory, searchTerm]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    if (!isAdmin) {
      alert('Apenas administradores (Gestores) possuem permissão para cadastrar ou gerenciar fornecedores.');
      return;
    }
    setEditingSupplier(null);
    setFormData({
      razaoSocial: '',
      fantasia: '',
      cpfCnpj: '',
      tipoDocumento: 'CNPJ',
      categoria: 'oficina',
      contato: '',
      whatsapp: '',
      email: '',
      endereco: '',
      cidade: 'Belém',
      uf: 'PA',
      observacoes: '',
      ativo: true,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (sup: Supplier) => {
    if (!isAdmin) {
      alert('Apenas administradores (Gestores) possuem permissão para alterar dados de fornecedores.');
      return;
    }
    setEditingSupplier(sup);
    setFormData({
      razaoSocial: sup.razaoSocial,
      fantasia: sup.fantasia,
      cpfCnpj: sup.cpfCnpj,
      tipoDocumento: sup.tipoDocumento || 'CNPJ',
      categoria: sup.categoria,
      contato: sup.contato || '',
      whatsapp: sup.whatsapp || '',
      email: sup.email || '',
      endereco: sup.endereco || '',
      cidade: sup.cidade || 'Belém',
      uf: sup.uf || 'PA',
      observacoes: sup.observacoes || '',
      ativo: sup.ativo !== false,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Toggle active/inactive
  const handleToggleStatus = (sup: Supplier) => {
    if (!isAdmin) {
      alert('Apenas administradores (Gestores) podem alterar o status de fornecedores.');
      return;
    }
    try {
      storage.toggleSupplierStatus(sup.id);
      onSuppliersUpdated();
    } catch (e: any) {
      alert(e.message || 'Erro ao alterar status do fornecedor.');
    }
  };

  // Delete Supplier with history protection check
  const handleDeleteSupplier = (sup: Supplier) => {
    if (!isAdmin) {
      alert('Apenas administradores (Gestores) podem excluir fornecedores.');
      return;
    }

    const stats = supplierStats[sup.id];
    if (stats && stats.totalServices > 0) {
      setBlockedDeleteInfo({ supplier: sup, count: stats.totalServices });
      return;
    }

    if (confirm(`Deseja realmente excluir o fornecedor "${sup.fantasia}"? Esta ação removerá o cadastro permanentemente.`)) {
      const res = storage.deleteSupplier(sup.id);
      if (!res.success) {
        alert(res.message);
      } else {
        onSuppliersUpdated();
      }
    }
  };

  // Validate and Save
  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.fantasia.trim()) {
      errors.fantasia = 'Nome Fantasia é obrigatório';
    }
    if (!formData.razaoSocial.trim()) {
      errors.razaoSocial = 'Razão Social é obrigatória';
    }

    // Document Validation
    const docValidation = validateCpfCnpj(formData.cpfCnpj);
    if (!docValidation.isValid) {
      errors.cpfCnpj = docValidation.errorMessage || 'Documento inválido';
    } else {
      // Check duplications against other suppliers
      const cleanDoc = docValidation.clean;
      const isDuplicate = suppliers.some(
        s => (!editingSupplier || s.id !== editingSupplier.id) && cleanDocument(s.cpfCnpj) === cleanDoc
      );
      if (isDuplicate) {
        errors.cpfCnpj = 'Já existe um fornecedor cadastrado com este mesmo CPF/CNPJ';
      }
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'E-mail em formato inválido';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const formattedDoc = formatCpfCnpj(formData.cpfCnpj);
      const formattedPhoneNum = formData.whatsapp ? formatPhone(formData.whatsapp) : '';

      if (editingSupplier) {
        storage.updateSupplier({
          ...editingSupplier,
          razaoSocial: formData.razaoSocial.trim(),
          fantasia: formData.fantasia.trim(),
          cpfCnpj: formattedDoc,
          tipoDocumento: docValidation.type === 'CPF' ? 'CPF' : 'CNPJ',
          categoria: formData.categoria,
          contato: formData.contato.trim(),
          whatsapp: formattedPhoneNum,
          email: formData.email.trim(),
          endereco: formData.endereco.trim(),
          cidade: formData.cidade.trim(),
          uf: formData.uf.trim().toUpperCase() || 'PA',
          observacoes: formData.observacoes.trim(),
          ativo: formData.ativo,
        });
      } else {
        storage.addSupplier({
          razaoSocial: formData.razaoSocial.trim(),
          fantasia: formData.fantasia.trim(),
          cpfCnpj: formattedDoc,
          tipoDocumento: docValidation.type === 'CPF' ? 'CPF' : 'CNPJ',
          categoria: formData.categoria,
          contato: formData.contato.trim(),
          whatsapp: formattedPhoneNum,
          email: formData.email.trim(),
          endereco: formData.endereco.trim(),
          cidade: formData.cidade.trim(),
          uf: formData.uf.trim().toUpperCase() || 'PA',
          observacoes: formData.observacoes.trim(),
          ativo: formData.ativo,
        });
      }

      setIsModalOpen(false);
      onSuppliersUpdated();
    } catch (err: any) {
      setFormErrors({ submit: err.message || 'Erro ao salvar fornecedor' });
    }
  };

  // Get services for a specific supplier for History view
  const getSupplierHistoryServices = (sup: Supplier): ServiceLog[] => {
    return services
      .filter(
        s =>
          s.fornecedorId === sup.id ||
          (s.fornecedor &&
            (s.fornecedor.toLowerCase().trim() === sup.fantasia.toLowerCase().trim() ||
              s.fornecedor.toLowerCase().trim() === sup.razaoSocial.toLowerCase().trim()))
      )
      .sort((a, b) => b.data.localeCompare(a.data));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 mb-1">
            <span>Cadastros</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-700">Fornecedores Credenciados</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0F2744] flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-sky-600" />
            <span>Gestão de Fornecedores &amp; Oficinas</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cadastro de oficinas, autopeças, pneus e autoelétricas com validação fiscal e histórico financeiro de OS.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreateModal}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all active:scale-95 ${
              isAdmin
                ? 'bg-[#0F2744] hover:bg-slate-800 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-500 cursor-not-allowed opacity-80'
            }`}
            title={isAdmin ? 'Cadastrar novo fornecedor' : 'Apenas Administrador (Gestor) pode cadastrar'}
          >
            <Plus className="w-4 h-4 text-sky-400" />
            <span>Novo Fornecedor</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Ativos</span>
            <p className="text-2xl font-extrabold text-[#0F2744] mt-0.5">{totalActive}</p>
            <span className="text-[11px] text-emerald-600 font-medium">Credenciados para lançamentos</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inativos</span>
            <p className="text-2xl font-extrabold text-slate-600 mt-0.5">{totalInactive}</p>
            <span className="text-[11px] text-slate-400 font-medium">Bloqueados para novas OS</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-200">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Gasto em OS</span>
            <p className="text-2xl font-extrabold text-[#0F2744] mt-0.5">
              R$ {overallSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[11px] text-sky-600 font-medium">Faturamento acumulado</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Controle RBAC</span>
            <p className="text-sm font-bold text-[#0F2744] mt-1 flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-amber-500' : 'bg-sky-500'}`}
              ></span>
              {isAdmin ? 'Administrador (Gestor)' : 'Operador (Consulta)'}
            </p>
            <span className="text-[11px] text-slate-500">
              {isAdmin ? 'Gerenciamento pleno liberado' : 'Consulta e seleção em OS'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por razão social, nome fantasia, CNPJ/CPF ou cidade..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:bg-white text-slate-700 font-medium"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.8 text-slate-700 font-medium focus:ring-2 focus:ring-sky-500"
            >
              <option value="ALL">Todas as Categorias</option>
              <option value="oficina">Oficina Mecânica</option>
              <option value="pecas">Auto Peças</option>
              <option value="pneus">Pneus &amp; Geometria</option>
              <option value="eletrica">Auto Elétrica</option>
              <option value="funilaria">Funilaria &amp; Pintura</option>
              <option value="outros">Outros</option>
            </select>
          </div>

          {/* Status Segmented Buttons */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                statusFilter === 'ALL' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Todos ({suppliers.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                statusFilter === 'ACTIVE' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Ativos ({totalActive})
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                statusFilter === 'INACTIVE' ? 'bg-white text-slate-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Inativos ({totalInactive})
            </button>
          </div>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0F2744] text-white uppercase text-[11px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Fornecedor / Razão Social</th>
                <th className="py-3 px-4">Documento</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Contato / Localidade</th>
                <th className="py-3 px-4 text-center">Atendimentos</th>
                <th className="py-3 px-4 text-right">Total Gasto</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Building2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-600">Nenhum fornecedor encontrado</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Tente alterar os filtros de busca ou cadastre um novo fornecedor.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map(sup => {
                  const stats = supplierStats[sup.id] || {
                    totalServices: 0,
                    totalSpent: 0,
                    totalParts: 0,
                    totalLabor: 0,
                    lastServiceDate: null,
                    vehiclesPlates: [],
                  };
                  const catConfig = CATEGORY_LABELS[sup.categoria] || CATEGORY_LABELS.outros;

                  // Clean WhatsApp link for 1-click chatting
                  const cleanWa = cleanDocument(sup.whatsapp);
                  const waUrl = cleanWa ? `https://wa.me/55${cleanWa}` : null;

                  return (
                    <tr
                      key={sup.id}
                      className={`hover:bg-slate-50/80 transition-colors ${!sup.ativo ? 'opacity-65 bg-slate-50/40' : ''}`}
                    >
                      {/* Name / Razão Social */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              sup.ativo ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-sm">{sup.fantasia}</span>
                              {!sup.ativo && (
                                <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-semibold">
                                  Inativo
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 leading-tight mt-0.5 line-clamp-1">
                              {sup.razaoSocial}
                            </p>
                            {sup.observacoes && (
                              <p className="text-[10px] text-slate-400 italic line-clamp-1 mt-0.5">
                                {sup.observacoes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* CNPJ / CPF */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                        <span className="text-slate-400 text-[10px] mr-1">{sup.tipoDocumento}:</span>
                        <strong>{sup.cpfCnpj}</strong>
                      </td>

                      {/* Categoria */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${catConfig.bg} ${catConfig.color} ${catConfig.border}`}
                        >
                          <Tag className="w-3 h-3" />
                          {catConfig.label}
                        </span>
                      </td>

                      {/* Contato / Localidade */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1 text-[11px]">
                          {sup.contato && (
                            <div className="text-slate-800 font-medium">{sup.contato}</div>
                          )}
                          <div className="flex items-center gap-2 text-slate-500 flex-wrap">
                            {sup.whatsapp && (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="w-3 h-3 text-emerald-600" />
                                {waUrl ? (
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:underline text-emerald-700 font-semibold flex items-center gap-0.5"
                                    title="Abrir WhatsApp"
                                  >
                                    {sup.whatsapp}
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                ) : (
                                  sup.whatsapp
                                )}
                              </span>
                            )}
                            {sup.email && (
                              <span className="inline-flex items-center gap-1 text-slate-500">
                                <Mail className="w-3 h-3 text-slate-400" />
                                <span className="truncate max-w-[140px]">{sup.email}</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>
                              {sup.cidade} - {sup.uf}
                              {sup.endereco ? ` • ${sup.endereco}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Atendimentos Realizados */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => setViewingHistorySupplier(sup)}
                          className="inline-flex flex-col items-center hover:bg-sky-50 px-2 py-1 rounded-lg transition-colors cursor-pointer group"
                          title="Clique para ver o histórico detalhado de serviços"
                        >
                          <span className="text-sm font-extrabold text-[#0F2744] group-hover:text-sky-600">
                            {stats.totalServices} OS
                          </span>
                          <span className="text-[10px] text-slate-400 group-hover:text-sky-600 flex items-center gap-0.5">
                            <History className="w-2.5 h-2.5" />
                            {stats.lastServiceDate ? stats.lastServiceDate.split('-').reverse().join('/') : 'Sem OS'}
                          </span>
                        </button>
                      </td>

                      {/* Total Gasto */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="font-extrabold text-slate-900 text-xs">
                          R$ {stats.totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {stats.totalSpent > 0 && (
                          <div className="text-[10px] text-slate-400">
                            P: R$ {stats.totalParts.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} | MO: R${' '}
                            {stats.totalLabor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            sup.ativo
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${sup.ativo ? 'bg-emerald-500' : 'bg-slate-400'}`}
                          ></span>
                          {sup.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {/* Histórico button */}
                          <button
                            onClick={() => setViewingHistorySupplier(sup)}
                            className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 transition-colors"
                            title="Ver histórico de manutenções"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {/* Editar button */}
                          <button
                            onClick={() => handleOpenEditModal(sup)}
                            disabled={!isAdmin}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isAdmin
                                ? 'text-slate-600 hover:bg-slate-100 cursor-pointer'
                                : 'text-slate-300 cursor-not-allowed'
                            }`}
                            title={isAdmin ? 'Editar fornecedor' : 'Apenas Administrador pode editar'}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Inativar / Ativar toggle */}
                          <button
                            onClick={() => handleToggleStatus(sup)}
                            disabled={!isAdmin}
                            className={`p-1.5 rounded-lg transition-colors ${
                              !isAdmin
                                ? 'text-slate-300 cursor-not-allowed'
                                : sup.ativo
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={
                              !isAdmin
                                ? 'Apenas Administrador pode alterar status'
                                : sup.ativo
                                ? 'Inativar fornecedor'
                                : 'Reativar fornecedor'
                            }
                          >
                            <Power className="w-4 h-4" />
                          </button>

                          {/* Excluir button */}
                          <button
                            onClick={() => handleDeleteSupplier(sup)}
                            disabled={!isAdmin}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isAdmin
                                ? 'text-rose-600 hover:bg-rose-50 cursor-pointer'
                                : 'text-slate-300 cursor-not-allowed'
                            }`}
                            title={
                              isAdmin
                                ? 'Excluir fornecedor (bloqueado se tiver histórico)'
                                : 'Apenas Administrador pode excluir'
                            }
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* CREATE / EDIT SUPPLIER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full my-8 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-[#0F2744] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingSupplier ? 'Editar Fornecedor' : 'Cadastrar Novo Fornecedor'}
                  </h3>
                  <p className="text-xs text-slate-300">
                    Preencha os dados cadastrais e fiscais com validação em tempo real.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-300 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4">
              {formErrors.submit && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{formErrors.submit}</span>
                </div>
              )}

              {/* Row 1: Documento (CPF / CNPJ) & Tipo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tipo de Documento <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.tipoDocumento}
                    onChange={e => setFormData({ ...formData, tipoDocumento: e.target.value as 'CPF' | 'CNPJ' })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="CNPJ">CNPJ (Pessoa Jurídica)</option>
                    <option value="CPF">CPF (Profissional / MEI)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {formData.tipoDocumento} (com validação oficial) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder={formData.tipoDocumento === 'CNPJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                    value={formData.cpfCnpj}
                    onChange={e => {
                      const formatted = formatCpfCnpj(e.target.value);
                      setFormData({ ...formData, cpfCnpj: formatted });
                      if (formErrors.cpfCnpj) {
                        setFormErrors({ ...formErrors, cpfCnpj: '' });
                      }
                    }}
                    className={`w-full text-xs font-mono bg-slate-50 border rounded-lg px-3 py-2 text-slate-800 font-semibold focus:ring-2 focus:ring-sky-500 ${
                      formErrors.cpfCnpj ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.cpfCnpj && (
                    <span className="text-[11px] text-red-600 font-medium mt-1 block">
                      {formErrors.cpfCnpj}
                    </span>
                  )}
                </div>
              </div>

              {/* Row 2: Nome Fantasia & Razão Social */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome Fantasia <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Auto Centro Belém Doca"
                    value={formData.fantasia}
                    onChange={e => {
                      setFormData({ ...formData, fantasia: e.target.value });
                      if (formErrors.fantasia) setFormErrors({ ...formErrors, fantasia: '' });
                    }}
                    className={`w-full text-xs bg-slate-50 border rounded-lg px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 ${
                      formErrors.fantasia ? 'border-red-400' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.fantasia && (
                    <span className="text-[11px] text-red-600 font-medium mt-1 block">
                      {formErrors.fantasia}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Razão Social Oficial <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Auto Centro Belém Peças e Serviços Ltda"
                    value={formData.razaoSocial}
                    onChange={e => {
                      setFormData({ ...formData, razaoSocial: e.target.value });
                      if (formErrors.razaoSocial) setFormErrors({ ...formErrors, razaoSocial: '' });
                    }}
                    className={`w-full text-xs bg-slate-50 border rounded-lg px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 ${
                      formErrors.razaoSocial ? 'border-red-400' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.razaoSocial && (
                    <span className="text-[11px] text-red-600 font-medium mt-1 block">
                      {formErrors.razaoSocial}
                    </span>
                  )}
                </div>
              </div>

              {/* Row 3: Categoria & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Categoria do Fornecedor <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.categoria}
                    onChange={e => setFormData({ ...formData, categoria: e.target.value as SupplierCategory })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="oficina">Oficina Mecânica (Motor, Câmbio, Suspensão)</option>
                    <option value="pecas">Auto Peças (Distribuidora, Insumos)</option>
                    <option value="pneus">Pneus &amp; Geometria (Alinhamento 3D, Balanceamento)</option>
                    <option value="eletrica">Auto Elétrica (Baterias, Alternador, Chicote)</option>
                    <option value="funilaria">Funilaria &amp; Pintura (Lataria, Estufa)</option>
                    <option value="outros">Outros Serviços Automotivos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status Operacional</label>
                  <div className="flex items-center gap-3 mt-1.5">
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={formData.ativo === true}
                        onChange={() => setFormData({ ...formData, ativo: true })}
                        className="text-sky-600 focus:ring-sky-500"
                      />
                      <span className="font-semibold text-emerald-700">Ativo</span> (apto para lançamentos)
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={formData.ativo === false}
                        onChange={() => setFormData({ ...formData, ativo: false })}
                        className="text-sky-600 focus:ring-sky-500"
                      />
                      <span className="font-semibold text-slate-600">Inativo</span> (bloqueado)
                    </label>
                  </div>
                </div>
              </div>

              {/* Row 4: Contato, WhatsApp & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome do Contato / Responsável
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Raimundo Nonato"
                    value={formData.contato}
                    onChange={e => setFormData({ ...formData, contato: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    WhatsApp / Telefone
                  </label>
                  <input
                    type="text"
                    placeholder="(91) 98122-3344"
                    value={formData.whatsapp}
                    onChange={e => setFormData({ ...formData, whatsapp: formatPhone(e.target.value) })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail Comercial</label>
                  <input
                    type="email"
                    placeholder="contato@empresa.com.br"
                    value={formData.email}
                    onChange={e => {
                      setFormData({ ...formData, email: e.target.value });
                      if (formErrors.email) setFormErrors({ ...formErrors, email: '' });
                    }}
                    className={`w-full text-xs bg-slate-50 border rounded-lg px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 ${
                      formErrors.email ? 'border-red-400' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.email && (
                    <span className="text-[11px] text-red-600 font-medium mt-1 block">
                      {formErrors.email}
                    </span>
                  )}
                </div>
              </div>

              {/* Row 5: Endereço, Cidade e UF */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Endereço Completo
                  </label>
                  <input
                    type="text"
                    placeholder="Av. Visconde de Souza Franco, 1250, Reduto"
                    value={formData.endereco}
                    onChange={e => setFormData({ ...formData, endereco: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cidade</label>
                  <input
                    type="text"
                    placeholder="Belém"
                    value={formData.cidade}
                    onChange={e => setFormData({ ...formData, cidade: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">UF</label>
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="PA"
                    value={formData.uf}
                    onChange={e => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                    className="w-full text-xs font-mono uppercase bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-bold focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Row 6: Observações */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações Técnicas / Condições Comerciais
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Tabela de preços diferenciada para frotas; prazo de pagamento de 30 dias; oficina credenciada."
                  value={formData.observacoes}
                  onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-sky-500"
                ></textarea>
              </div>

              {/* Form Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#0F2744] hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{editingSupplier ? 'Atualizar Fornecedor' : 'Salvar Fornecedor'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPPLIER HISTORY DRAWER / MODAL */}
      {viewingHistorySupplier && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full my-8 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-[#0F2744] text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center">
                  <History className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">{viewingHistorySupplier.fantasia}</h3>
                    <span
                      className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
                        viewingHistorySupplier.ativo
                          ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                          : 'bg-slate-400/20 text-slate-300'
                      }`}
                    >
                      {viewingHistorySupplier.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {viewingHistorySupplier.razaoSocial} • CNPJ/CPF: {viewingHistorySupplier.cpfCnpj}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingHistorySupplier(null)}
                className="text-slate-300 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial & Operational Summary Strip */}
            {(() => {
              const stats = supplierStats[viewingHistorySupplier.id] || {
                totalServices: 0,
                totalSpent: 0,
                totalParts: 0,
                totalLabor: 0,
                lastServiceDate: null,
                vehiclesPlates: [],
              };
              const histServices = getSupplierHistoryServices(viewingHistorySupplier);

              return (
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase">Total de Ordens de Serviço</span>
                      <p className="text-xl font-extrabold text-[#0F2744] mt-1">{stats.totalServices} OS</p>
                      <span className="text-[10px] text-slate-400">
                        {stats.vehiclesPlates.length} veículos atendidos
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase">Gasto Total Acumulado</span>
                      <p className="text-xl font-extrabold text-sky-700 mt-1">
                        R$ {stats.totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <span className="text-[10px] text-slate-400">Total liquidado</span>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Peças &amp; Insumos</span>
                      <p className="text-xl font-extrabold text-indigo-700 mt-1">
                        R$ {stats.totalParts.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <span className="text-[10px] text-slate-400">
                        {stats.totalSpent > 0 ? Math.round((stats.totalParts / stats.totalSpent) * 100) : 0}% do custo
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Mão de Obra</span>
                      <p className="text-xl font-extrabold text-emerald-700 mt-1">
                        R$ {stats.totalLabor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <span className="text-[10px] text-slate-400">
                        {stats.totalSpent > 0 ? Math.round((stats.totalLabor / stats.totalSpent) * 100) : 0}% do custo
                      </span>
                    </div>
                  </div>

                  {/* Supplier Contact & Location Card */}
                  <div className="bg-sky-50/60 p-4 rounded-xl border border-sky-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-sky-600 shrink-0" />
                      <span>
                        <strong>Endereço:</strong> {viewingHistorySupplier.endereco || 'Não informado'},{' '}
                        {viewingHistorySupplier.cidade} - {viewingHistorySupplier.uf}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      {viewingHistorySupplier.contato && (
                        <span>
                          <strong>Contato:</strong> {viewingHistorySupplier.contato}
                        </span>
                      )}
                      {viewingHistorySupplier.whatsapp && (
                        <span>
                          <strong>WhatsApp:</strong> {viewingHistorySupplier.whatsapp}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Services History List */}
                  <div>
                    <h4 className="text-xs font-bold text-[#0F2744] uppercase tracking-wider mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-sky-600" />
                      <span>Histórico Cronológico de Atendimentos ({histServices.length})</span>
                    </h4>

                    {histServices.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400">
                        <Wrench className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="text-xs font-semibold text-slate-600">Nenhum serviço registrado neste fornecedor ainda.</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Ao lançar um serviço na aba &quot;Lançar com IA&quot;, selecione este fornecedor para vincular a OS.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {histServices.map((srv, idx) => (
                          <div
                            key={srv.id || idx}
                            className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-sky-300 transition-colors"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                              <div className="flex items-center gap-3">
                                <LicensePlateBadge placa={srv.placa} size="sm" />
                                <div>
                                  <span className="font-bold text-slate-800 text-xs">{srv.modelo}</span>
                                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3 text-slate-400" />
                                      {srv.data.split('-').reverse().join('/')}
                                    </span>
                                    <span>•</span>
                                    <span>{srv.odometro.toLocaleString('pt-BR')} km</span>
                                    <span>•</span>
                                    <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold text-[10px]">
                                      {srv.tipo}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <span className="text-xs font-extrabold text-[#0F2744]">
                                  R$ {srv.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                                <div className="text-[10px] text-slate-400">
                                  Peças: R$ {srv.valorPecas.toLocaleString('pt-BR')} • Mão de Obra: R${' '}
                                  {srv.valorMaoDeObra.toLocaleString('pt-BR')}
                                </div>
                              </div>
                            </div>

                            {/* Items / Parts and Services Breakout */}
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                              {/* Parts */}
                              {srv.pecas && srv.pecas.length > 0 && (
                                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                  <span className="font-semibold text-slate-700 flex items-center gap-1 mb-1.5">
                                    <Package className="w-3 h-3 text-indigo-500" />
                                    Peças Utilizadas ({srv.pecas.length})
                                  </span>
                                  <ul className="space-y-1">
                                    {srv.pecas.map((p, pIdx) => (
                                      <li key={pIdx} className="flex justify-between text-slate-600">
                                        <span className="truncate pr-2">
                                          {p.quantidade}x {p.descricao}
                                        </span>
                                        <strong className="text-slate-800 shrink-0">
                                          R$ {p.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </strong>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Labor */}
                              {srv.servicos && srv.servicos.length > 0 && (
                                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                  <span className="font-semibold text-slate-700 flex items-center gap-1 mb-1.5">
                                    <Wrench className="w-3 h-3 text-emerald-500" />
                                    Mão de Obra Executada ({srv.servicos.length})
                                  </span>
                                  <ul className="space-y-1">
                                    {srv.servicos.map((sItem, sIdx) => (
                                      <li key={sIdx} className="flex justify-between text-slate-600">
                                        <span className="truncate pr-2">{sItem.descricao}</span>
                                        <strong className="text-slate-800 shrink-0">
                                          R$ {sItem.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </strong>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>

                            {srv.observacoes && (
                              <p className="mt-2.5 text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                                <strong className="text-slate-700">Observações da OS:</strong> {srv.observacoes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">
                Histórico auditado e preservado pela integridade do Supabase PostgreSQL.
              </span>
              <button
                onClick={() => setViewingHistorySupplier(null)}
                className="px-4 py-2 bg-[#0F2744] hover:bg-slate-800 text-white rounded-xl text-xs font-semibold"
              >
                Fechar Histórico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BLOCKED DELETION MODAL (RULE 5) */}
      {blockedDeleteInfo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <h3 className="text-base font-bold text-slate-900">
              Exclusão Bloqueada por Integridade Fiscal
            </h3>

            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              O fornecedor <strong className="text-slate-800">{blockedDeleteInfo.supplier.fantasia}</strong> possui{' '}
              <strong className="text-amber-700">{blockedDeleteInfo.count} ordem(ns) de serviço</strong> vinculadas ao
              seu histórico.
            </p>

            <p className="text-xs text-slate-500 mt-2">
              Conforme as regras de governança e auditoria da frota,{' '}
              <strong>não é permitido excluir fornecedores com histórico</strong>. Em vez disso, você pode{' '}
              <strong>inativar o cadastro</strong> para impedir novas ordens de serviço.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
              <button
                onClick={() => setBlockedDeleteInfo(null)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200"
              >
                Voltar
              </button>
              <button
                onClick={() => {
                  storage.toggleSupplierStatus(blockedDeleteInfo.supplier.id);
                  onSuppliersUpdated();
                  setBlockedDeleteInfo(null);
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-1.5"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Inativar Fornecedor</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
