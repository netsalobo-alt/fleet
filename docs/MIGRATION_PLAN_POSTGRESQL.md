# FLEET TELECOM — PLANO DE MIGRAÇÃO PARA POSTGRESQL PRÓPRIO

**Status da Etapa:** Infraestrutura e Schemas Preparados (Fase 1 Concluída)  
**Ambiente Alvo:** Docker Swarm / Portainer (Norte Telecom)  
**Domínio:** `fleet.nortetelecom.net.br`  
**Data do Relatório:** Novembro/2026  

---

## 1. Declaração de Escopo e Estado Atual

> **AVISO IMPORTANTE DE AUDITORIA E COMPLIANCE:**  
> Nesta etapa de infraestrutura, **não foi alterada a camada de persistência ativa** do sistema em execução. Os módulos de Cadastros, Veículos, Fornecedores, Manutenções, IPVA e Inteligência Artificial continuam operando com seus adaptadores atuais (Supabase e cache local controlado em `storage.ts`).  
> **A aplicação NÃO deve ser homologada como migrada para produção definitiva** até que os passos de migração de autenticação (Fase 3), migração de arquivos anexos (Fase 4) e importação segura de dados (Fase 2) sejam integralmente executados.

---

## 2. Inventário de Dependências Atuais

| Componente | Implementação Atual | Impacto na Migração | Alvo no PostgreSQL Próprio |
|---|---|---|---|
| **Autenticação & Sessão** | Supabase Auth (`@supabase/supabase-js`) | Tokens JWT gerados em nuvem externa | Provedor nativo de JWT + bcrypt no Express (`usuarios_sistema`) |
| **Armazenamento de Anexos** | Supabase Storage (`documentos-frota`) | URLs de imagens/PDFs hospedadas na nuvem | MinIO S3 local ou volume persistente `/var/fleet/storage` |
| **Segurança e Acesso (RLS)** | Supabase Row Level Security | Regras baseadas em `auth.uid()` do Supabase | Middleware Express de RBAC com perfis `GESTOR`, `OPERADOR`, `MOTORISTA` |
| **Cache & Offline** | LocalStorage (`src/services/storage.ts`) | Armazenamento de apoio no navegador | API REST nativa (`/api/veiculos`, `/api/fornecedores`, `/api/manutencoes`) |

---

## 3. Roteiro de Migração em 5 Fases

### Fase 1: Infraestrutura de Execução e Stack Swarm (CONCLUÍDA)
- [x] Dockerfile multi-stage de produção (Node.js 22 LTS) com compilação Vite e bundle Express.
- [x] Definição de stack `docker-stack.yml` para Docker Swarm / Portainer.
- [x] Provisionamento do serviço `fleet_db` (PostgreSQL 17-alpine) com usuário dedicado `fleet_user`.
- [x] Isolamento de rede: `fleet_internal` para o banco (porta 5432 fechada) e `network_public` para o Traefik.
- [x] Etiquetas do Traefik (`Host(\`fleet.nortetelecom.net.br\`)`, `websecure`, TLS Let's Encrypt).
- [x] Inclusão de Docker Secrets para senhas e chaves (`db_password`, `gemini_api_key`).
- [x] Healthchecks nativos implementados no backend Express: `/api/health` e `/api/ready`.

---

### Fase 2: Schemas Relacionais e Pipeline de Carga (PRONTA PARA EXECUÇÃO)
- [x] Criação da migration versionada `001_initial_schema.sql` contendo todas as tabelas, tipos ENUM, triggers de `updated_at`, índices e constraints.
- [x] Criação da migration `002_rbac_and_audit.sql` com tabelas de logs de auditoria e licenciamento IPVA 2026.
- [x] Criação dos scripts automatizados `migrate.sh`, `backup.sh` e `restore.sh`.
- [ ] **Pendente:** Execução do script de exportação de dados do Supabase atual em JSON/CSV e carga sanitizada nas tabelas PostgreSQL sem duplicidades.

---

### Fase 3: Migração de Autenticação e RBAC Nativo (PRÓXIMA ETAPA)
- [ ] Implementar rota de login `/api/auth/login` no Express com verificação de senha criptografada (`bcrypt`).
- [ ] Emitir tokens JWT seguros via Cookie `httpOnly` (`SameSite=Strict`, `Secure=true`).
- [ ] Substituir chamadas do cliente `supabase.auth` por chamadas à API nativa de sessão.
- [ ] Mapear permissões granulares dos usuários (`GESTOR`, `OPERADOR`, `MOTORISTA`) diretamente no middleware Express.

---

### Fase 4: Armazenamento Local de Documentos Fiscais
- [ ] Configurar endpoint de upload seguro no backend `/api/documentos/upload` com validação de extensão (PDF, JPEG, PNG) e limite de tamanho.
- [ ] Salvar arquivos no volume persistente do servidor com hashing SHA-256 e metadados na tabela `manutencoes` e `documentos_anexos`.
- [ ] Disponibilizar visualizador de documentos com link assinado ou streaming direto autenticado.

---

### Fase 5: Virada de Chave (Cutover) e Descomissionamento
- [ ] Validação integral de integridade referencial entre veículos, fornecedores e ordens de serviço.
- [ ] Desativação de chaves de transição do Supabase.
- [ ] Homologação em ambiente de staging espelhado.
- [ ] Lançamento oficial da versão com banco de dados 100% sob controle e soberania da Norte Telecom.
