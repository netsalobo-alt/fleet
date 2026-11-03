-- ==============================================================================
-- FLEET TELECOM - MIGRATION 002: AUDITORIA, IPVA E INTEGRIDADE
-- Versão: 1.1.0
-- Descrição: Tabelas de trilha de auditoria, controle de IPVA 2026 e integridade
-- ==============================================================================

-- 1. Tabela: logs_auditoria
CREATE TABLE IF NOT EXISTS logs_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tabela_afetada VARCHAR(100) NOT NULL,
    registro_id VARCHAR(100) NOT NULL,
    acao VARCHAR(20) NOT NULL CHECK (acao IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT')),
    usuario_id VARCHAR(100) REFERENCES usuarios_sistema(id) ON DELETE SET NULL,
    usuario_nome VARCHAR(150),
    dados_anteriores JSONB,
    dados_novos JSONB,
    ip_origem VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auditoria_tabela ON logs_auditoria (tabela_afetada, registro_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON logs_auditoria (usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_created_at ON logs_auditoria (created_at DESC);

-- 2. Tabela: licenciamento_ipva
CREATE TABLE IF NOT EXISTS licenciamento_ipva (
    id VARCHAR(100) PRIMARY KEY DEFAULT ('ipva-' || gen_random_uuid()),
    veiculo_id VARCHAR(100) NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    placa VARCHAR(10) NOT NULL,
    final_placa INTEGER NOT NULL CHECK (final_placa BETWEEN 0 AND 9),
    ano_exercicio INTEGER NOT NULL DEFAULT 2026,
    vencimento_cota_unica DATE NOT NULL,
    vencimento_parcela_1 DATE,
    vencimento_parcela_2 DATE,
    vencimento_parcela_3 DATE,
    valor_total_ipva NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    desconto_bom_motorista_pct NUMERIC(4, 2) DEFAULT 0.00,
    valor_com_desconto NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    taxa_licenciamento NUMERIC(10, 2) NOT NULL DEFAULT 264.44,
    status_pagamento VARCHAR(30) NOT NULL DEFAULT 'PENDENTE' CHECK (status_pagamento IN ('PENDENTE', 'PAGO', 'ATRASADO', 'PARCELADO')),
    data_pagamento DATE,
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ipva_veiculo_ano UNIQUE (veiculo_id, ano_exercicio)
);

CREATE INDEX IF NOT EXISTS idx_ipva_veiculo ON licenciamento_ipva (veiculo_id);
CREATE INDEX IF NOT EXISTS idx_ipva_status ON licenciamento_ipva (status_pagamento);

CREATE OR REPLACE TRIGGER trg_licenciamento_updated_at
BEFORE UPDATE ON licenciamento_ipva
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- 3. Regra de Integridade: Impedir exclusão acidental de Fornecedor com histórico
-- (A chave estrangeira em manutencoes já possui ON DELETE RESTRICT, garantindo integridade no engine)

-- Registra a aplicação desta migration
INSERT INTO schema_migrations (version, description)
VALUES ('002_rbac_and_audit', 'Auditoria completa de alterações e controle estadual de IPVA/Licenciamento PA')
ON CONFLICT (version) DO NOTHING;
