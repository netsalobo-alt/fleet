-- ==============================================================================
-- FLEET TELECOM - MIGRATION 001: SCHEMA INICIAL POSTGRESQL 17
-- Versão: 1.0.0
-- Descrição: Estrutura relacional do Fleet Frota Telecom (Pará)
-- ==============================================================================

-- 0. Tabela de Controle de Versionamento de Migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    description TEXT NOT NULL
);

-- Habilita extensão para geração de UUIDv4 nativa
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Função utilitária para atualização automática de updated_at
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. Tabela: fornecedores
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fornecedores (
    id VARCHAR(100) PRIMARY KEY DEFAULT ('sup-' || gen_random_uuid()),
    razao_social VARCHAR(255) NOT NULL,
    fantasia VARCHAR(255) NOT NULL,
    cpf_cnpj VARCHAR(20) NOT NULL UNIQUE,
    tipo_documento VARCHAR(10) NOT NULL DEFAULT 'CNPJ' CHECK (tipo_documento IN ('CPF', 'CNPJ')),
    categoria VARCHAR(50) NOT NULL DEFAULT 'oficina' CHECK (categoria IN ('oficina', 'pecas', 'pneus', 'eletrica', 'funilaria', 'outros')),
    contato VARCHAR(150),
    whatsapp VARCHAR(30),
    email VARCHAR(150),
    endereco VARCHAR(255),
    cidade VARCHAR(100) NOT NULL DEFAULT 'Belém',
    uf VARCHAR(2) NOT NULL DEFAULT 'PA',
    observacoes TEXT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_cpf_cnpj ON fornecedores (cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_fornecedores_categoria ON fornecedores (categoria);
CREATE INDEX IF NOT EXISTS idx_fornecedores_ativo ON fornecedores (ativo);

CREATE OR REPLACE TRIGGER trg_fornecedores_updated_at
BEFORE UPDATE ON fornecedores
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- ------------------------------------------------------------------------------
-- 2. Tabela: veiculos
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS veiculos (
    id VARCHAR(100) PRIMARY KEY DEFAULT ('v-' || gen_random_uuid()),
    placa VARCHAR(10) NOT NULL UNIQUE,
    modelo VARCHAR(150) NOT NULL,
    marca VARCHAR(100) NOT NULL,
    ano INTEGER NOT NULL,
    cor VARCHAR(50),
    categoria VARCHAR(50) NOT NULL DEFAULT 'UTILITARIO' CHECK (categoria IN ('PASSEIO', 'UTILITARIO', 'CAMINHAO', 'MOTO', 'MAQUINA')),
    chassi VARCHAR(30),
    renavam VARCHAR(30),
    odometro_atual INTEGER NOT NULL DEFAULT 0,
    odometro_estimado INTEGER,
    data_ultimo_odometro_estimado DATE,
    horimetro INTEGER DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'OPERANDO' CHECK (status IN ('OPERANDO', 'MANUTENCAO', 'ALERTA', 'INATIVO')),
    combustivel VARCHAR(30) DEFAULT 'FLEX',
    lat NUMERIC(10, 6),
    lng NUMERIC(10, 6),
    cidade VARCHAR(100) DEFAULT 'Belém',
    uf VARCHAR(2) DEFAULT 'PA',
    endereco VARCHAR(255),
    ignicao BOOLEAN DEFAULT FALSE,
    velocidade INTEGER DEFAULT 0,
    bloqueado BOOLEAN DEFAULT FALSE,
    nivel_tanque INTEGER DEFAULT 100,
    bateria_volts NUMERIC(4, 1) DEFAULT 13.8,
    ultima_comunicacao TIMESTAMPTZ,
    valor_venal_fipe NUMERIC(12, 2) DEFAULT 0,
    tempo_sem_multas_anos INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_veiculos_placa ON veiculos (placa);
CREATE INDEX IF NOT EXISTS idx_veiculos_status ON veiculos (status);
CREATE INDEX IF NOT EXISTS idx_veiculos_cidade ON veiculos (cidade);

CREATE OR REPLACE TRIGGER trg_veiculos_updated_at
BEFORE UPDATE ON veiculos
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- ------------------------------------------------------------------------------
-- 3. Tabela: usuarios_sistema
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios_sistema (
    id VARCHAR(100) PRIMARY KEY DEFAULT ('usr-' || gen_random_uuid()),
    nome VARCHAR(150) NOT NULL,
    login VARCHAR(100) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    cpf VARCHAR(20),
    cargo VARCHAR(50) NOT NULL DEFAULT 'OPERADOR' CHECK (cargo IN ('GESTOR', 'OPERADOR', 'MOTORISTA')),
    status VARCHAR(20) NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO', 'BLOQUEADO')),
    telefone VARCHAR(30),
    cnh VARCHAR(30),
    cnh_categoria VARCHAR(10),
    cnh_validade DATE,
    permissoes_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuarios_login ON usuarios_sistema (login);
CREATE INDEX IF NOT EXISTS idx_usuarios_cargo ON usuarios_sistema (cargo);

CREATE OR REPLACE TRIGGER trg_usuarios_updated_at
BEFORE UPDATE ON usuarios_sistema
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- ------------------------------------------------------------------------------
-- 4. Tabela: manutencoes
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS manutencoes (
    id VARCHAR(100) PRIMARY KEY DEFAULT ('srv-' || gen_random_uuid()),
    veiculo_id VARCHAR(100) REFERENCES veiculos(id) ON DELETE RESTRICT,
    placa VARCHAR(10) NOT NULL,
    modelo VARCHAR(150) NOT NULL,
    data DATE NOT NULL,
    tipo VARCHAR(50) NOT NULL DEFAULT 'OUTROS' CHECK (tipo IN ('OLEO', 'MECANICA', 'ELETRICA', 'PNEU', 'FUNILARIA', 'REVISAO_PROGRAMADA', 'VISTORIA', 'OUTROS')),
    fornecedor_id VARCHAR(100) REFERENCES fornecedores(id) ON DELETE RESTRICT,
    fornecedor_nome VARCHAR(255) NOT NULL,
    odometro INTEGER NOT NULL,
    valor_pecas NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    valor_mao_de_obra NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    valor_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    proxima_revisao_km INTEGER,
    proxima_revisao_data DATE,
    itens_proxima_revisao JSONB DEFAULT '[]'::jsonb,
    observacoes TEXT,
    descricao_resumida VARCHAR(255),
    ia_gerado BOOLEAN DEFAULT FALSE,
    provedor_ia VARCHAR(50),
    recomendacao_ia TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'CONCLUIDO' CHECK (status IN ('CONCLUIDO', 'EM_ANDAMENTO', 'AGENDADO')),
    criado_por_id VARCHAR(100) REFERENCES usuarios_sistema(id) ON DELETE SET NULL,
    criado_por_nome VARCHAR(150),
    criado_por_cargo VARCHAR(50),
    -- Metadados do documento anexado
    anexo_nome VARCHAR(255),
    anexo_tipo VARCHAR(20) CHECK (anexo_tipo IN ('IMAGEM', 'PDF')),
    anexo_storage_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_manutencoes_veiculo ON manutencoes (veiculo_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_placa ON manutencoes (placa);
CREATE INDEX IF NOT EXISTS idx_manutencoes_fornecedor ON manutencoes (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_data ON manutencoes (data DESC);
CREATE INDEX IF NOT EXISTS idx_manutencoes_tipo ON manutencoes (tipo);

CREATE OR REPLACE TRIGGER trg_manutencoes_updated_at
BEFORE UPDATE ON manutencoes
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- ------------------------------------------------------------------------------
-- 5. Tabelas Filhas: manutencao_pecas e manutencao_servicos
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS manutencao_pecas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manutencao_id VARCHAR(100) NOT NULL REFERENCES manutencoes(id) ON DELETE CASCADE,
    descricao VARCHAR(255) NOT NULL,
    quantidade NUMERIC(10, 2) NOT NULL DEFAULT 1,
    valor_unitario NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pecas_manutencao ON manutencao_pecas (manutencao_id);

CREATE TABLE IF NOT EXISTS manutencao_servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manutencao_id VARCHAR(100) NOT NULL REFERENCES manutencoes(id) ON DELETE CASCADE,
    descricao VARCHAR(255) NOT NULL,
    valor NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_servicos_manutencao ON manutencao_servicos (manutencao_id);

-- ------------------------------------------------------------------------------
-- 6. Tabela: planos_revisao
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS planos_revisao (
    id VARCHAR(100) PRIMARY KEY DEFAULT ('rev-' || gen_random_uuid()),
    veiculo_id VARCHAR(100) NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    placa VARCHAR(10) NOT NULL,
    modelo VARCHAR(150) NOT NULL,
    item VARCHAR(50) NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    intervalo_km INTEGER NOT NULL,
    intervalo_meses INTEGER NOT NULL,
    odometro_ultima_revisao INTEGER NOT NULL DEFAULT 0,
    data_ultima_revisao DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'EM_DIA' CHECK (status IN ('EM_DIA', 'PROXIMO', 'VENCIDO')),
    proxima_revisao_km INTEGER NOT NULL,
    proxima_revisao_data DATE NOT NULL,
    prioridade VARCHAR(20) DEFAULT 'MEDIA' CHECK (prioridade IN ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA')),
    custo_estimado NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_revisoes_veiculo ON planos_revisao (veiculo_id);
CREATE INDEX IF NOT EXISTS idx_revisoes_status ON planos_revisao (status);

-- ------------------------------------------------------------------------------
-- 7. Tabela: alertas_telemetria
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alertas_telemetria (
    id VARCHAR(100) PRIMARY KEY DEFAULT ('alt-' || gen_random_uuid()),
    veiculo_id VARCHAR(100) REFERENCES veiculos(id) ON DELETE CASCADE,
    placa VARCHAR(10) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    severidade VARCHAR(20) NOT NULL CHECK (severidade IN ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA')),
    descricao TEXT NOT NULL,
    valor NUMERIC(10, 2),
    limite NUMERIC(10, 2),
    data TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lido BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alertas_veiculo ON alertas_telemetria (veiculo_id);
CREATE INDEX IF NOT EXISTS idx_alertas_lido ON alertas_telemetria (lido);

-- Registra a aplicação desta migration
INSERT INTO schema_migrations (version, description)
VALUES ('001_initial_schema', 'Tabelas relacionais completas para frotas, fornecedores e manutenções')
ON CONFLICT (version) DO NOTHING;
