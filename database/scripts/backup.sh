#!/usr/bin/env bash
# ==============================================================================
# FLEET TELECOM - BACKUP AUTOMATIZADO POSTGRESQL 17
# Uso: ./database/scripts/backup.sh [DIRETORIO_DESTINO]
# Agendamento recomendado via Cron no nó Swarm: 0 2 * * * (diariamente às 02h)
# ==============================================================================

set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-fleet_db}"
DB_USER="${DB_USER:-fleet_user}"
BACKUP_DIR="${1:-${BACKUP_DIR:-/var/backups/fleet_postgres}}"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
BACKUP_FILE="${BACKUP_DIR}/fleet_db_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=14

# Resolução de senha via Secret ou Variável
if [[ -n "${POSTGRES_PASSWORD_FILE:-}" && -f "${POSTGRES_PASSWORD_FILE}" ]]; then
    export PGPASSWORD="$(cat "${POSTGRES_PASSWORD_FILE}")"
elif [[ -f "/run/secrets/db_password" ]]; then
    export PGPASSWORD="$(cat "/run/secrets/db_password")"
elif [[ -n "${DB_PASSWORD:-}" ]]; then
    export PGPASSWORD="${DB_PASSWORD}"
fi

mkdir -p "${BACKUP_DIR}"

echo "======================================================================"
echo " [BACKUP] Fleet Telecom - Exportação Segura de Dados PostgreSQL"
echo " Banco: ${DB_NAME} em ${DB_HOST}:${DB_PORT}"
echo " Destino: ${BACKUP_FILE}"
echo "======================================================================"

# Executa dump completo com compressão inline
pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
    --format=plain \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists | gzip -9 > "${BACKUP_FILE}"

# Valida se o arquivo foi gerado e não está vazio
if [[ -s "${BACKUP_FILE}" ]]; then
    FILESIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "[+] Backup concluído com sucesso: ${BACKUP_FILE} (Tamanho: ${FILESIZE})"
else
    echo "[-] ERRO CRÍTICO: Arquivo de backup vazio ou falha na exportação!"
    exit 1
fi

# Rotação de backups antigos (mantém os últimos N dias)
echo "[*] Limpando backups com mais de ${RETENTION_DAYS} dias..."
find "${BACKUP_DIR}" -type f -name "fleet_db_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete || true

echo "[+] Processo finalizado. Para cópia externa, replique para S3/B2 ou storage corporativo."
