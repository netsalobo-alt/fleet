-- ==============================================================================
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
