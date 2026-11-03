#!/usr/bin/env bash
# ==============================================================================
# FLEET TELECOM - RESTAURAÇÃO SEGURA POSTGRESQL 17
# Uso: ./database/scripts/restore.sh /caminho/para/fleet_db_backup_DATA.sql.gz
# AVISO: Operação destrutiva que substitui os dados atuais do banco pelo backup.
# ==============================================================================

set -euo pipefail

if [[ $# -lt 1 ]]; then
    echo "Uso: $0 <caminho_do_arquivo_de_backup.sql.gz>"
    exit 1
fi

BACKUP_FILE="$1"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-fleet_db}"
DB_USER="${DB_USER:-fleet_user}"

if [[ ! -f "${BACKUP_FILE}" ]]; then
    echo "[-] Erro: Arquivo de backup não encontrado: ${BACKUP_FILE}"
    exit 1
fi

# Resolução de senha via Secret ou Variável
if [[ -n "${POSTGRES_PASSWORD_FILE:-}" && -f "${POSTGRES_PASSWORD_FILE}" ]]; then
    export PGPASSWORD="$(cat "${POSTGRES_PASSWORD_FILE}")"
elif [[ -f "/run/secrets/db_password" ]]; then
    export PGPASSWORD="$(cat "/run/secrets/db_password")"
elif [[ -n "${DB_PASSWORD:-}" ]]; then
    export PGPASSWORD="${DB_PASSWORD}"
fi

echo "======================================================================"
echo " [ALERTA DE RESTAURAÇÃO] FLEET TELECOM POSTGRESQL"
echo " Banco Destino: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo " Arquivo Fonte: ${BACKUP_FILE}"
echo "======================================================================"
echo "ATENÇÃO: Todos os dados atuais serão substituídos pelos dados do backup."
read -p "Deseja realmente continuar? Digite 'CONFIRMAR-RESTORE': " CONFIRMATION

if [[ "${CONFIRMATION}" != "CONFIRMAR-RESTORE" ]]; then
    echo "[-] Operação cancelada pelo operador."
    exit 0
fi

echo "[*] Descompactando e restaurando base de dados..."
gunzip -c "${BACKUP_FILE}" | psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1

echo "[+] Restauração concluída com sucesso."
