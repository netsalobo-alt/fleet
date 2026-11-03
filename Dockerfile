# ==============================================================================
# FLEET TELECOM - PRODUÇÃO MULTI-STAGE DOCKERFILE
# Node.js 22 LTS (Alpine) - React/Vite + Backend Express
# ==============================================================================

# ------------------------------------------------------------------------------
# Estágio 1: Builder (Compilação do Frontend SPA e Bundle do Servidor Express)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Instala dependências necessárias para compilação
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Copia todo o código fonte da aplicação
COPY . .

# Compila o frontend React com Vite em /app/dist
RUN npm run build

# Empacota o servidor Express backend TypeScript em /app/dist/server.js
RUN npx esbuild server.ts --bundle --platform=node --format=esm --packages=external --outfile=dist/server.js

# Remove dependências de desenvolvimento para manter o tamanho mínimo
RUN npm prune --production

# ------------------------------------------------------------------------------
# Estágio 2: Runner (Ambiente Mínimo e Seguro de Execução em Produção)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=America/Belem

# Utilitário curl para healthcheck do Docker Swarm
RUN apk add --no-cache curl tzdata && \
    cp /usr/share/zoneinfo/America/Belem /etc/localtime && \
    echo "America/Belem" > /etc/timezone

# Usuário sem privilégios de root para segurança da aplicação
USER node

# Copia apenas as dependências de produção
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/package.json ./package.json

# Copia os arquivos compilados (Frontend SPA + Servidor Express)
COPY --chown=node:node --from=builder /app/dist ./dist

# Porta interna da aplicação (roteada exclusivamente pelo Traefik)
EXPOSE 3000

# Healthcheck interno do container via endpoint do backend
HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Inicializa o servidor Express em modo produção
CMD ["node", "dist/server.js"]
