export const SUPABASE_INITIAL_SCHEMA_SQL = `-- ==============================================================================
-- FLEET TELECOM - GESTÃO DE FROTA PA
-- Migration: 20261031_001_initial_schema.sql
-- Descrição: Estrutura profissional de banco de dados relacional no Supabase PostgreSQL.
-- Tabelas: Veículos, Manutenções, Peças, Serviços, Planos de Revisão, Licenciamento/IPVA,
--          Usuários/Motoristas, Alertas, Logs Chatwoot, Logs de Integração, Documentos.
-- Segurança: Row Level Security (RLS) habilitado em 100% das tabelas.
--            Acesso anônimo terminantemente bloqueado.
-- ==============================================================================

-- 1. EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. FUNÇÃO AUXILIAR DE ATUALIZAÇÃO AUTOMÁTICA DE TIMESTAMP (updated_at)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. FUNÇÃO AUXILIAR DE NORMALIZAÇÃO DE PLACAS AUTOMOTIVAS
-- Remove hífens, espaços e padroniza em caixa alta (ex: 'QEN-4521' -> 'QEN4521')
CREATE OR REPLACE FUNCTION normalizar_placa(p_placa TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN UPPER(REGEXP_REPLACE(COALESCE(p_placa, ''), '[^A-Za-z0-9]', '', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==============================================================================
-- 4. TABELA: USUÁRIOS E MOTORISTAS (usuarios_motoristas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.usuarios_motoristas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  cpf VARCHAR(18) NOT NULL UNIQUE,
  cargo VARCHAR(30) NOT NULL CHECK (cargo IN ('GESTOR', 'OPERADOR', 'MOTORISTA', 'VISUALIZADOR')),
  status VARCHAR(20) NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO')),
  telefone VARCHAR(30) NOT NULL,
  cnh VARCHAR(30),
  cnh_validade DATE,
  cnh_categoria VARCHAR(10),
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_usuarios_motoristas_updated_at
BEFORE UPDATE ON public.usuarios_motoristas
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 5. TABELA: VEÍCULOS (veiculos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.veiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placa VARCHAR(10) NOT NULL,
  placa_normalizada VARCHAR(10) GENERATED ALWAYS AS (UPPER(REGEXP_REPLACE(placa, '[^A-Za-z0-9]', '', 'g'))) STORED UNIQUE,
  modelo TEXT NOT NULL,
  marca TEXT NOT NULL,
  ano INTEGER NOT NULL CHECK (ano >= 1970 AND ano <= 2050),
  cor TEXT NOT NULL,
  categoria VARCHAR(20) NOT NULL CHECK (categoria IN ('PASSEIO', 'UTILITARIO', 'CAMINHAO', 'MOTO', 'VAN')),
  chassi VARCHAR(50),
  renavam VARCHAR(30),
  odometro_atual INTEGER NOT NULL DEFAULT 0,
  odometro_estimado INTEGER,
  odometro_rastreador INTEGER,
  data_ultimo_odometro_estimado DATE,
  data_ultimo_odometro_rastreador TIMESTAMPTZ,
  horimetro INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'OPERANDO' CHECK (status IN ('OPERANDO', 'PARADO', 'MANUTENCAO', 'ALERTA')),
  combustivel VARCHAR(20) NOT NULL DEFAULT 'FLEX' CHECK (combustivel IN ('GASOLINA', 'ETANOL', 'DIESEL_S10', 'DIESEL_S500', 'FLEX', 'GNV', 'ELETRICO', 'HIBRIDO')),
  motorista_id UUID REFERENCES public.usuarios_motoristas(id) ON DELETE SET NULL,
  motorista_nome TEXT,
  localizacao JSONB NOT NULL DEFAULT '{"lat": -1.4558, "lng": -48.4902, "cidade": "Belém", "uf": "PA", "endereco": "Belém - PA"}'::jsonb,
  ignicao BOOLEAN NOT NULL DEFAULT false,
  velocidade NUMERIC(6,2) NOT NULL DEFAULT 0,
  bloqueado BOOLEAN NOT NULL DEFAULT false,
  nivel_tanque INTEGER NOT NULL DEFAULT 100 CHECK (nivel_tanque >= 0 AND nivel_tanque <= 100),
  bateria_volts NUMERIC(4,2) NOT NULL DEFAULT 12.6,
  ultima_comunicacao TIMESTAMPTZ DEFAULT NOW(),
  valor_venal_fipe NUMERIC(12,2) NOT NULL DEFAULT 0,
  tempo_sem_multas_anos INTEGER NOT NULL DEFAULT 0 CHECK (tempo_sem_multas_anos IN (0, 1, 2)),
  codigo_fipe VARCHAR(20),
  mes_referencia_fipe VARCHAR(50),
  data_ultima_atualizacao_fipe TIMESTAMPTZ,
  fipe_prices JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_veiculos_placa_norm ON public.veiculos(placa_normalizada);
CREATE INDEX IF NOT EXISTS idx_veiculos_status ON public.veiculos(status);

CREATE TRIGGER trg_veiculos_updated_at
BEFORE UPDATE ON public.veiculos
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 6. TABELA: MANUTENÇÕES E SERVIÇOS (manutencoes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.manutencoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  placa VARCHAR(10) NOT NULL,
  modelo TEXT NOT NULL,
  data_servico DATE NOT NULL,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('OLEO', 'MECANICA', 'ELETRICA', 'PNEU', 'FUNILARIA', 'REVISAO_PROGRAMADA', 'VISTORIA', 'OUTROS')),
  fornecedor TEXT NOT NULL,
  odometro INTEGER NOT NULL CHECK (odometro >= 0),
  valor_pecas NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_mao_de_obra NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  proxima_revisao_km INTEGER NOT NULL DEFAULT 0,
  proxima_revisao_data DATE,
  itens_proxima_revisao JSONB DEFAULT '[]'::jsonb,
  observacoes TEXT,
  ia_gerado BOOLEAN NOT NULL DEFAULT false,
  provedor_ia VARCHAR(30),
  recomendacao_ia TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'CONCLUIDO' CHECK (status IN ('CONCLUIDO', 'AGENDADO', 'EM_ANDAMENTO')),
  anexo_documento JSONB,
  criado_por_id UUID REFERENCES public.usuarios_motoristas(id) ON DELETE SET NULL,
  criado_por_nome TEXT,
  criado_por_cargo VARCHAR(30),
  editado_por_nome TEXT,
  editado_por_cargo VARCHAR(30),
  motivo_edicao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manutencoes_veiculo ON public.manutencoes(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_data ON public.manutencoes(data_servico DESC);

CREATE TRIGGER trg_manutencoes_updated_at
BEFORE UPDATE ON public.manutencoes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 7. TABELA: PEÇAS UTILIZADAS (pecas_manutencao)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.pecas_manutencao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manutencao_id UUID NOT NULL REFERENCES public.manutencoes(id) ON DELETE CASCADE,
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  quantidade NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  valor_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pecas_manutencao ON public.pecas_manutencao(manutencao_id);

-- ==============================================================================
-- 8. TABELA: SERVIÇOS EXECUTADOS / MÃO DE OBRA (servicos_executados)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.servicos_executados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manutencao_id UUID NOT NULL REFERENCES public.manutencoes(id) ON DELETE CASCADE,
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_servicos_manutencao ON public.servicos_executados(manutencao_id);

-- ==============================================================================
-- 9. TABELA: PLANOS DE REVISÃO PREVENTIVA (planos_revisao)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.planos_revisao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  placa VARCHAR(10) NOT NULL,
  titulo TEXT NOT NULL,
  item VARCHAR(50) NOT NULL CHECK (item IN (
    'OLEO_FILTRO', 'PASTILHAS_FREIO', 'CORREIA_DENTADA', 'PNEUS',
    'FILTRO_AR_COMBUSTIVEL', 'SISTEMA_ARREFECIMENTO', 'SUSPENSAO', 'REVISAO_GERAL'
  )),
  intervalo_km INTEGER NOT NULL CHECK (intervalo_km > 0),
  intervalo_meses INTEGER NOT NULL CHECK (intervalo_meses > 0),
  ultimo_km_realizado INTEGER NOT NULL DEFAULT 0,
  ultima_data_realizada DATE NOT NULL,
  proximo_km INTEGER NOT NULL,
  proxima_data DATE NOT NULL,
  km_restantes INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'EM_DIA' CHECK (status IN ('EM_DIA', 'PROXIMO', 'VENCIDO')),
  prioridade VARCHAR(20) NOT NULL DEFAULT 'MEDIA' CHECK (prioridade IN ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planos_veiculo ON public.planos_revisao(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_planos_status ON public.planos_revisao(status);

CREATE TRIGGER trg_planos_revisao_updated_at
BEFORE UPDATE ON public.planos_revisao
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 10. TABELA: LICENCIAMENTO E IPVA DETRAN-PA (licenciamento_ipva)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.licenciamento_ipva (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID REFERENCES public.veiculos(id) ON DELETE CASCADE,
  placa VARCHAR(10) NOT NULL,
  exercicio INTEGER NOT NULL,
  final_dois_digitos VARCHAR(2) NOT NULL,
  final_simples VARCHAR(1) NOT NULL,
  final_placa VARCHAR(2),
  grupo_final VARCHAR(20),
  mes_vencimento VARCHAR(30) NOT NULL,
  data_limite_licenciamento DATE NOT NULL,
  data_cota_unica_desconto15 DATE,
  data_cota_unica_desconto10 DATE,
  data_cota_sem_desconto DATE,
  cota1_parcelamento DATE,
  cota2_parcelamento DATE,
  cota3_parcelamento DATE,
  valor_venal_fipe NUMERIC(12,2) NOT NULL DEFAULT 0,
  aliquota_ipva NUMERIC(5,4) NOT NULL DEFAULT 0.025,
  valor_ipva_estimado NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto_aplicado NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_ipva_com_desconto NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_taxa_detran NUMERIC(12,2) NOT NULL DEFAULT 254.12,
  valor_total_estimado NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'EM_DIA' CHECK (status IN ('EM_DIA', 'VENCE_EM_BREVE', 'VENCIDO')),
  dias_restantes INTEGER NOT NULL DEFAULT 0,
  pago BOOLEAN NOT NULL DEFAULT false,
  data_pagamento DATE,
  data_baixa DATE,
  comprovante_numero TEXT,
  observacoes_baixa TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_licenciamento_placa_exercicio UNIQUE (placa, exercicio)
);

CREATE INDEX IF NOT EXISTS idx_licenciamento_placa ON public.licenciamento_ipva(placa);
CREATE INDEX IF NOT EXISTS idx_licenciamento_status ON public.licenciamento_ipva(status);

CREATE TRIGGER trg_licenciamento_ipva_updated_at
BEFORE UPDATE ON public.licenciamento_ipva
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 11. TABELA: ALERTAS DE TELEMETRIA (alertas_telemetria)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.alertas_telemetria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID REFERENCES public.veiculos(id) ON DELETE CASCADE,
  placa VARCHAR(10) NOT NULL,
  tipo VARCHAR(40) NOT NULL CHECK (tipo IN (
    'EXCESSO_VELOCIDADE', 'IGNICAO', 'CERCA_VIRTUAL', 'BATERIA_BAIXA',
    'MANUTENCAO_VENCIDA', 'LICENCIAMENTO_PA', 'BLOQUEIO_SEGURANCA', 'BOTÃO_PANICO', 'DESVIO_ROTA'
  )),
  nivel VARCHAR(20) NOT NULL DEFAULT 'AVISO' CHECK (nivel IN ('INFO', 'AVISO', 'CRITICO')),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  enviado_chatwoot BOOLEAN NOT NULL DEFAULT false,
  data_envio_chatwoot TIMESTAMPTZ,
  resolvido BOOLEAN NOT NULL DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alertas_resolvido ON public.alertas_telemetria(resolvido);
CREATE INDEX IF NOT EXISTS idx_alertas_timestamp ON public.alertas_telemetria(timestamp DESC);

-- ==============================================================================
-- 12. TABELA: HISTÓRICO DE NOTIFICAÇÕES CHATWOOT (historico_chatwoot)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.historico_chatwoot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alerta_id UUID REFERENCES public.alertas_telemetria(id) ON DELETE SET NULL,
  placa VARCHAR(10) NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  mensagem TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ENVIADO' CHECK (status IN ('ENVIADO', 'SIMULADO', 'FALHA')),
  detalhe TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatwoot_placa ON public.historico_chatwoot(placa);
CREATE INDEX IF NOT EXISTS idx_chatwoot_timestamp ON public.historico_chatwoot(timestamp DESC);

-- ==============================================================================
-- 13. TABELA: LOGS UNIFICADOS DE INTEGRAÇÃO (logs_integracao)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.logs_integracao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration VARCHAR(30) NOT NULL CHECK (integration IN ('selsyn', 'chatwoot', 'openai', 'supabase')),
  endpoint TEXT NOT NULL,
  method VARCHAR(10) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'ERROR', 'INFO')),
  status_code INTEGER,
  latency_ms INTEGER,
  message TEXT NOT NULL,
  payload_preview TEXT,
  details JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_integration ON public.logs_integracao(integration);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON public.logs_integracao(timestamp DESC);

-- ==============================================================================
-- 14. TABELA: DOCUMENTOS E ANEXOS (documentos_anexos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.documentos_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID REFERENCES public.veiculos(id) ON DELETE CASCADE,
  manutencao_id UUID REFERENCES public.manutencoes(id) ON DELETE SET NULL,
  tipo_documento VARCHAR(40) NOT NULL CHECK (tipo_documento IN (
    'NOTA_FISCAL', 'FOTO_MANUTENCAO', 'COMPROVANTE_PAGAMENTO', 'DOCUMENTO_VEICULO', 'ORDEM_SERVICO'
  )),
  nome_arquivo TEXT NOT NULL,
  tamanho_bytes BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  bucket_name VARCHAR(50) NOT NULL DEFAULT 'documentos-frota',
  storage_path TEXT NOT NULL UNIQUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documentos_veiculo ON public.documentos_anexos(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_documentos_manutencao ON public.documentos_anexos(manutencao_id);

-- ==============================================================================
-- 15. TABELA: CONFIGURAÇÕES DO SISTEMA (configuracoes_sistema)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.configuracoes_sistema (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'current',
  tracking JSONB NOT NULL,
  chatwoot JSONB NOT NULL,
  detran JSONB NOT NULL,
  openai JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 16. SEGURANÇA: ROW LEVEL SECURITY (RLS) - TODAS AS TABELAS OPERACIONAIS
-- BLOQUEIO RIGOROSO DE ACESSO ANÔNIMO. PERMISSÃO RESTRITA A AUTHENTICATED.
-- ==============================================================================
ALTER TABLE public.usuarios_motoristas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manutencoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pecas_manutencao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos_executados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos_revisao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenciamento_ipva ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_telemetria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_chatwoot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_integracao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_sistema ENABLE ROW LEVEL SECURITY;

-- Exemplo de Políticas: Somente usuários autenticados (auth.uid() IS NOT NULL)
-- Nenhum acesso anônimo (anon role) é permitido para leitura ou escrita!

-- Veículos
DROP POLICY IF EXISTS "Apenas autenticados leem veiculos" ON public.veiculos;
CREATE POLICY "Apenas autenticados leem veiculos"
ON public.veiculos FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Apenas autenticados gerenciam veiculos" ON public.veiculos;
CREATE POLICY "Apenas autenticados gerenciam veiculos"
ON public.veiculos FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Manutenções
DROP POLICY IF EXISTS "Apenas autenticados gerenciam manutencoes" ON public.manutencoes;
CREATE POLICY "Apenas autenticados gerenciam manutencoes"
ON public.manutencoes FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Peças
DROP POLICY IF EXISTS "Apenas autenticados gerenciam pecas" ON public.pecas_manutencao;
CREATE POLICY "Apenas autenticados gerenciam pecas"
ON public.pecas_manutencao FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Serviços
DROP POLICY IF EXISTS "Apenas autenticados gerenciam servicos" ON public.servicos_executados;
CREATE POLICY "Apenas autenticados gerenciam servicos"
ON public.servicos_executados FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Planos de Revisão
DROP POLICY IF EXISTS "Apenas autenticados gerenciam planos_revisao" ON public.planos_revisao;
CREATE POLICY "Apenas autenticados gerenciam planos_revisao"
ON public.planos_revisao FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Licenciamento
DROP POLICY IF EXISTS "Apenas autenticados gerenciam licenciamento_ipva" ON public.licenciamento_ipva;
CREATE POLICY "Apenas autenticados gerenciam licenciamento_ipva"
ON public.licenciamento_ipva FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Usuários e Motoristas
DROP POLICY IF EXISTS "Apenas autenticados gerenciam usuarios_motoristas" ON public.usuarios_motoristas;
CREATE POLICY "Apenas autenticados gerenciam usuarios_motoristas"
ON public.usuarios_motoristas FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Alertas
DROP POLICY IF EXISTS "Apenas autenticados gerenciam alertas_telemetria" ON public.alertas_telemetria;
CREATE POLICY "Apenas autenticados gerenciam alertas_telemetria"
ON public.alertas_telemetria FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Chatwoot
DROP POLICY IF EXISTS "Apenas autenticados gerenciam historico_chatwoot" ON public.historico_chatwoot;
CREATE POLICY "Apenas autenticados gerenciam historico_chatwoot"
ON public.historico_chatwoot FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Logs Integração
DROP POLICY IF EXISTS "Apenas autenticados gerenciam logs_integracao" ON public.logs_integracao;
CREATE POLICY "Apenas autenticados gerenciam logs_integracao"
ON public.logs_integracao FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Documentos Anexos
DROP POLICY IF EXISTS "Apenas autenticados gerenciam documentos_anexos" ON public.documentos_anexos;
CREATE POLICY "Apenas autenticados gerenciam documentos_anexos"
ON public.documentos_anexos FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Configurações
DROP POLICY IF EXISTS "Apenas autenticados gerenciam configuracoes_sistema" ON public.configuracoes_sistema;
CREATE POLICY "Apenas autenticados gerenciam configuracoes_sistema"
ON public.configuracoes_sistema FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- ==============================================================================
-- 17. SUPABASE STORAGE (BUCKET PRIVADO: documentos-frota)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos-frota',
  'documentos-frota',
  false,
  20971520, -- 20 MB limite por documento
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 20971520;

-- Política de Storage: apenas usuários autenticados acessam o bucket privado
DROP POLICY IF EXISTS "Documentos da frota acessiveis apenas por autenticados" ON storage.objects;
CREATE POLICY "Documentos da frota acessiveis apenas por autenticados"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'documentos-frota' AND auth.uid() IS NOT NULL)
WITH CHECK (bucket_id = 'documentos-frota' AND auth.uid() IS NOT NULL);
`;

export const SUPABASE_FORNECEDORES_SCHEMA_SQL = `-- ==============================================================================
-- FLEET TELECOM - GESTÃO DE FROTA PA
-- Migration: 20261031_002_fornecedores.sql
-- Descrição: Tabela de fornecedores credenciados e vínculo com manutenções
-- Segurança: Row Level Security (RLS) habilitado. Administrador gerencia; operador consulta/seleciona.
--            ON DELETE RESTRICT impede exclusão com histórico vinculado.
-- ==============================================================================

-- 1. TABELA: FORNECEDORES (fornecedores)
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  fantasia TEXT NOT NULL,
  cpf_cnpj VARCHAR(20) NOT NULL UNIQUE,
  tipo_documento VARCHAR(10) NOT NULL CHECK (tipo_documento IN ('CPF', 'CNPJ')),
  categoria VARCHAR(30) NOT NULL CHECK (categoria IN ('oficina', 'pecas', 'pneus', 'eletrica', 'funilaria', 'outros')),
  contato TEXT,
  whatsapp VARCHAR(30),
  email VARCHAR(100),
  endereco TEXT,
  cidade TEXT NOT NULL DEFAULT 'Belém',
  uf VARCHAR(2) NOT NULL DEFAULT 'PA',
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de busca e unicidade
CREATE INDEX IF NOT EXISTS idx_fornecedores_cpf_cnpj ON public.fornecedores(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_fornecedores_categoria ON public.fornecedores(categoria);
CREATE INDEX IF NOT EXISTS idx_fornecedores_ativo ON public.fornecedores(ativo);

-- Trigger de updated_at
CREATE TRIGGER trg_fornecedores_updated_at
BEFORE UPDATE ON public.fornecedores
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. VÍNCULO COM A TABELA DE MANUTENÇÕES
-- Adiciona a coluna fornecedor_id com ON DELETE RESTRICT (impede exclusão de fornecedores com histórico)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'manutencoes' 
    AND column_name = 'fornecedor_id'
  ) THEN
    ALTER TABLE public.manutencoes 
    ADD COLUMN fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_manutencoes_fornecedor_id ON public.manutencoes(fornecedor_id);

-- 3. SEGURANÇA: ROW LEVEL SECURITY (RLS)
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

-- Bloqueio total a anônimos
DROP POLICY IF EXISTS "Bloquear acesso anonimo a fornecedores" ON public.fornecedores;
CREATE POLICY "Bloquear acesso anonimo a fornecedores"
ON public.fornecedores
FOR ALL
TO anon
USING (false);

-- Leitura: Usuários autenticados (Gestores, Operadores, Motoristas) podem consultar e selecionar fornecedores
DROP POLICY IF EXISTS "Leitura de fornecedores para usuarios autenticados" ON public.fornecedores;
CREATE POLICY "Leitura de fornecedores para usuarios autenticados"
ON public.fornecedores
FOR SELECT
TO authenticated
USING (true);

-- Gestão completa (INSERT, UPDATE, DELETE): Somente Administradores/Gestores
DROP POLICY IF EXISTS "Gestores gerenciam fornecedores" ON public.fornecedores;
CREATE POLICY "Gestores gerenciam fornecedores"
ON public.fornecedores
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios_motoristas u
    WHERE u.auth_user_id = auth.uid()
    AND u.cargo = 'GESTOR'
    AND u.status = 'ATIVO'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios_motoristas u
    WHERE u.auth_user_id = auth.uid()
    AND u.cargo = 'GESTOR'
    AND u.status = 'ATIVO'
  )
);
`;

