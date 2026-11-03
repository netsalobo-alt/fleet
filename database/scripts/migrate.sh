#!/usr/bin/env bash
# ==============================================================================
# FLEET TELECOM - EXECUTOR SEGURO DE MIGRATIONS POSTGRESQL 17
# Uso: ./database/scripts/migrate.sh
# Pode ser executado no host Docker ou diretamente dentro do container fleet_db
# ==============================================================================

set -euo pipefail

# Variáveis com padrões do Docker Swarm
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-fleet_db}"
DB_USER="${DB_USER:-fleet_user}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="${SCRIPT_DIR}/../migrations"

# Resolução de senha via Secret ou Variável
if [[ -n "${POSTGRES_PASSWORD_FILE:-}" && -f "${POSTGRES_PASSWORD_FILE}" ]]; then
    export PGPASSWORD="$(cat "${POSTGRES_PASSWORD_FILE}")"
elif [[ -f "/run/secrets/db_password" ]]; then
    export PGPASSWORD="$(cat "/run/secrets/db_password")"
elif [[ -n "${DB_PASSWORD:-}" ]]; then
    export PGPASSWORD="${DB_PASSWORD}"
fi

echo "======================================================================"
echo " [MIGRATE] Fleet Telecom - Execução de Migrations Versionadas"
echo " Alvo: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "======================================================================"

# Verifica conectividade com o PostgreSQL
if ! pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; then
    echo "[-] Erro: PostgreSQL não está respondendo em ${DB_HOST}:${DB_PORT}/${DB_NAME}."
    exit 1
fi

# Cria tabela de controle de migrations se não existir
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    description TEXT NOT NULL
);
SQL

# Itera sobre os arquivos SQL ordenados
for file in $(ls "${MIGRATIONS_DIR}"/*.sql | sort); do
    filename=$(basename "$file")
    version_id="${filename%.sql}"

    # Checa se já foi aplicada
    APPLIED=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -A -c \
        "SELECT COUNT(*) FROM schema_migrations WHERE version = '${version_id}';")

    if [[ "${APPLIED}" -eq "0" ]]; then
        echo "[*] Aplicando migration: ${filename}..."
        psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 -f "${file}"
        echo "[+] Migration ${filename} concluída com sucesso."
    else
        echo "[.] Migration já aplicada anteriormente: ${filename} (ignorada)."
    fi
done

echo "======================================================================"
echo "[+] Todas as migrations foram validadas e atualizadas."
echo "======================================================================"
