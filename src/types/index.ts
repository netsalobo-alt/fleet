export type VehicleStatus = 'OPERANDO' | 'PARADO' | 'MANUTENCAO' | 'ALERTA';
export type FuelType = 'GASOLINA' | 'ETANOL' | 'DIESEL_S10' | 'DIESEL_S500' | 'FLEX' | 'GNV' | 'ELETRICO' | 'HIBRIDO';

export interface Vehicle {
  id: string;
  placa: string;
  modelo: string;
  marca: string;
  ano: number;
  cor: string;
  categoria: 'PASSEIO' | 'UTILITARIO' | 'CAMINHAO' | 'MOTO' | 'VAN';
  chassi: string;
  renavam: string;
  odometroAtual: number; // km (espelha odometroEstimado para compatibilidade geral)
  odometroEstimado?: number; // km - Odômetro Estimado / Manual (lançado manualmente e atualizado a cada OS de manutenção)
  odometroRastreador?: number; // km - Odômetro sincronizado via telemetria GPS do Rastreador (Selsyn Keek)
  dataUltimoOdometroEstimado?: string; // Data ISO da última atualização do odômetro estimado / OS
  dataUltimoOdometroRastreador?: string; // Data ISO do último pacote telemétrico recebido do rastreador
  horimetro: number; // horas
  status: VehicleStatus;
  combustivel: FuelType;
  motoristaId?: string;
  motoristaNome?: string;
  localizacao: {
    lat: number;
    lng: number;
    cidade: string;
    uf: string;
    endereco: string;
  };
  ignicao: boolean;
  velocidade: number; // km/h
  bloqueado: boolean;
  nivelTanque: number; // %
  bateriaVolts: number;
  ultimaComunicacao: string;
  valorVenalFipe: number; // R$ para cálculo IPVA
  tempoSemMultasAnos: number; // 0, 1, 2 para cálculo de desconto SEFA-PA
  codigoFipe?: string; // Código FIPE oficial (ex: 504064-7)
  mesReferenciaFipe?: string; // Mês de referência da tabela FIPE
  dataUltimaAtualizacaoFipe?: string; // Data ISO da última atualização mensal
  fipePrices?: Array<{
    codeFipe: string;
    model: string;
    price: string;
  }>;
}

export type SupplierCategory =
  | 'oficina'
  | 'pecas'
  | 'pneus'
  | 'eletrica'
  | 'funilaria'
  | 'outros';

export interface Supplier {
  id: string; // UUID
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
  observacoes?: string;
  ativo: boolean; // Ativo ou Inativo
  createdAt: string;
  updatedAt?: string;
}

export type MaintenanceType =
  | 'OLEO'
  | 'MECANICA'
  | 'ELETRICA'
  | 'PNEU'
  | 'FUNILARIA'
  | 'REVISAO_PROGRAMADA'
  | 'VISTORIA'
  | 'OUTROS';

export interface ServiceItemPart {
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
}

export interface ServiceItemLabor {
  descricao: string;
  valor: number;
}

export interface ServiceLog {
  id: string;
  veiculoId: string;
  placa: string;
  modelo: string;
  data: string; // YYYY-MM-DD
  tipo: MaintenanceType;
  fornecedor: string; // Nome fantasia ou razão social (retrocompatível)
  fornecedorId?: string; // UUID do fornecedor cadastrado
  fornecedorNome?: string;
  odometro: number;
  pecas: ServiceItemPart[];
  servicos: ServiceItemLabor[];
  valorPecas: number;
  valorMaoDeObra: number;
  valorTotal: number;
  proximaRevisaoKm: number;
  proximaRevisaoData: string;
  itensProximaRevisao?: string[];
  observacoes: string;
  descricaoResumida?: string;
  iaGerado?: boolean;
  provedorIA?: 'OpenAI' | 'Gemini';
  recomendacaoIA?: string;
  anexoDocumento?: {
    nome: string;
    tipo: 'IMAGEM' | 'PDF';
    urlBase64?: string;
  };
  status: 'CONCLUIDO' | 'AGENDADO' | 'EM_ANDAMENTO';
  createdAt: string;
  criadoPorId?: string;
  criadoPorNome?: string;
  criadoPorCargo?: 'GESTOR' | 'OPERADOR' | 'MOTORISTA' | 'VISUALIZADOR';
  updatedAt?: string;
  editadoPorNome?: string;
  editadoPorCargo?: string;
  motivoEdicao?: string;
}

export interface RevisionEditAudit {
  data: string;
  usuarioId: string;
  usuarioNome: string;
  usuarioCargo: string;
  justificativa?: string;
  camposAlterados: string[];
  antes: Record<string, any>;
  depois: Record<string, any>;
}

export interface RevisionPlan {
  id: string;
  veiculoId: string;
  placa: string;
  titulo: string;
  item: 'OLEO_FILTRO' | 'PASTILHAS_FREIO' | 'CORREIA_DENTADA' | 'PNEUS' | 'FILTRO_AR_COMBUSTIVEL' | 'SISTEMA_ARREFECIMENTO' | 'SUSPENSAO' | 'REVISAO_GERAL';
  intervaloKm: number;
  intervaloMeses: number;
  ultimoKmRealizado: number;
  ultimaDataRealizada: string;
  proximoKm: number;
  proximaData: string;
  kmRestantes: number;
  status: 'EM_DIA' | 'PROXIMO' | 'VENCIDO';
  prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  // Auditoria, autoria e exclusão lógica
  createdAt?: string;
  criadoPorId?: string;
  criadoPorNome?: string;
  criadoPorCargo?: 'GESTOR' | 'OPERADOR' | 'MOTORISTA' | 'VISUALIZADOR';
  updatedAt?: string;
  ativo?: boolean;
  excluido?: boolean;
  excluidoEm?: string;
  excluidoPorId?: string;
  excluidoPorNome?: string;
  excluidoPorCargo?: string;
  motivoExclusao?: string;
  motivoEdicao?: string;
  historicoEdicoes?: RevisionEditAudit[];
}

export interface LicenciamentoPA {
  placa: string;
  finalDoisDigitos: string;
  finalSimples: string;
  finalPlaca?: string; // '1', '2', ..., '9', '0'
  grupoFinal?: string; // '01 - 31', '41 - 61', '71 - 91', etc.
  exercicio: number;
  mesVencimento: string;
  dataLimiteLicenciamento: string; // Data do Licenciamento (3ª Cota)
  dataCotaUnicaDesconto15: string; // IPVA Cidadão Cota Única (com desc. 15%)
  dataCotaUnicaDesconto10: string; // IPVA Cidadão Cota Única (com desc. 10%)
  dataCotaSemDesconto: string;
  cota1Parcelamento?: string; // 1ª Cota Parcelamento
  cota2Parcelamento?: string; // 2ª Cota Parcelamento
  cota3Parcelamento?: string; // 3ª Cota Parcelamento
  valorVenalFipe: number;
  aliquotaIpva: number; // Ex: 0.025 ou 0.01
  valorIpvaEstimado: number;
  descontoAplicado: number; // R$
  valorIpvaComDesconto: number;
  valorTaxaDetran: number; // Taxa de Licenciamento Anual DETRAN-PA
  valorTotalEstimado: number;
  status: 'EM_DIA' | 'VENCE_EM_BREVE' | 'VENCIDO';
  diasRestantes: number;
  pago: boolean;
  dataPagamento?: string; // Data em que o pagamento do documento foi realizado
  dataBaixa?: string; // Data em que a baixa foi registrada no sistema
  comprovanteNumero?: string;
  observacoesBaixa?: string;
}

export interface TelemetryAlert {
  id: string;
  timestamp: string;
  veiculoId: string;
  placa: string;
  tipo:
    | 'EXCESSO_VELOCIDADE'
    | 'IGNICAO'
    | 'CERCA_VIRTUAL'
    | 'BATERIA_BAIXA'
    | 'MANUTENCAO_VENCIDA'
    | 'REVISAO_PREVENTIVA'
    | 'LICENCIAMENTO_PA'
    | 'SEM_COMUNICACAO'
    | 'BOTÃO_PANICO'
    | 'DESVIO_ROTA';
  nivel: 'INFO' | 'AVISO' | 'CRITICO';
  titulo: string;
  mensagem: string;
  enviadoChatwoot: boolean;
  dataEnvioChatwoot?: string;
  chatwootStatus?: 'PENDENTE' | 'PRONTO_PARA_ENVIO' | 'ENVIADO' | 'TESTE_SIMULADO';
  resolvido: boolean;
}

export type UserRole = 'GESTOR' | 'OPERADOR' | 'MOTORISTA' | 'VISUALIZADOR';

export interface UserPermissions {
  // Onde o usuário pode navegar (módulos autorizados)
  modulosPermitidos: string[];
  // O que pode fazer e editar
  podeLancarNotas: boolean;
  podeEditarNotasProprias: boolean;
  limiteHorasEdicaoPropria?: number; // Padrão: 24h (0 = ilimitado)
  podeEditarQualquerNota: boolean; // Privilégio de Gestor / Admin
  podeExcluirNotas: boolean;
  podeGerenciarVeiculos: boolean;
  podeGerenciarFornecedores: boolean;
  podeGerenciarUsuarios: boolean;
  podeExportarRelatorios: boolean;
}

export interface SystemUser {
  id: string;
  nome: string;
  login: string; // Usuário para autenticação/login
  senha?: string; // Senha do usuário
  email: string;
  cpf: string;
  cargo: UserRole;
  status: 'ATIVO' | 'INATIVO';
  telefone: string;
  cnh?: string;
  cnhValidade?: string;
  cnhCategoria?: string;
  dataCriacao: string;
  permissoes?: UserPermissions;
}

export interface DetranCalendarEntry {
  id: string;
  finalPlaca?: string; // Digito '1', '2', ..., '9', '0'
  grupoFinal: string; // '01 - 31', '41 - 61', '71 - 91', etc.
  descricaoFinais: string;
  mesReferencia: string;
  dataLicenciamento?: string; // YYYY-MM-DD
  dataLimite: string; // YYYY-MM-DD (Data do Licenciamento)
  dataCotaUnica?: string; // YYYY-MM-DD (IPVA Cidadão Cota Única)
  data15Desc?: string; // YYYY-MM-DD (15% desconto)
  data10Desc?: string; // YYYY-MM-DD (10% desconto)
  cota1Parcelamento?: string; // YYYY-MM-DD (1ª COTA)
  cota2Parcelamento?: string; // YYYY-MM-DD (2ª COTA)
  cota3Parcelamento?: string; // YYYY-MM-DD (3ª COTA)
  finaisAceitos?: string[]; // array de finais ex: ['01', '11', '21', '31']
  observacoes?: string;
}

export interface SystemSettings {
  tracking: {
    baseUrl: string;
    xApiKey: string;
    token: string;
    operadorKey: string;
    clienteId?: number;
    autoSyncInterval: number; // seconds
    modoSimulacao: boolean;
  };
  chatwoot: {
    baseUrl: string;
    apiAccessToken: string;
    accountId: string;
    inboxId: string;
    conversationId: string;
    autoAlertsEnabled: boolean;
    notifyOnMaintenance: boolean;
    notifyOnDetran: boolean;
    notifyOnTelemetryAlert: boolean;
  };
  detran: {
    exercicio: number;
    taxaLicenciamento: number; // R$ DETRAN-PA
    aliquotaPasseio: number; // % 2.5
    aliquotaUtilitario: number; // % 1.0
    calendarioOficial?: DetranCalendarEntry[];
  };
  openai: {
    apiKey: string;
    model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo';
    preferredProvider: 'openai' | 'gemini';
  };
  supabase?: {
    url: string;
    publishableKey: string;
    storageBucket: string;
    environment: 'development' | 'production';
    autoSyncEnabled: boolean;
  };
}

export interface ChatwootLog {
  id: string;
  timestamp: string;
  alertaId?: string;
  placa: string;
  tipo: string;
  mensagem: string;
  status: 'ENVIADO' | 'SIMULADO' | 'FALHA';
  detalhe?: string;
}

export interface IntegrationLog {
  id: string;
  integration: 'selsyn' | 'chatwoot' | 'openai' | 'supabase';
  timestamp: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  status: 'SUCCESS' | 'ERROR' | 'INFO';
  statusCode?: number;
  latencyMs?: number;
  message: string;
  payloadPreview?: string;
  details?: any;
}

export interface VehicleDocument {
  id: string;
  veiculoId: string;
  manutencaoId?: string;
  tipoDocumento: 'NOTA_FISCAL' | 'FOTO_MANUTENCAO' | 'COMPROVANTE_PAGAMENTO' | 'DOCUMENTO_VEICULO' | 'ORDEM_SERVICO';
  nomeArquivo: string;
  tamanhoBytes: number;
  mimeType: string;
  bucketName: string;
  storagePath: string;
  urlPublica?: string;
  metadata?: Record<string, any>;
  criadoPor?: string;
  createdAt: string;
}

export interface SupabaseHealthCheck {
  isConfigured: boolean;
  url: string;
  hasPublishableKey: boolean;
  connectionOk: boolean;
  latencyMs: number;
  statusCode?: number;
  message: string;
  rlsEnforced: boolean;
  anonymousBlocked: boolean;
  tablesStatus: {
    veiculos: boolean;
    fornecedores: boolean;
    manutencoes: boolean;
    pecas_manutencao: boolean;
    servicos_executados: boolean;
    planos_revisao: boolean;
    licenciamento_ipva: boolean;
    usuarios_motoristas: boolean;
    alertas_telemetria: boolean;
    historico_chatwoot: boolean;
    logs_integracao: boolean;
    documentos_anexos: boolean;
  };
  storageStatus: {
    bucketName: string;
    exists: boolean;
    isPrivate: boolean;
  };
}
