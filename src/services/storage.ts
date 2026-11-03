import {
  Vehicle,
  ServiceLog,
  RevisionPlan,
  RevisionEditAudit,
  LicenciamentoPA,
  TelemetryAlert,
  SystemUser,
  SystemSettings,
  ChatwootLog,
  IntegrationLog,
  Supplier,
  SupplierCategory,
} from '../types';
import { calcularLicenciamentoPA, getDefaultDetranCalendar } from '../utils/detranPA';

const STORAGE_VERSION = 'fleet_real_v2';

const STORAGE_KEYS = {
  VEHICLES: `${STORAGE_VERSION}_vehicles`,
  SERVICES: `${STORAGE_VERSION}_services`,
  SUPPLIERS: `${STORAGE_VERSION}_suppliers`,
  REVISIONS: `${STORAGE_VERSION}_revisions`,
  LICENSING: `${STORAGE_VERSION}_licensing`,
  ALERTS: `${STORAGE_VERSION}_alerts`,
  USERS: `${STORAGE_VERSION}_users`,
  SETTINGS: `${STORAGE_VERSION}_settings`,
  CHATWOOT_LOGS: `${STORAGE_VERSION}_chatwoot_logs`,
  INTEGRATION_LOGS: `${STORAGE_VERSION}_integration_logs`,
  ACTIVE_USER: `${STORAGE_VERSION}_active_user`,
};

// Initial clean settings configured for real Selsyn API, Chatwoot, and OpenAI
export const INITIAL_SETTINGS: SystemSettings = {
  tracking: {
    baseUrl: 'https://api.appselsyn.com.br/',
    xApiKey: '',
    token: '',
    operadorKey: '',
    clienteId: undefined,
    autoSyncInterval: 30,
    modoSimulacao: false,
  },
  chatwoot: {
    baseUrl: 'https://chatwoot.suaempresa.com.br',
    apiAccessToken: '',
    accountId: '1',
    inboxId: '1',
    conversationId: '',
    autoAlertsEnabled: true,
    notifyOnMaintenance: true,
    notifyOnDetran: true,
    notifyOnTelemetryAlert: true,
  },
  detran: {
    exercicio: 2026,
    taxaLicenciamento: 254.12,
    aliquotaPasseio: 2.5,
    aliquotaUtilitario: 1.0,
    calendarioOficial: getDefaultDetranCalendar(2026),
  },
  openai: {
    apiKey: '',
    model: 'gpt-4o',
    preferredProvider: 'openai',
  },
  supabase: {
    url: '',
    publishableKey: '',
    storageBucket: 'documentos-frota',
    environment: 'development',
    autoSyncEnabled: false,
  },
};

import { UserPermissions, UserRole } from '../types';

export function getDefaultPermissionsByRole(role: UserRole): UserPermissions {
  if (role === 'GESTOR') {
    return {
      modulosPermitidos: [
        'dashboard',
        'vehicles',
        'suppliers',
        'revisions',
        'maintenance',
        'tracking',
        'detran',
        'reports',
        'alerts',
        'config',
      ],
      podeLancarNotas: true,
      podeEditarNotasProprias: true,
      limiteHorasEdicaoPropria: 0, // ilimitado para gestor
      podeEditarQualquerNota: true, // gestor edita qualquer nota
      podeExcluirNotas: true,
      podeGerenciarVeiculos: true,
      podeGerenciarFornecedores: true,
      podeGerenciarUsuarios: true,
      podeExportarRelatorios: true,
    };
  }

  if (role === 'OPERADOR') {
    return {
      modulosPermitidos: [
        'dashboard',
        'vehicles',
        'suppliers',
        'revisions',
        'maintenance',
        'detran',
      ],
      podeLancarNotas: true,
      podeEditarNotasProprias: true,
      limiteHorasEdicaoPropria: 24, // regra de 24 horas
      podeEditarQualquerNota: false,
      podeExcluirNotas: false,
      podeGerenciarVeiculos: false,
      podeGerenciarFornecedores: false,
      podeGerenciarUsuarios: false,
      podeExportarRelatorios: false,
    };
  }

  if (role === 'MOTORISTA') {
    return {
      modulosPermitidos: ['dashboard', 'revisions', 'vehicles'],
      podeLancarNotas: false,
      podeEditarNotasProprias: false,
      limiteHorasEdicaoPropria: 0,
      podeEditarQualquerNota: false,
      podeExcluirNotas: false,
      podeGerenciarVeiculos: false,
      podeGerenciarFornecedores: false,
      podeGerenciarUsuarios: false,
      podeExportarRelatorios: false,
    };
  }

  // VISUALIZADOR / AUDITOR
  return {
    modulosPermitidos: ['dashboard', 'vehicles', 'suppliers', 'revisions', 'reports', 'detran'],
    podeLancarNotas: false,
    podeEditarNotasProprias: false,
    limiteHorasEdicaoPropria: 0,
    podeEditarQualquerNota: false,
    podeExcluirNotas: false,
    podeGerenciarVeiculos: false,
    podeGerenciarFornecedores: false,
    podeGerenciarUsuarios: false,
    podeExportarRelatorios: true,
  };
}

export function canUserAccessModule(user: SystemUser, moduleTab: string): boolean {
  if (!user || user.status === 'INATIVO') return false;
  if (user.cargo === 'GESTOR') return true;
  const allowed = user.permissoes?.modulosPermitidos || getDefaultPermissionsByRole(user.cargo).modulosPermitidos;
  return allowed.includes(moduleTab);
}

export function canUserEditService(user: SystemUser, service: ServiceLog): { allowed: boolean; reason?: string } {
  if (!user || user.status === 'INATIVO') {
    return { allowed: false, reason: 'Usuário inativo ou não autenticado.' };
  }

  const perms = user.permissoes || getDefaultPermissionsByRole(user.cargo);

  // Privilégio de Gestor/Admin
  if (perms.podeEditarQualquerNota || user.cargo === 'GESTOR') {
    return { allowed: true };
  }

  // Se não tem permissão nem de editar as próprias
  if (!perms.podeEditarNotasProprias) {
    return {
      allowed: false,
      reason: 'Seu perfil não possui permissão para editar notas ou lançamentos de manutenção.',
    };
  }

  // Verifica se é o autor
  const isAuthor =
    service.criadoPorId === user.id ||
    (service.criadoPorNome && service.criadoPorNome.toLowerCase() === user.nome.toLowerCase());

  if (!isAuthor) {
    return {
      allowed: false,
      reason: `Este lançamento foi criado por ${service.criadoPorNome || 'outro operador'}. Apenas o autor ou um Administrador podem alterá-lo.`,
    };
  }

  // Verifica limite de tempo (ex: 24h)
  const limitHours = perms.limiteHorasEdicaoPropria ?? 24;
  if (limitHours > 0) {
    const createdAtTime = new Date(service.createdAt || service.data).getTime();
    const diffHours = (Date.now() - createdAtTime) / (1000 * 60 * 60);

    if (diffHours > limitHours) {
      return {
        allowed: false,
        reason: `O prazo de edição de ${limitHours}h expirou para este lançamento (criado há ${Math.round(diffHours)}h). Solicite a alteração a um Gestor/Administrador.`,
      };
    }
  }

  return { allowed: true };
}

// Default system users with credentials and granular permissions
export const DEFAULT_SYSTEM_USERS: SystemUser[] = [
  {
    id: 'usr-admin-1',
    nome: 'Carlos Henrique',
    login: 'carlos.gestao',
    senha: '123',
    email: 'gestao@fleet-telecom.com.br',
    cpf: '123.456.789-00',
    cargo: 'GESTOR', // Administrador
    status: 'ATIVO',
    telefone: '(91) 98123-4567',
    dataCriacao: '2026-01-10T08:00:00.000Z',
    permissoes: getDefaultPermissionsByRole('GESTOR'),
  },
  {
    id: 'usr-op-1',
    nome: 'Marcos Pereira',
    login: 'marcos.notas',
    senha: '123',
    email: 'marcos.operador@fleet-telecom.com.br',
    cpf: '234.567.890-11',
    cargo: 'OPERADOR', // Usuário responsável pelo lançamento de notas
    status: 'ATIVO',
    telefone: '(91) 98234-5678',
    dataCriacao: '2026-01-15T09:30:00.000Z',
    permissoes: getDefaultPermissionsByRole('OPERADOR'),
  },
  {
    id: 'usr-op-2',
    nome: 'Ana Beatriz',
    login: 'ana.lancamento',
    senha: '123',
    email: 'ana.operadora@fleet-telecom.com.br',
    cpf: '345.678.901-22',
    cargo: 'OPERADOR',
    status: 'ATIVO',
    telefone: '(91) 98345-6789',
    dataCriacao: '2026-02-01T10:00:00.000Z',
    permissoes: getDefaultPermissionsByRole('OPERADOR'),
  },
  {
    id: 'usr-mot-1',
    nome: 'Roberto Lima',
    login: 'roberto.motorista',
    senha: '123',
    email: 'roberto.motorista@fleet-telecom.com.br',
    cpf: '456.789.012-33',
    cargo: 'MOTORISTA',
    status: 'ATIVO',
    telefone: '(91) 98456-7890',
    cnh: '05432198760',
    cnhCategoria: 'AD',
    cnhValidade: '2027-05-20',
    dataCriacao: '2026-02-10T11:00:00.000Z',
    permissoes: getDefaultPermissionsByRole('MOTORISTA'),
  },
];


export const INITIAL_USERS: SystemUser[] = DEFAULT_SYSTEM_USERS;
export const INITIAL_VEHICLES: Vehicle[] = [];
export const INITIAL_SERVICES: ServiceLog[] = [];
export const INITIAL_REVISIONS: RevisionPlan[] = [];
export const INITIAL_ALERTS: TelemetryAlert[] = [];

// Realistic Preset for testing and demonstration
export const DEMO_PRESET_VEHICLES: Vehicle[] = [
  {
    id: 'v-1',
    placa: 'QEN-4521',
    modelo: 'Onix Plus Premier 1.0 Turbo',
    marca: 'Chevrolet',
    ano: 2022,
    cor: 'Prata Switchblade',
    categoria: 'PASSEIO',
    chassi: '9BGKS69X0NG184920',
    renavam: '01294827104',
    odometroAtual: 48920,
    horimetro: 1420,
    status: 'OPERANDO',
    combustivel: 'FLEX',
    localizacao: {
      lat: -1.4558,
      lng: -48.4902,
      cidade: 'Belém',
      uf: 'PA',
      endereco: 'Av. Visconde de Souza Franco (Doca), Reduto, Belém - PA',
    },
    ignicao: true,
    velocidade: 42,
    bloqueado: false,
    nivelTanque: 68,
    bateriaVolts: 13.8,
    ultimaComunicacao: new Date().toISOString(),
    valorVenalFipe: 78500,
    tempoSemMultasAnos: 2,
  },
  {
    id: 'v-2',
    placa: 'QDA-1092',
    modelo: 'Hilux CD SRV 4x4 2.8 Diesel Aut.',
    marca: 'Toyota',
    ano: 2021,
    cor: 'Branco Polar',
    categoria: 'UTILITARIO',
    chassi: '8AJBA3CD8M1294811',
    renavam: '01183746291',
    odometroAtual: 62450,
    horimetro: 2180,
    status: 'ALERTA',
    combustivel: 'DIESEL_S10',
    localizacao: {
      lat: -5.3686,
      lng: -49.1174,
      cidade: 'Marabá',
      uf: 'PA',
      endereco: 'Rodovia Transamazônica BR-230, Km 4, Nova Marabá - PA',
    },
    ignicao: true,
    velocidade: 86,
    bloqueado: false,
    nivelTanque: 45,
    bateriaVolts: 14.1,
    ultimaComunicacao: new Date().toISOString(),
    valorVenalFipe: 215000,
    tempoSemMultasAnos: 1,
  },
  {
    id: 'v-3',
    placa: 'QVO-3081',
    modelo: 'Ranger XLS 2.2 4x4 Diesel',
    marca: 'Ford',
    ano: 2023,
    cor: 'Cinza Moscou',
    categoria: 'UTILITARIO',
    chassi: '8AFAR23K8P1083921',
    renavam: '01392817456',
    odometroAtual: 79100,
    horimetro: 2840,
    status: 'OPERANDO',
    combustivel: 'DIESEL_S10',
    localizacao: {
      lat: -6.0684,
      lng: -49.9048,
      cidade: 'Parauapebas',
      uf: 'PA',
      endereco: 'PA-275, Cidade Nova, Parauapebas - PA',
    },
    ignicao: false,
    velocidade: 0,
    bloqueado: false,
    nivelTanque: 55,
    bateriaVolts: 12.7,
    ultimaComunicacao: new Date().toISOString(),
    valorVenalFipe: 189000,
    tempoSemMultasAnos: 2,
  },
  {
    id: 'v-4',
    placa: 'RXF-8820',
    modelo: 'Fiat Strada Freedom 1.3 CS Plus',
    marca: 'Fiat',
    ano: 2023,
    cor: 'Branco Banchisa',
    categoria: 'UTILITARIO',
    chassi: '9BD281M01P8291047',
    renavam: '01482910384',
    odometroAtual: 34500,
    horimetro: 1100,
    status: 'OPERANDO',
    combustivel: 'FLEX',
    localizacao: {
      lat: -2.4431,
      lng: -54.7083,
      cidade: 'Santarém',
      uf: 'PA',
      endereco: 'Av. Mendonça Furtado, Centro, Santarém - PA',
    },
    ignicao: true,
    velocidade: 38,
    bloqueado: false,
    nivelTanque: 82,
    bateriaVolts: 13.9,
    ultimaComunicacao: new Date().toISOString(),
    valorVenalFipe: 86500,
    tempoSemMultasAnos: 1,
  },
];

// Realistic Supplier Preset matching fleet maintenance locations in Pará
export const DEMO_PRESET_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-belem-doca',
    razaoSocial: 'Auto Centro Belém Comércio de Peças e Serviços Ltda',
    fantasia: 'Auto Centro Belém Doca',
    cpfCnpj: '04.912.834/0001-24',
    tipoDocumento: 'CNPJ',
    categoria: 'oficina',
    contato: 'Raimundo Nonato',
    whatsapp: '(91) 98122-3344',
    email: 'contato@autocentrobelem.com.br',
    endereco: 'Av. Visconde de Souza Franco, 1250, Reduto',
    cidade: 'Belém',
    uf: 'PA',
    observacoes: 'Oficina credenciada para manutenção preventiva, suspensão e troca rápida de óleo',
    ativo: true,
    createdAt: '2026-01-10T10:00:00.000Z',
  },
  {
    id: 'sup-carajas-pneus',
    razaoSocial: 'Carajás Pneus e Alinhamento Automotivo Eireli',
    fantasia: 'Carajás Pneus Marabá',
    cpfCnpj: '12.345.678/0001-95',
    tipoDocumento: 'CNPJ',
    categoria: 'pneus',
    contato: 'Marivaldo Souza',
    whatsapp: '(94) 99188-7766',
    email: 'vendas@carajaspneus.com.br',
    endereco: 'Rodovia BR-230 Transamazônica, Km 4,5, Nova Marabá',
    cidade: 'Marabá',
    uf: 'PA',
    observacoes: 'Fornecedor homologado para pneus aro 16 a 18 e alinhamento 3D de caminhonetes',
    ativo: true,
    createdAt: '2026-01-12T11:30:00.000Z',
  },
  {
    id: 'sup-vale-diesel',
    razaoSocial: 'Vale Diesel Motores e Bombas Injetoras Ltda',
    fantasia: 'Vale Diesel Parauapebas',
    cpfCnpj: '24.195.839/0001-90',
    tipoDocumento: 'CNPJ',
    categoria: 'oficina',
    contato: 'Eng. Marcelo Albuquerque',
    whatsapp: '(94) 98133-2211',
    email: 'oficina@valedieselpa.com.br',
    endereco: 'Rodovia PA-275, s/n, Lote 12, Cidade Nova',
    cidade: 'Parauapebas',
    uf: 'PA',
    observacoes: 'Especialista em motores diesel, injeção eletrônica Common Rail e freios pesados',
    ativo: true,
    createdAt: '2026-01-15T14:00:00.000Z',
  },
  {
    id: 'sup-tapajos-pecas',
    razaoSocial: 'Tapajós Distribuidora de Auto Peças e Filtros S/A',
    fantasia: 'Tapajós Auto Peças Santarém',
    cpfCnpj: '31.782.109/0001-51',
    tipoDocumento: 'CNPJ',
    categoria: 'pecas',
    contato: 'Cláudia Santoro',
    whatsapp: '(93) 99144-5566',
    email: 'comercial@tapajospecas.com.br',
    endereco: 'Av. Mendonça Furtado, 890, Centro',
    cidade: 'Santarém',
    uf: 'PA',
    observacoes: 'Fornecedor de peças genuínas GM/Toyota/Ford/Fiat, filtros e componentes de suspensão',
    ativo: true,
    createdAt: '2026-01-20T09:00:00.000Z',
  },
  {
    id: 'sup-eletro-castanhal',
    razaoSocial: 'Auto Elétrica e Baterias Castanhal Eireli',
    fantasia: 'Eletro Auto Castanhal',
    cpfCnpj: '19.348.721/0001-15',
    tipoDocumento: 'CNPJ',
    categoria: 'eletrica',
    contato: 'Fabiano Costa',
    whatsapp: '(91) 98255-6677',
    email: 'eletrocastanhal@gmail.com',
    endereco: 'Av. Barão do Rio Branco, 450, Centro',
    cidade: 'Castanhal',
    uf: 'PA',
    observacoes: 'Manutenção de alternador, motor de partida, chicote elétrico e baterias Heliar/Moura',
    ativo: true,
    createdAt: '2026-02-01T15:20:00.000Z',
  },
  {
    id: 'sup-lanterneiro-ananindeua',
    razaoSocial: 'Centro de Reparação Automotiva Ananindeua Ltda',
    fantasia: 'Lanterneiro & Pintura Ananindeua',
    cpfCnpj: '28.910.456/0001-08',
    tipoDocumento: 'CNPJ',
    categoria: 'funilaria',
    contato: 'Josenildo Brito',
    whatsapp: '(91) 98311-8899',
    email: 'contato@lanterneiroananindeua.com.br',
    endereco: 'BR-316, Km 7, Coqueiro',
    cidade: 'Ananindeua',
    uf: 'PA',
    observacoes: 'Recuperação estrutural de lataria, alinhamento de monobloco, repintura em estufa e polimento',
    ativo: true,
    createdAt: '2026-02-05T16:00:00.000Z',
  },
];

// Helper to calculate realistic ISO timestamps relative to now
const nowMs = Date.now();
const hoursAgo = (h: number) => new Date(nowMs - h * 60 * 60 * 1000).toISOString();
const daysAgo = (d: number) => new Date(nowMs - d * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const generateDemoInvoiceSvg = (
  numeroNF: string,
  razaoSocial: string,
  cnpj: string,
  cidadeUf: string,
  placa: string,
  modelo: string,
  dataEmissao: string,
  itens: { desc: string; qtd: number; unit: number; total: number }[],
  totalPecas: number,
  totalMaoDeObra: number,
  totalGeral: number,
  obs: string
) => {
  const itemsXml = itens
    .map(
      (it, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
      <td style="padding: 6px 8px; text-align: center; color: #64748b;">${idx + 1}</td>
      <td style="padding: 6px 8px; font-weight: 600; color: #1e293b;">${it.desc}</td>
      <td style="padding: 6px 8px; text-align: center;">${it.qtd}</td>
      <td style="padding: 6px 8px; text-align: right;">R$ ${it.unit.toFixed(2)}</td>
      <td style="padding: 6px 8px; text-align: right; font-weight: 700;">R$ ${it.total.toFixed(2)}</td>
    </tr>`
    )
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="920" viewBox="0 0 700 920">
  <defs>
    <style>
      .title { font-family: system-ui, sans-serif; font-weight: 800; fill: #0f172a; }
      .lbl { font-family: system-ui, sans-serif; font-size: 10px; font-weight: 700; fill: #64748b; text-transform: uppercase; }
      .val { font-family: system-ui, sans-serif; font-size: 12px; font-weight: 600; fill: #0f172a; }
      .box { fill: #ffffff; stroke: #cbd5e1; stroke-width: 1.5; rx: 6px; }
    </style>
  </defs>
  <rect width="700" height="920" fill="#f8fafc" />
  
  <rect x="20" y="20" width="660" height="880" rx="8" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5" />

  <rect x="20" y="20" width="660" height="65" rx="8" fill="#0F2744" />
  <text x="40" y="50" font-family="system-ui, sans-serif" font-size="16" font-weight="900" fill="#ffffff" letter-spacing="1">FLEET TELECOM - COMPROVANTE FISCAL AUDITADO</text>
  <text x="40" y="70" font-family="system-ui, sans-serif" font-size="11" fill="#93c5fd">DOCUMENTO AUXILIAR DE NOTA FISCAL ELETRÔNICA (DANFE / NFS-e)</text>
  <rect x="520" y="32" width="140" height="40" rx="4" fill="#1e3a8a" stroke="#3b82f6" />
  <text x="530" y="48" font-family="monospace" font-size="10" fill="#93c5fd">NF-e Nº</text>
  <text x="530" y="65" font-family="monospace" font-size="14" font-weight="bold" fill="#ffffff">${numeroNF}</text>

  <rect x="35" y="100" width="630" height="85" class="box" />
  <text x="50" y="120" class="lbl">EMISSOR / PRESTADOR DE SERVIÇOS CREDENCIADO</text>
  <text x="50" y="140" class="title" font-size="15">${razaoSocial}</text>
  <text x="50" y="160" class="val">CNPJ: ${cnpj} | Localidade: ${cidadeUf}</text>
  <text x="50" y="175" class="val" fill="#0284c7">Status SEFAZ: AUTORIZADA - PROTOCOLO: 315260089182391</text>

  <rect x="35" y="195" width="630" height="85" class="box" />
  <text x="50" y="215" class="lbl">TOMADOR DO SERVIÇO / VEÍCULO DA FROTA ATENDIDO</text>
  <text x="50" y="235" class="val">Razão Social: FLEET TELECOMUNICAÇÕES DO PARÁ LTDA</text>
  <text x="50" y="255" class="val">CNPJ: 08.452.190/0001-38 | Inscrição Estadual: 15.489.201-9</text>
  <text x="50" y="272" class="title" font-size="13" fill="#0284c7">Veículo: ${modelo} | PLACA: ${placa} | Data Emissão: ${dataEmissao}</text>

  <rect x="35" y="290" width="630" height="340" class="box" />
  <rect x="35" y="290" width="630" height="30" fill="#f1f5f9" rx="6" />
  <text x="50" y="310" class="lbl">ITENS DA NOTA FISCAL (PEÇAS GENUÍNAS E MÃO DE OBRA MECÂNICA)</text>

  <foreignObject x="45" y="325" width="610" height="295">
    <div xmlns="http://www.w3.org/1999/xhtml">
      <table style="width: 100%; border-collapse: collapse; font-family: system-ui, sans-serif;">
        <thead>
          <tr style="background: #e2e8f0; font-size: 10px; font-weight: 800; color: #334155; text-transform: uppercase;">
            <th style="padding: 6px 8px; text-align: center; width: 30px;">#</th>
            <th style="padding: 6px 8px; text-align: left;">Descrição do Item / Serviço</th>
            <th style="padding: 6px 8px; text-align: center; width: 45px;">Qtd</th>
            <th style="padding: 6px 8px; text-align: right; width: 90px;">Valor Unit.</th>
            <th style="padding: 6px 8px; text-align: right; width: 90px;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsXml}
        </tbody>
      </table>
    </div>
  </foreignObject>

  <rect x="35" y="640" width="630" height="90" class="box" fill="#f8fafc" />
  <text x="50" y="665" class="lbl">RESUMO FINANCEIRO</text>
  <text x="50" y="690" class="val">Total Peças: R$ ${totalPecas.toFixed(2)}</text>
  <text x="50" y="715" class="val">Total Mão de Obra: R$ ${totalMaoDeObra.toFixed(2)}</text>
  
  <rect x="420" y="650" width="230" height="70" rx="6" fill="#0F2744" />
  <text x="440" y="675" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#93c5fd">VALOR TOTAL DA NOTA</text>
  <text x="440" y="705" font-family="monospace" font-size="22" font-weight="900" fill="#ffffff">R$ ${totalGeral.toFixed(2)}</text>

  <rect x="35" y="740" width="630" height="135" class="box" />
  <text x="50" y="760" class="lbl">OBSERVAÇÕES E DADOS COMPLEMENTARES</text>
  <text x="50" y="780" class="val" font-size="11" fill="#475569">${obs}</text>
  <text x="50" y="800" font-family="monospace" font-size="9" fill="#64748b">CHAVE DE ACESSO NF-E: 1526 0204 9128 3400 0124 5500 1000 0048 1210 9382 7164</text>
  <text x="50" y="820" font-family="sans-serif" font-size="10" font-weight="bold" fill="#059669">✓ ASSINATURA DIGITAL VÁLIDA ICP-BRASIL - SEFAZ/PA</text>
  <text x="50" y="855" font-family="monospace" font-size="10" fill="#94a3b8">Documento digital armazenado no Fleet Frota para fins de controle e auditoria.</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export const DEMO_PRESET_SERVICES: ServiceLog[] = [
  {
    // RECENT: Created 2.5 hours ago by Marcos Pereira (Operador) -> WITHIN 24h, Marcos can edit!
    id: 'srv-recent-2h',
    veiculoId: 'v-1',
    placa: 'QEN-4521',
    modelo: 'Onix Plus Premier 1.0 Turbo',
    data: new Date(nowMs).toISOString().split('T')[0],
    tipo: 'OLEO',
    fornecedor: 'Auto Centro Belém Doca',
    fornecedorId: 'sup-belem-doca',
    fornecedorNome: 'Auto Centro Belém Doca',
    odometro: 48900,
    pecas: [
      { descricao: 'Óleo Sintético 0W20 GM Dexos1 (4L)', quantidade: 4, valorUnitario: 65, total: 260 },
      { descricao: 'Filtro de Óleo GM Original', quantidade: 1, valorUnitario: 45, total: 45 },
      { descricao: 'Filtro de Combustível GM', quantidade: 1, valorUnitario: 40, total: 40 },
    ],
    servicos: [
      { descricao: 'Mão de obra troca rápida de óleo e fluidos', valor: 80 },
    ],
    valorPecas: 345,
    valorMaoDeObra: 80,
    valorTotal: 425,
    proximaRevisaoKm: 58900,
    proximaRevisaoData: '2026-11-20',
    itensProximaRevisao: ['Troca de Óleo', 'Filtro de Cabine', 'Velas de Ignição'],
    observacoes: 'Lançamento recente de manutenção preventiva. Nível de fluido conferido e dentro dos parâmetros.',
    iaGerado: true,
    provedorIA: 'Gemini',
    recomendacaoIA: 'Troca de óleo executada no prazo. Verificar pastilhas na marca de 55.000 km.',
    status: 'CONCLUIDO',
    anexoDocumento: {
      nome: 'NF-e 004812_AutoCentroDoca.png',
      tipo: 'IMAGEM',
      urlBase64: generateDemoInvoiceSvg(
        '004812',
        'Auto Centro Belém Comércio de Peças e Serviços Ltda',
        '04.912.834/0001-24',
        'Belém - PA',
        'QEN-4521',
        'Onix Plus Premier 1.0 Turbo',
        new Date(nowMs).toISOString().split('T')[0].split('-').reverse().join('/'),
        [
          { desc: 'Óleo Sintético 0W20 GM Dexos1 (4L)', qtd: 4, unit: 65, total: 260 },
          { desc: 'Filtro de Óleo GM Original', qtd: 1, unit: 45, total: 45 },
          { desc: 'Filtro de Combustível GM', qtd: 1, unit: 40, total: 40 },
          { desc: 'Mão de Obra Troca Rápida de Fluidos', qtd: 1, unit: 80, total: 80 },
        ],
        345,
        80,
        425,
        'Troca de óleo executada com peças originais GM. Garantia de 90 dias balcão.'
      ),
    },
    createdAt: hoursAgo(2.5), // 2.5 hours ago: WITHIN 24 HOURS
    criadoPorId: 'usr-op-1',
    criadoPorNome: 'Marcos Pereira',
    criadoPorCargo: 'OPERADOR',
  },
  {
    // OLDER: Created 3 days (72h) ago by Marcos Pereira (Operador) -> EXCEEDED 24h! Marcos blocked, only Admin Carlos can edit!
    id: 'srv-old-3d',
    veiculoId: 'v-2',
    placa: 'QDA-1092',
    modelo: 'Hilux CD SRV 4x4 2.8 Diesel Aut.',
    data: daysAgo(3),
    tipo: 'PNEU',
    fornecedor: 'Carajás Pneus Marabá',
    fornecedorId: 'sup-carajas-pneus',
    fornecedorNome: 'Carajás Pneus Marabá',
    odometro: 62400,
    pecas: [
      { descricao: 'Pneus Bridgestone Dueler A/T Revo 265/65R17', quantidade: 4, valorUnitario: 1250, total: 5000 },
      { descricao: 'Bicos Válvula Reforçados', quantidade: 4, valorUnitario: 25, total: 100 },
    ],
    servicos: [
      { descricao: 'Alinhamento Computadorizado 3D de Caminhonete', valor: 180 },
      { descricao: 'Balanceamento Dinâmico de 4 Rodas', valor: 120 },
    ],
    valorPecas: 5100,
    valorMaoDeObra: 300,
    valorTotal: 5400,
    proximaRevisaoKm: 72400,
    proximaRevisaoData: '2027-01-15',
    itensProximaRevisao: ['Rodízio de Pneus 10.000km', 'Checagem de Buchas'],
    observacoes: 'Substituição do jogo completo de pneus antes do período de chuvas no Pará.',
    iaGerado: true,
    provedorIA: 'OpenAI',
    recomendacaoIA: 'Pneus substituídos com alinhamento 3D. Geometria aferida conforme especificação Toyota.',
    status: 'CONCLUIDO',
    anexoDocumento: {
      nome: 'DANFE_CarajasPneus_0918.png',
      tipo: 'IMAGEM',
      urlBase64: generateDemoInvoiceSvg(
        '000918',
        'Carajás Pneus e Alinhamento Automotivo Eireli',
        '12.345.678/0001-95',
        'Marabá - PA',
        'QDA-1092',
        'Hilux CD SRV 4x4 2.8 Diesel Aut.',
        daysAgo(3).split('-').reverse().join('/'),
        [
          { desc: 'Pneus Bridgestone Dueler A/T Revo 265/65R17', qtd: 4, unit: 1250, total: 5000 },
          { desc: 'Bicos Válvula Reforçados Alta Pressão', qtd: 4, unit: 25, total: 100 },
          { desc: 'Alinhamento Computadorizado 3D Caminhonete', qtd: 1, unit: 180, total: 180 },
          { desc: 'Balanceamento Dinâmico de 4 Rodas', qtd: 1, unit: 120, total: 120 },
        ],
        5100,
        300,
        5400,
        'Jogo completo de pneus montado com alinhamento 3D. Geometria 100% aferida.'
      ),
    },
    createdAt: hoursAgo(72), // 72 hours ago: EXPIRED (>24H)
    criadoPorId: 'usr-op-1',
    criadoPorNome: 'Marcos Pereira',
    criadoPorCargo: 'OPERADOR',
  },
  {
    // Created by Administrator Carlos Henrique
    id: 'srv-admin-freios',
    veiculoId: 'v-3',
    placa: 'QVO-3081',
    modelo: 'Ranger XLS 2.2 4x4 Diesel',
    data: daysAgo(12),
    tipo: 'MECANICA',
    fornecedor: 'Vale Diesel Peças e Serviços Parauapebas',
    fornecedorId: 'sup-vale-diesel',
    fornecedorNome: 'Vale Diesel Parauapebas',
    odometro: 79100,
    pecas: [
      { descricao: 'Jogo Pastilhas Dianteiras Cerâmica Bosch', quantidade: 1, valorUnitario: 380, total: 380 },
      { descricao: 'Fluido de Freio DOT 4 ATE (1L)', quantidade: 2, valorUnitario: 55, total: 110 },
      { descricao: 'Discos Dianteiros Ventilados Fremax', quantidade: 2, valorUnitario: 290, total: 580 },
    ],
    servicos: [
      { descricao: 'Substituição de pastilhas, discos e sangria do sistema', valor: 280 },
    ],
    valorPecas: 1070,
    valorMaoDeObra: 280,
    valorTotal: 1350,
    proximaRevisaoKm: 89100,
    proximaRevisaoData: '2026-12-10',
    itensProximaRevisao: ['Verificação Freios Traseiros', 'Lonas e Tambores'],
    observacoes: 'Revisão corretiva do conjunto de freios dianteiros com troca de discos e sangria total.',
    iaGerado: true,
    provedorIA: 'Gemini',
    recomendacaoIA: 'Sistema de freios reabilitado. Desgaste anterior indicava uso severo em terra.',
    status: 'CONCLUIDO',
    createdAt: hoursAgo(288), // 12 days ago
    criadoPorId: 'usr-admin-1',
    criadoPorNome: 'Carlos Henrique',
    criadoPorCargo: 'GESTOR',
  },
  {
    // Created by Ana Beatriz
    id: 'srv-strada-eletrica',
    veiculoId: 'v-4',
    placa: 'RXF-8820',
    modelo: 'Fiat Strada Freedom 1.3 CS Plus',
    data: daysAgo(25),
    tipo: 'ELETRICA',
    fornecedor: 'Tapajós Auto Peças Santarém',
    fornecedorId: 'sup-tapajos-pecas',
    fornecedorNome: 'Tapajós Auto Peças Santarém',
    odometro: 34500,
    pecas: [
      { descricao: 'Bateria Moura 60Ah EFB Start-Stop', quantidade: 1, valorUnitario: 580, total: 580 },
      { descricao: 'Lâmpadas H7 Osram Night Breaker', quantidade: 2, valorUnitario: 65, total: 130 },
    ],
    servicos: [
      { descricao: 'Diagnóstico computadorizado de alternador e carga', valor: 90 },
      { descricao: 'Instalação e configuração de bateria', valor: 50 },
    ],
    valorPecas: 710,
    valorMaoDeObra: 140,
    valorTotal: 850,
    proximaRevisaoKm: 44500,
    proximaRevisaoData: '2027-02-15',
    itensProximaRevisao: ['Checagem de Alternador', 'Correia de Acessórios'],
    observacoes: 'Substituição de bateria com perda de carga e lâmpadas de farol baixo.',
    iaGerado: false,
    status: 'CONCLUIDO',
    createdAt: hoursAgo(600), // 25 days ago
    criadoPorId: 'usr-op-2',
    criadoPorNome: 'Ana Beatriz',
    criadoPorCargo: 'OPERADOR',
  },
  {
    // Revisão Programada
    id: 'srv-onix-rev-programada',
    veiculoId: 'v-1',
    placa: 'QEN-4521',
    modelo: 'Onix Plus Premier 1.0 Turbo',
    data: daysAgo(60),
    tipo: 'REVISAO_PROGRAMADA',
    fornecedor: 'Concessionária GM Belém Norte',
    odometro: 40000,
    pecas: [
      { descricao: 'Kit Revisão 40k GM (Óleo, Filtros, Velas, Correia Alternador)', quantidade: 1, valorUnitario: 920, total: 920 },
      { descricao: 'Palhetas Limpador Silicone', quantidade: 1, valorUnitario: 110, total: 110 },
    ],
    servicos: [
      { descricao: 'Mão de obra pacote revisão oficial de fábrica', valor: 450 },
    ],
    valorPecas: 1030,
    valorMaoDeObra: 450,
    valorTotal: 1480,
    proximaRevisaoKm: 50000,
    proximaRevisaoData: '2026-11-01',
    itensProximaRevisao: ['Óleo e Filtro de Óleo'],
    observacoes: 'Revisão programada de 40.000 km carimbada no manual com garantia mantida.',
    iaGerado: true,
    provedorIA: 'OpenAI',
    status: 'CONCLUIDO',
    createdAt: hoursAgo(1440),
    criadoPorId: 'usr-admin-1',
    criadoPorNome: 'Carlos Henrique',
    criadoPorCargo: 'GESTOR',
  },
  {
    // Funilaria Hilux
    id: 'srv-hilux-funilaria',
    veiculoId: 'v-2',
    placa: 'QDA-1092',
    modelo: 'Hilux CD SRV 4x4 2.8 Diesel Aut.',
    data: daysAgo(75),
    tipo: 'FUNILARIA',
    fornecedor: 'Oficina Central Reparos Automotivos Marabá',
    odometro: 55200,
    pecas: [
      { descricao: 'Para-choque Dianteiro Original Toyota', quantidade: 1, valorUnitario: 1450, total: 1450 },
      { descricao: 'Grade Frontal Cromada Hilux SRV', quantidade: 1, valorUnitario: 680, total: 680 },
    ],
    servicos: [
      { descricao: 'Pintura em estufa e alinhamento de lataria', valor: 850 },
      { descricao: 'Montagem e desmontagem frontal', valor: 250 },
    ],
    valorPecas: 2130,
    valorMaoDeObra: 1100,
    valorTotal: 3230,
    proximaRevisaoKm: 65000,
    proximaRevisaoData: '2027-02-01',
    observacoes: 'Reparo de pequena colisão frontal ocorrida em pátio de manobras.',
    iaGerado: false,
    status: 'CONCLUIDO',
    createdAt: hoursAgo(1800),
    criadoPorId: 'usr-admin-1',
    criadoPorNome: 'Carlos Henrique',
    criadoPorCargo: 'GESTOR',
  },
];

// Fuso horário operacional oficial: America/Belem (UTC-3)
export function isCreatedTodayInBelem(isoDateStr?: string): boolean {
  if (!isoDateStr) return true;
  const d = new Date(isoDateStr);
  if (isNaN(d.getTime())) return true;

  const belemFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Belem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const createdBelem = belemFormatter.format(d);
  const nowBelem = belemFormatter.format(new Date());
  return createdBelem === nowBelem;
}

export function canUserEditOrDeleteRevision(rev: RevisionPlan, user: SystemUser): {
  allowed: boolean;
  requiresJustification: boolean;
  reason?: string;
} {
  const isAuthor = rev.criadoPorId === user.id || rev.criadoPorNome === user.nome;
  const isToday = isCreatedTodayInBelem(rev.createdAt);
  const isAdmin = user.cargo === 'GESTOR';

  if (isAuthor && isToday) {
    return { allowed: true, requiresJustification: false };
  }

  if (isAdmin) {
    return { allowed: true, requiresJustification: !isToday };
  }

  return {
    allowed: false,
    requiresJustification: false,
    reason: isAuthor
      ? 'O autor só pode alterar ou excluir no mesmo dia do lançamento (fuso America/Belem). Registros de dias anteriores só podem ser alterados por um Administrador.'
      : 'Apenas o autor (no mesmo dia de criação) ou um Administrador (Gestor) podem alterar ou excluir este plano de revisão.',
  };
}

export function calculateRevisionStatus(
  proximoKm: number,
  kmAtual: number,
  proximaData: string
): { kmRestantes: number; status: 'EM_DIA' | 'PROXIMO' | 'VENCIDO'; diasRestantes: number } {
  const kmRestantes = proximoKm - kmAtual;
  let diasRestantes = 999;
  if (proximaData) {
    const targetTime = new Date(proximaData + 'T23:59:59').getTime();
    if (!isNaN(targetTime)) {
      diasRestantes = Math.ceil((targetTime - Date.now()) / (1000 * 60 * 60 * 24));
    }
  }

  let status: 'EM_DIA' | 'PROXIMO' | 'VENCIDO' = 'EM_DIA';
  // VENCIDO: se ultrapassou a km OU se a data já venceu (diasRestantes <= 0)
  if (kmRestantes <= 0 || diasRestantes <= 0) {
    status = 'VENCIDO';
  } else if (kmRestantes <= 1500 || diasRestantes <= 30) {
    // PROXIMO: faltam 1.500 km ou menos de 30 dias
    status = 'PROXIMO';
  }

  return { kmRestantes, status, diasRestantes };
}

export function mapServiceTypeToRevisionItem(
  tipo: string,
  descricao = '',
  pecas: Array<{ descricao: string }> = []
): {
  item: 'OLEO_FILTRO' | 'PASTILHAS_FREIO' | 'CORREIA_DENTADA' | 'PNEUS' | 'FILTRO_AR_COMBUSTIVEL' | 'SISTEMA_ARREFECIMENTO' | 'SUSPENSAO' | 'REVISAO_GERAL';
  titulo: string;
  intervaloKm: number;
  intervaloMeses: number;
} {
  const text = (descricao + ' ' + pecas.map(p => p.descricao).join(' ')).toLowerCase();

  if (tipo === 'OLEO' || text.includes('óleo') || text.includes('oleo')) {
    return {
      item: 'OLEO_FILTRO',
      titulo: 'Troca de Óleo & Filtro de Óleo',
      intervaloKm: 10000,
      intervaloMeses: 6,
    };
  }

  if (tipo === 'PNEU' || text.includes('pneu') || text.includes('alinhamento') || text.includes('balanceamento')) {
    return {
      item: 'PNEUS',
      titulo: 'Rodízio e Substituição de Pneus',
      intervaloKm: 20000,
      intervaloMeses: 12,
    };
  }

  if (text.includes('freio') || text.includes('pastilha') || text.includes('disco') || text.includes('fluido de freio')) {
    return {
      item: 'PASTILHAS_FREIO',
      titulo: 'Revisão de Pastilhas e Freios',
      intervaloKm: 20000,
      intervaloMeses: 12,
    };
  }

  if (text.includes('correia') || text.includes('tensor') || text.includes('dentada')) {
    return {
      item: 'CORREIA_DENTADA',
      titulo: 'Troca de Correia Dentada e Tensores',
      intervaloKm: 50000,
      intervaloMeses: 36,
    };
  }

  if (text.includes('arrefec') || text.includes('radiador') || text.includes('aditivo') || text.includes('bomba d')) {
    return {
      item: 'SISTEMA_ARREFECIMENTO',
      titulo: 'Sistema de Arrefecimento e Radiador',
      intervaloKm: 30000,
      intervaloMeses: 18,
    };
  }

  if (text.includes('suspens') || text.includes('amortecedor') || text.includes('pivô') || text.includes('bucha') || text.includes('bieleta')) {
    return {
      item: 'SUSPENSAO',
      titulo: 'Revisão de Suspensão e Amortecedores',
      intervaloKm: 40000,
      intervaloMeses: 24,
    };
  }

  if (text.includes('filtro') && (text.includes('ar') || text.includes('combustível') || text.includes('combustivel'))) {
    return {
      item: 'FILTRO_AR_COMBUSTIVEL',
      titulo: 'Filtros de Ar e Combustível',
      intervaloKm: 15000,
      intervaloMeses: 12,
    };
  }

  return {
    item: 'REVISAO_GERAL',
    titulo: 'Revisão Preventiva Geral',
    intervaloKm: 20000,
    intervaloMeses: 12,
  };
}

// Realistic Revisions Preset for demo and testing
export const DEMO_PRESET_REVISIONS: RevisionPlan[] = [
  {
    id: 'rev-demo-1',
    veiculoId: 'v-1',
    placa: 'QEN-4521',
    titulo: 'Troca de Óleo & Filtros',
    item: 'OLEO_FILTRO',
    intervaloKm: 10000,
    intervaloMeses: 6,
    ultimoKmRealizado: 40000,
    ultimaDataRealizada: '2026-06-15',
    proximoKm: 50000,
    proximaData: '2026-11-20',
    kmRestantes: 1080,
    status: 'PROXIMO',
    prioridade: 'MEDIA',
    createdAt: hoursAgo(2.5), // Lançado hoje por Marcos Pereira (Operador pode editar hoje)
    criadoPorId: 'usr-op-1',
    criadoPorNome: 'Marcos Pereira',
    criadoPorCargo: 'OPERADOR',
    ativo: true,
  },
  {
    id: 'rev-demo-2',
    veiculoId: 'v-2',
    placa: 'QDA-1092',
    titulo: 'Substituição de Pneus e Geometria 3D',
    item: 'PNEUS',
    intervaloKm: 20000,
    intervaloMeses: 12,
    ultimoKmRealizado: 42000,
    ultimaDataRealizada: '2025-10-10',
    proximoKm: 62000,
    proximaData: '2026-10-15',
    kmRestantes: -450,
    status: 'VENCIDO',
    prioridade: 'CRITICA',
    createdAt: daysAgo(3), // Lançado há 3 dias (Operador bloqueado; Admin deve justificar)
    criadoPorId: 'usr-op-1',
    criadoPorNome: 'Marcos Pereira',
    criadoPorCargo: 'OPERADOR',
    ativo: true,
  },
  {
    id: 'rev-demo-3',
    veiculoId: 'v-3',
    placa: 'QVO-3081',
    titulo: 'Revisão de Pastilhas e Freios',
    item: 'PASTILHAS_FREIO',
    intervaloKm: 20000,
    intervaloMeses: 12,
    ultimoKmRealizado: 60000,
    ultimaDataRealizada: '2026-05-10',
    proximoKm: 80000,
    proximaData: '2026-11-10',
    kmRestantes: 900,
    status: 'PROXIMO',
    prioridade: 'ALTA',
    createdAt: daysAgo(12),
    criadoPorId: 'usr-admin-1',
    criadoPorNome: 'Carlos Henrique',
    criadoPorCargo: 'GESTOR',
    ativo: true,
  },
  {
    id: 'rev-demo-4',
    veiculoId: 'v-4',
    placa: 'RXF-8820',
    titulo: 'Troca de Correia Dentada e Tensores',
    item: 'CORREIA_DENTADA',
    intervaloKm: 50000,
    intervaloMeses: 36,
    ultimoKmRealizado: 0,
    ultimaDataRealizada: '2024-01-10',
    proximoKm: 50000,
    proximaData: '2027-01-10',
    kmRestantes: 15500,
    status: 'EM_DIA',
    prioridade: 'BAIXA',
    createdAt: daysAgo(25),
    criadoPorId: 'usr-op-2',
    criadoPorNome: 'Ana Beatriz',
    criadoPorCargo: 'OPERADOR',
    ativo: true,
  },
];

class StorageService {
  private get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      return JSON.parse(item) as T;
    } catch {
      return defaultValue;
    }
  }

  private set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Erro ao salvar no localStorage:', e);
    }
  }

  // Vehicles
  getVehicles(): Vehicle[] {
    const list = this.get<Vehicle[]>(STORAGE_KEYS.VEHICLES, []);
    if (list.length === 0) {
      this.set(STORAGE_KEYS.VEHICLES, DEMO_PRESET_VEHICLES);
      return DEMO_PRESET_VEHICLES;
    }
    // Normalização automática: se algum odômetro foi importado em metros (> 500.000), converte para km
    let sanitized = false;
    for (const v of list) {
      if (v.odometroAtual && v.odometroAtual > 500000) {
        v.odometroAtual = Math.round(v.odometroAtual / 1000);
        sanitized = true;
      }
      if (v.odometroEstimado && v.odometroEstimado > 500000) {
        v.odometroEstimado = Math.round(v.odometroEstimado / 1000);
        sanitized = true;
      }
      if (v.odometroRastreador && v.odometroRastreador > 500000) {
        v.odometroRastreador = Math.round(v.odometroRastreador / 1000);
        sanitized = true;
      }
    }
    if (sanitized) {
      this.set(STORAGE_KEYS.VEHICLES, list);
    }
    return list;
  }

  saveVehicles(vehicles: Vehicle[]): void {
    this.set(STORAGE_KEYS.VEHICLES, vehicles);
    this.recalculateLicensing();
  }

  addVehicle(vehicle: Vehicle): void {
    const vehicles = this.getVehicles();
    vehicles.unshift(vehicle);
    this.saveVehicles(vehicles);
  }

  updateVehicle(vehicle: Vehicle): void {
    const vehicles = this.getVehicles().map(v => (v.id === vehicle.id ? vehicle : v));
    this.saveVehicles(vehicles);
  }

  deleteVehicle(id: string): void {
    const vehicles = this.getVehicles().filter(v => v.id !== id);
    this.saveVehicles(vehicles);
    this.recalculateLicensing();
  }

  // Services
  getServices(): ServiceLog[] {
    const list = this.get<ServiceLog[]>(STORAGE_KEYS.SERVICES, []);
    if (list.length === 0) {
      this.set(STORAGE_KEYS.SERVICES, DEMO_PRESET_SERVICES);
      return DEMO_PRESET_SERVICES;
    }
    // Automatically ensure demo items have their audited invoice document attachments
    let updated = false;
    for (const s of list) {
      if (s.id === 'srv-recent-2h' && !s.anexoDocumento) {
        const demoMatch = DEMO_PRESET_SERVICES.find(d => d.id === 'srv-recent-2h');
        if (demoMatch?.anexoDocumento) {
          s.anexoDocumento = demoMatch.anexoDocumento;
          updated = true;
        }
      } else if (s.id === 'srv-old-3d' && !s.anexoDocumento) {
        const demoMatch = DEMO_PRESET_SERVICES.find(d => d.id === 'srv-old-3d');
        if (demoMatch?.anexoDocumento) {
          s.anexoDocumento = demoMatch.anexoDocumento;
          updated = true;
        }
      }
    }
    if (updated) {
      this.set(STORAGE_KEYS.SERVICES, list);
    }
    return list;
  }

  saveServices(services: ServiceLog[]): void {
    this.set(STORAGE_KEYS.SERVICES, services);
  }

  addService(service: ServiceLog): void {
    const services = this.getServices();
    services.unshift(service);
    this.saveServices(services);

    // Update vehicle estimated odometer and maintenance status
    const vehicles = this.getVehicles();
    const vIndex = vehicles.findIndex(v => v.id === service.veiculoId || v.placa === service.placa);
    if (vIndex !== -1) {
      const currentEst = vehicles[vIndex].odometroEstimado ?? vehicles[vIndex].odometroAtual ?? 0;
      if (service.odometro >= currentEst) {
        vehicles[vIndex].odometroEstimado = service.odometro;
        vehicles[vIndex].odometroAtual = service.odometro;
        vehicles[vIndex].dataUltimoOdometroEstimado = service.data || new Date().toISOString().split('T')[0];
      }
      if (vehicles[vIndex].status === 'MANUTENCAO') {
        vehicles[vIndex].status = 'OPERANDO';
      }
      this.saveVehicles(vehicles);
    }

    // Update or add revision plan automatically
    if (service.proximaRevisaoKm) {
      this.updateRevisionFromService(service);
    }
  }

  updateService(service: ServiceLog): void {
    const services = this.getServices();
    const index = services.findIndex(s => s.id === service.id);
    if (index !== -1) {
      services[index] = service;
      this.saveServices(services);

      // Recalculate vehicle odometer if updated
      const vehicles = this.getVehicles();
      const vIndex = vehicles.findIndex(v => v.id === service.veiculoId || v.placa === service.placa);
      if (vIndex !== -1) {
        if (service.odometro > (vehicles[vIndex].odometroAtual || 0)) {
          vehicles[vIndex].odometroAtual = service.odometro;
          vehicles[vIndex].odometroEstimado = service.odometro;
          this.saveVehicles(vehicles);
        }
      }

      if (service.proximaRevisaoKm) {
        this.updateRevisionFromService(service);
      }
    }
  }

  deleteService(id: string): void {
    const services = this.getServices().filter(s => s.id !== id);
    this.saveServices(services);
  }

  // Suppliers (Cadastros > Fornecedores)
  getSuppliers(): Supplier[] {
    const list = this.get<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);
    if (list.length === 0) {
      this.set(STORAGE_KEYS.SUPPLIERS, DEMO_PRESET_SUPPLIERS);
      return DEMO_PRESET_SUPPLIERS;
    }
    return list;
  }

  saveSuppliers(suppliers: Supplier[]): void {
    this.set(STORAGE_KEYS.SUPPLIERS, suppliers);
  }

  addSupplier(supplierData: Omit<Supplier, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Supplier {
    const suppliers = this.getSuppliers();

    // Check duplication by cleaned CPF/CNPJ
    const cleanDoc = (supplierData.cpfCnpj || '').replace(/\D/g, '');
    if (cleanDoc) {
      const duplicate = suppliers.find(s => s.cpfCnpj.replace(/\D/g, '') === cleanDoc);
      if (duplicate) {
        throw new Error(`Já existe um fornecedor cadastrado com o documento ${supplierData.cpfCnpj} (${duplicate.fantasia}).`);
      }
    }

    const newSupplier: Supplier = {
      id: supplierData.id || `sup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      razaoSocial: supplierData.razaoSocial.trim(),
      fantasia: supplierData.fantasia.trim(),
      cpfCnpj: supplierData.cpfCnpj.trim(),
      tipoDocumento: supplierData.tipoDocumento || (cleanDoc.length === 11 ? 'CPF' : 'CNPJ'),
      categoria: supplierData.categoria,
      contato: supplierData.contato?.trim() || '',
      whatsapp: supplierData.whatsapp?.trim() || '',
      email: supplierData.email?.trim() || '',
      endereco: supplierData.endereco?.trim() || '',
      cidade: supplierData.cidade?.trim() || 'Belém',
      uf: supplierData.uf?.trim() || 'PA',
      observacoes: supplierData.observacoes?.trim() || '',
      ativo: supplierData.ativo !== false,
      createdAt: supplierData.createdAt || new Date().toISOString(),
    };

    suppliers.unshift(newSupplier);
    this.saveSuppliers(suppliers);
    return newSupplier;
  }

  updateSupplier(supplier: Supplier): void {
    const suppliers = this.getSuppliers();
    const cleanDoc = supplier.cpfCnpj.replace(/\D/g, '');

    // Check duplication against other suppliers
    const duplicate = suppliers.find(
      s => s.id !== supplier.id && s.cpfCnpj.replace(/\D/g, '') === cleanDoc
    );
    if (duplicate) {
      throw new Error(`O CPF/CNPJ ${supplier.cpfCnpj} já está cadastrado para outro fornecedor (${duplicate.fantasia}).`);
    }

    const index = suppliers.findIndex(s => s.id === supplier.id);
    if (index !== -1) {
      suppliers[index] = {
        ...supplier,
        updatedAt: new Date().toISOString(),
      };
      this.saveSuppliers(suppliers);
    }
  }

  toggleSupplierStatus(id: string): Supplier | null {
    const suppliers = this.getSuppliers();
    const target = suppliers.find(s => s.id === id);
    if (!target) return null;

    target.ativo = !target.ativo;
    target.updatedAt = new Date().toISOString();
    this.saveSuppliers(suppliers);
    return target;
  }

  deleteSupplier(id: string): { success: boolean; message?: string } {
    const suppliers = this.getSuppliers();
    const target = suppliers.find(s => s.id === id);
    if (!target) {
      return { success: false, message: 'Fornecedor não encontrado.' };
    }

    // Regra 5: Não excluir fornecedores com histórico!
    const services = this.getServices();
    const hasHistory = services.some(s =>
      s.fornecedorId === id ||
      (target.fantasia && s.fornecedor?.toLowerCase().trim() === target.fantasia.toLowerCase().trim()) ||
      (target.razaoSocial && s.fornecedor?.toLowerCase().trim() === target.razaoSocial.toLowerCase().trim())
    );

    if (hasHistory) {
      return {
        success: false,
        message: `Não é permitido excluir o fornecedor "${target.fantasia}" pois existem ordens de serviço e manutenções registradas em seu histórico. Para manter a integridade fiscal, inative o fornecedor.`,
      };
    }

    const filtered = suppliers.filter(s => s.id !== id);
    this.saveSuppliers(filtered);
    return { success: true };
  }

  private updateRevisionFromService(service: ServiceLog): void {
    const revisions = this.get<RevisionPlan[]>(STORAGE_KEYS.REVISIONS, DEMO_PRESET_REVISIONS);
    const mapped = mapServiceTypeToRevisionItem(service.tipo, service.descricaoResumida || service.observacoes, service.pecas);
    const existingIndex = revisions.findIndex(
      r => r.placa === service.placa && r.item === mapped.item && !r.excluido
    );

    const proximaData =
      service.proximaRevisaoData ||
      new Date(Date.now() + mapped.intervaloMeses * 30 * 86400000).toISOString().split('T')[0];

    const { kmRestantes, status } = calculateRevisionStatus(
      service.proximaRevisaoKm,
      service.odometro,
      proximaData
    );

    const activeUser = this.getActiveUser();

    if (existingIndex !== -1) {
      // Atualiza estritamente o plano correspondente ao serviço executado (não classifica tudo como óleo)
      revisions[existingIndex].ultimoKmRealizado = service.odometro;
      revisions[existingIndex].ultimaDataRealizada = service.data;
      revisions[existingIndex].proximoKm = service.proximaRevisaoKm;
      revisions[existingIndex].proximaData = proximaData;
      revisions[existingIndex].kmRestantes = kmRestantes;
      revisions[existingIndex].status = status;
      revisions[existingIndex].updatedAt = new Date().toISOString();
    } else {
      revisions.unshift({
        id: 'rev-' + Date.now(),
        veiculoId: service.veiculoId,
        placa: service.placa,
        titulo: `${mapped.titulo} (${service.proximaRevisaoKm.toLocaleString()} km)`,
        item: mapped.item,
        intervaloKm: mapped.intervaloKm,
        intervaloMeses: mapped.intervaloMeses,
        ultimoKmRealizado: service.odometro,
        ultimaDataRealizada: service.data,
        proximoKm: service.proximaRevisaoKm,
        proximaData: proximaData,
        kmRestantes: kmRestantes,
        status: status,
        prioridade: status === 'VENCIDO' ? 'CRITICA' : status === 'PROXIMO' ? 'ALTA' : 'MEDIA',
        createdAt: new Date().toISOString(),
        criadoPorId: activeUser.id,
        criadoPorNome: activeUser.nome,
        criadoPorCargo: activeUser.cargo,
        ativo: true,
        excluido: false,
      });
    }
    this.saveRevisions(revisions);
  }

  // Revisions with dynamic recalculation by mileage and date
  getRevisions(): RevisionPlan[] {
    const raw = this.get<RevisionPlan[]>(STORAGE_KEYS.REVISIONS, DEMO_PRESET_REVISIONS);
    const active = raw.filter(r => !r.excluido && r.ativo !== false);
    const vehicles = this.getVehicles();

    // Recalcular automaticamente o status por quilometragem e data
    return active.map(rev => {
      const vehicle = vehicles.find(v => v.placa === rev.placa || v.id === rev.veiculoId);
      const vehicleKm = vehicle ? (vehicle.odometroEstimado ?? vehicle.odometroAtual) : rev.ultimoKmRealizado;
      const { kmRestantes, status } = calculateRevisionStatus(rev.proximoKm, vehicleKm, rev.proximaData);
      return {
        ...rev,
        kmRestantes,
        status,
      };
    });
  }

  saveRevisions(revisions: RevisionPlan[]): void {
    this.set(STORAGE_KEYS.REVISIONS, revisions);
  }

  // Exclusão Lógica de Revisão com validação de permissão e fuso America/Belem
  softDeleteRevision(id: string, user: SystemUser, justificativa?: string): void {
    const revisions = this.get<RevisionPlan[]>(STORAGE_KEYS.REVISIONS, DEMO_PRESET_REVISIONS);
    const target = revisions.find(r => r.id === id);
    if (!target) throw new Error('Plano de revisão não encontrado.');

    const perm = canUserEditOrDeleteRevision(target, user);
    if (!perm.allowed) {
      throw new Error(perm.reason || 'Sem permissão para excluir esta revisão.');
    }

    if (perm.requiresJustification && (!justificativa || justificativa.trim().length < 5)) {
      throw new Error('Administradores devem obrigatoriamente justificar a exclusão de registros de datas anteriores (mínimo 5 caracteres).');
    }

    target.ativo = false;
    target.excluido = true;
    target.excluidoEm = new Date().toISOString();
    target.excluidoPorId = user.id;
    target.excluidoPorNome = user.nome;
    target.excluidoPorCargo = user.cargo;
    target.motivoExclusao = justificativa;

    this.saveRevisions(revisions);
  }

  // Edição com Auditoria (usuário, data/hora e valores antes/depois)
  updateRevisionWithAudit(
    updatedRev: RevisionPlan,
    user: SystemUser,
    justificativa?: string
  ): RevisionPlan {
    const revisions = this.get<RevisionPlan[]>(STORAGE_KEYS.REVISIONS, DEMO_PRESET_REVISIONS);
    const index = revisions.findIndex(r => r.id === updatedRev.id);
    if (index === -1) throw new Error('Plano de revisão não encontrado.');

    const existing = revisions[index];
    const perm = canUserEditOrDeleteRevision(existing, user);
    if (!perm.allowed) {
      throw new Error(perm.reason || 'Sem permissão para alterar esta revisão.');
    }

    if (perm.requiresJustification && (!justificativa || justificativa.trim().length < 5)) {
      throw new Error('Administradores devem obrigatoriamente justificar a alteração de registros de datas anteriores (mínimo 5 caracteres).');
    }

    // Identificar campos alterados para a auditoria
    const camposAlterados: string[] = [];
    const checkKeys: (keyof RevisionPlan)[] = [
      'titulo',
      'item',
      'intervaloKm',
      'intervaloMeses',
      'ultimoKmRealizado',
      'ultimaDataRealizada',
      'proximoKm',
      'proximaData',
    ];

    const antes: Record<string, any> = {};
    const depois: Record<string, any> = {};

    for (const k of checkKeys) {
      if (existing[k] !== updatedRev[k]) {
        camposAlterados.push(String(k));
        antes[String(k)] = existing[k];
        depois[String(k)] = updatedRev[k];
      }
    }

    const auditEntry: RevisionEditAudit = {
      data: new Date().toISOString(),
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioCargo: user.cargo,
      justificativa,
      camposAlterados,
      antes,
      depois,
    };

    // Recalcular status por km e data
    const vehicles = this.getVehicles();
    const vehicle = vehicles.find(v => v.placa === updatedRev.placa || v.id === updatedRev.veiculoId);
    const vehicleKm = vehicle ? (vehicle.odometroEstimado ?? vehicle.odometroAtual) : updatedRev.ultimoKmRealizado;
    const { kmRestantes, status } = calculateRevisionStatus(updatedRev.proximoKm, vehicleKm, updatedRev.proximaData);

    const merged: RevisionPlan = {
      ...existing,
      ...updatedRev,
      kmRestantes,
      status,
      updatedAt: new Date().toISOString(),
      motivoEdicao: justificativa || existing.motivoEdicao,
      historicoEdicoes: [...(existing.historicoEdicoes || []), auditEntry],
    };

    revisions[index] = merged;
    this.saveRevisions(revisions);
    return merged;
  }

  // Licensing DETRAN-PA vinculado estritamente ao Veículo e ao Exercício (sem transferência entre anos)
  getLicensing(exercicioParam?: number): LicenciamentoPA[] {
    const settings = this.getSettings();
    const targetExercicio = exercicioParam || settings.detran.exercicio || 2026;
    const stored = this.get<LicenciamentoPA[] | null>(STORAGE_KEYS.LICENSING, null);
    if (stored !== null && stored.length > 0) {
      const forYear = stored.filter(l => l.exercicio === targetExercicio);
      if (forYear.length > 0) return forYear;
    }
    return this.recalculateLicensing(targetExercicio);
  }

  getLicenciamentos(exercicioParam?: number): LicenciamentoPA[] {
    return this.getLicensing(exercicioParam);
  }

  recalculateLicensing(exercicioParam?: number): LicenciamentoPA[] {
    const vehicles = this.getVehicles();
    const settings = this.getSettings();
    const targetExercicio = exercicioParam || settings.detran.exercicio || 2026;
    const existingList = this.get<LicenciamentoPA[] | null>(STORAGE_KEYS.LICENSING, null) || [];
    
    // Vinculação estrita placa + exercicio: não transfere quitação automaticamente entre anos
    const existingMap = new Map<string, LicenciamentoPA>(
      existingList.map(item => [`${item.placa}_${item.exercicio}`, item])
    );

    const currentYearList: LicenciamentoPA[] = vehicles.map(v => {
      const calculated = calcularLicenciamentoPA(
        v.placa,
        v.ano,
        v.categoria,
        v.valorVenalFipe,
        v.tempoSemMultasAnos,
        targetExercicio,
        settings.detran.taxaLicenciamento,
        settings.detran.calendarioOficial
      );

      // Preserva comprovante e quitação SOMENTE se for do mesmo exercício
      const prev = existingMap.get(`${v.placa}_${targetExercicio}`);
      if (prev && prev.pago) {
        return {
          ...calculated,
          pago: true,
          dataPagamento: prev.dataPagamento,
          dataBaixa: prev.dataBaixa,
          comprovanteNumero: prev.comprovanteNumero,
          observacoesBaixa: prev.observacoesBaixa,
          status: 'EM_DIA',
        };
      }
      return calculated;
    });

    // Preserva histórico completo de outros anos sem sobrescrever
    const otherYearsList = existingList.filter(item => item.exercicio !== targetExercicio);
    const combinedList = [...currentYearList, ...otherYearsList];

    this.set(STORAGE_KEYS.LICENSING, combinedList);
    return currentYearList;
  }

  updateLicensingPayment(
    placa: string,
    pago: boolean,
    comprovante?: string,
    dataPagamento?: string,
    dataBaixa?: string,
    observacoes?: string,
    exercicioParam?: number
  ): void {
    const settings = this.getSettings();
    const targetExercicio = exercicioParam || settings.detran.exercicio || 2026;
    const todayStr = new Date().toISOString().split('T')[0];

    const fullList = this.get<LicenciamentoPA[] | null>(STORAGE_KEYS.LICENSING, null) || [];
    let matched = false;

    const updated = fullList.map(item => {
      if (item.placa === placa && item.exercicio === targetExercicio) {
        matched = true;
        return {
          ...item,
          pago,
          dataPagamento: pago ? (dataPagamento || todayStr) : undefined,
          dataBaixa: pago ? (dataBaixa || todayStr) : undefined,
          comprovanteNumero: pago ? comprovante : undefined,
          observacoesBaixa: pago ? observacoes : undefined,
          status: pago ? ('EM_DIA' as const) : item.status,
        };
      }
      return item;
    });

    if (!matched) {
      const current = this.recalculateLicensing(targetExercicio);
      const after = current.map(item => {
        if (item.placa === placa && item.exercicio === targetExercicio) {
          return {
            ...item,
            pago,
            dataPagamento: pago ? (dataPagamento || todayStr) : undefined,
            dataBaixa: pago ? (dataBaixa || todayStr) : undefined,
            comprovanteNumero: pago ? comprovante : undefined,
            observacoesBaixa: pago ? observacoes : undefined,
            status: pago ? ('EM_DIA' as const) : item.status,
          };
        }
        return item;
      });
      const others = fullList.filter(i => i.exercicio !== targetExercicio);
      this.set(STORAGE_KEYS.LICENSING, [...after, ...others]);
      return;
    }

    this.set(STORAGE_KEYS.LICENSING, updated);
  }

  // Alerts
  getAlerts(): TelemetryAlert[] {
    return this.get<TelemetryAlert[]>(STORAGE_KEYS.ALERTS, INITIAL_ALERTS);
  }

  saveAlerts(alerts: TelemetryAlert[]): void {
    this.set(STORAGE_KEYS.ALERTS, alerts);
  }

  addAlert(alert: TelemetryAlert): void {
    const alerts = this.getAlerts();
    alerts.unshift(alert);
    this.saveAlerts(alerts);
  }

  markAlertResolved(id: string): void {
    const alerts = this.getAlerts().map(a => (a.id === id ? { ...a, resolvido: true } : a));
    this.saveAlerts(alerts);
  }

  markAlertSentChatwoot(id: string): void {
    const alerts = this.getAlerts().map(a =>
      a.id === id ? { ...a, enviadoChatwoot: true, dataEnvioChatwoot: new Date().toISOString() } : a
    );
    this.saveAlerts(alerts);
  }

  // Users & Permissions Management
  getUsers(): SystemUser[] {
    const list = this.get<SystemUser[]>(STORAGE_KEYS.USERS, []);
    if (list.length === 0) {
      this.set(STORAGE_KEYS.USERS, DEFAULT_SYSTEM_USERS);
      return DEFAULT_SYSTEM_USERS;
    }

    // Normaliza usuários antigos que não tinham login, senha ou permissoes granulares
    let needsUpdate = false;
    const normalized = list.map(u => {
      let changed = false;
      const copy = { ...u };
      if (!copy.login) {
        copy.login = copy.email ? copy.email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '') : `user_${copy.id.slice(-4)}`;
        changed = true;
      }
      if (!copy.senha) {
        copy.senha = '123';
        changed = true;
      }
      if (!copy.permissoes) {
        copy.permissoes = getDefaultPermissionsByRole(copy.cargo);
        changed = true;
      }
      if (changed) needsUpdate = true;
      return copy;
    });

    if (needsUpdate) {
      this.set(STORAGE_KEYS.USERS, normalized);
    }

    return normalized;
  }

  saveUsers(users: SystemUser[]): void {
    this.set(STORAGE_KEYS.USERS, users);
  }

  addUser(user: SystemUser): void {
    const users = this.getUsers();
    // Garante permissões padrão se não fornecidas
    const normalizedUser: SystemUser = {
      ...user,
      login: user.login.trim().toLowerCase(),
      senha: user.senha || '123',
      permissoes: user.permissoes || getDefaultPermissionsByRole(user.cargo),
    };
    users.unshift(normalizedUser);
    this.saveUsers(users);
  }

  updateUser(user: SystemUser): void {
    const users = this.getUsers().map(u => (u.id === user.id ? {
      ...user,
      login: user.login.trim().toLowerCase(),
      permissoes: user.permissoes || getDefaultPermissionsByRole(user.cargo),
    } : u));
    this.saveUsers(users);
  }

  deleteUser(id: string): void {
    const users = this.getUsers().filter(u => u.id !== id);
    this.saveUsers(users);
  }

  authenticate(login: string, senha: string): SystemUser | null {
    const cleanLogin = login.trim().toLowerCase();
    const cleanSenha = senha.trim();
    const users = this.getUsers();
    const found = users.find(u =>
      (u.login.toLowerCase() === cleanLogin || u.email.toLowerCase() === cleanLogin) &&
      u.status === 'ATIVO'
    );
    if (!found) return null;
    if (found.senha && found.senha !== cleanSenha) {
      return null;
    }
    return found;
  }

  getActiveUser(): SystemUser {
    const users = this.getUsers();
    const adminUser = users.find(u => u.cargo === 'GESTOR') || users[0] || DEFAULT_SYSTEM_USERS[0];
    const stored = this.get<SystemUser | null>(STORAGE_KEYS.ACTIVE_USER, null);
    if (!stored) return adminUser;
    const match = users.find(u => u.id === stored.id);
    return match || adminUser;
  }

  setActiveUser(user: SystemUser): void {
    this.set(STORAGE_KEYS.ACTIVE_USER, user);
  }

  // Settings
  getSettings(): SystemSettings {
    const s = this.get<SystemSettings>(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
    if (!s.tracking) {
      s.tracking = INITIAL_SETTINGS.tracking;
    }
    // Ensure correct official Selsyn URL
    if (!s.tracking.baseUrl || s.tracking.baseUrl.includes('rastreamento.selsyn.com.br')) {
      s.tracking.baseUrl = 'https://api.appselsyn.com.br/';
    }
    if (!s.openai) {
      s.openai = INITIAL_SETTINGS.openai;
    }
    if (!s.detran) {
      s.detran = INITIAL_SETTINGS.detran;
    }
    if (!s.supabase) {
      s.supabase = INITIAL_SETTINGS.supabase;
    }
    if (!s.detran.calendarioOficial || s.detran.calendarioOficial.length < 25) {
      s.detran.calendarioOficial = getDefaultDetranCalendar(s.detran.exercicio || 2026);
      this.set(STORAGE_KEYS.SETTINGS, s);
    }
    return s;
  }

  saveSettings(settings: SystemSettings): void {
    this.set(STORAGE_KEYS.SETTINGS, settings);
    this.recalculateLicensing();
  }

  // Chatwoot Logs
  getChatwootLogs(): ChatwootLog[] {
    return this.get<ChatwootLog[]>(STORAGE_KEYS.CHATWOOT_LOGS, []);
  }

  addChatwootLog(log: ChatwootLog): void {
    const logs = this.getChatwootLogs();
    logs.unshift(log);
    if (logs.length > 100) logs.pop();
    this.set(STORAGE_KEYS.CHATWOOT_LOGS, logs);
  }

  // Multi-Integration Unified Logs (Selsyn, Chatwoot, OpenAI)
  getIntegrationLogs(integration?: 'selsyn' | 'chatwoot' | 'openai'): IntegrationLog[] {
    const all = this.get<IntegrationLog[]>(STORAGE_KEYS.INTEGRATION_LOGS, []);
    if (!integration) return all;
    return all.filter(l => l.integration === integration);
  }

  addIntegrationLog(log: Omit<IntegrationLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): IntegrationLog {
    const fullLog: IntegrationLog = {
      id: log.id || `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: log.timestamp || new Date().toISOString(),
      integration: log.integration,
      endpoint: log.endpoint,
      method: log.method,
      status: log.status,
      statusCode: log.statusCode,
      latencyMs: log.latencyMs,
      message: log.message,
      payloadPreview: log.payloadPreview,
      details: log.details,
    };

    const logs = this.get<IntegrationLog[]>(STORAGE_KEYS.INTEGRATION_LOGS, []);
    logs.unshift(fullLog);
    if (logs.length > 200) logs.pop();
    this.set(STORAGE_KEYS.INTEGRATION_LOGS, logs);
    return fullLog;
  }

  clearIntegrationLogs(integration?: 'selsyn' | 'chatwoot' | 'openai'): void {
    if (!integration) {
      this.set(STORAGE_KEYS.INTEGRATION_LOGS, []);
      return;
    }
    const current = this.get<IntegrationLog[]>(STORAGE_KEYS.INTEGRATION_LOGS, []);
    const filtered = current.filter(l => l.integration !== integration);
    this.set(STORAGE_KEYS.INTEGRATION_LOGS, filtered);
  }

  // Clean wipe of simulated database as requested by user
  clearAllFleetData(): void {
    localStorage.removeItem(STORAGE_KEYS.VEHICLES);
    localStorage.removeItem(STORAGE_KEYS.SERVICES);
    localStorage.removeItem(STORAGE_KEYS.SUPPLIERS);
    localStorage.removeItem(STORAGE_KEYS.REVISIONS);
    localStorage.removeItem(STORAGE_KEYS.LICENSING);
    localStorage.removeItem(STORAGE_KEYS.ALERTS);
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.CHATWOOT_LOGS);
    localStorage.removeItem(STORAGE_KEYS.INTEGRATION_LOGS);
    this.set(STORAGE_KEYS.VEHICLES, []);
    this.set(STORAGE_KEYS.SERVICES, []);
    this.set(STORAGE_KEYS.SUPPLIERS, []);
    this.set(STORAGE_KEYS.REVISIONS, []);
    this.set(STORAGE_KEYS.LICENSING, []);
    this.set(STORAGE_KEYS.ALERTS, []);
    this.set(STORAGE_KEYS.USERS, []);
  }

  // Load demo preset on demand if the user wants example records
  loadDemoPreset(): void {
    this.saveVehicles(DEMO_PRESET_VEHICLES);
    this.saveServices(DEMO_PRESET_SERVICES);
    this.saveSuppliers(DEMO_PRESET_SUPPLIERS);
    this.saveRevisions(DEMO_PRESET_REVISIONS);
    this.saveUsers(DEFAULT_SYSTEM_USERS);
    this.setActiveUser(DEFAULT_SYSTEM_USERS[0]);
    this.recalculateLicensing();
  }

  resetAllToDefaults(): void {
    this.clearAllFleetData();
  }
}

export const storage = new StorageService();
