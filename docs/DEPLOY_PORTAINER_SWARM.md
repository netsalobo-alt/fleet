# GUIA DE DEPLOY: FLEET TELECOM NO PORTAINER / DOCKER SWARM
# (Build Local da Imagem: fleet-app:1.0.0 - Sem Registry Privado)

**Domínio:** `fleet.nortetelecom.net.br`  
**Roteador de Entrada:** Traefik existente (Rede externa: `Mosqueironet`)  
**Banco de Dados:** PostgreSQL 17 Dedicado (Rede privada: `fleet_internal`)  
**Volume do Banco:** `fleet_postgres_data`  
**Imagem da Aplicação:** `fleet-app:1.0.0` (construída localmente no nó Manager)  

---

## 1. Pré-Requisitos no Servidor (Nó Manager do Swarm)

1. **Entrada DNS:**  
   Configure um registro do tipo `A` (ou `CNAME`) na zona DNS de `nortetelecom.net.br`:
   ```text
   fleet.nortetelecom.net.br  IN  A  <IP_PUBLICO_DO_TRAEFIK>
   ```

2. **Verificar a Rede Externa do Traefik (Mosqueironet):**  
   Certifique-se de que a rede overlay `Mosqueironet` já existe no cluster:
   ```bash
   docker network ls | grep Mosqueironet
   ```
   *(Caso não exista, crie-a como overlay anexável: `docker network create --driver overlay --attachable Mosqueironet`)*

---

## 2. Passo a Passo: Download do Código e Build Local da Imagem

Como não há registry privado, a imagem é compilada diretamente no servidor que atua como **Manager** do cluster Swarm:

```bash
# 1. Acesse o servidor via SSH no nó Manager do cluster
ssh usuario@ip-do-servidor

# 2. Crie ou acesse o diretório de aplicações
mkdir -p /opt/apps && cd /opt/apps

# 3. Clone o repositório do GitHub (ou baixe os arquivos mais recentes)
git clone https://github.com/SEU_USUARIO/fleet-frota.git fleet
cd /opt/apps/fleet

# 4. Caso já tenha clonado anteriormente e queira apenas atualizar:
# git pull origin main

# 5. Construa a imagem localmente com a tag fleet-app:1.0.0
docker build -t fleet-app:1.0.0 .

# 6. Verifique se a imagem foi criada com sucesso
docker images | grep fleet-app
# Saída esperada: fleet-app   1.0.0   ...   <tamanho otimizado ~200MB>
```

> **Nota de Arquitetura Swarm:**  
> Como a imagem foi construída localmente e não em um registry centralizado, o serviço `fleet_app` no arquivo `docker-stack.yml` foi configurado com a restrição de placement:
> ```yaml
> placement:
>   constraints:
>     - node.role == manager
> ```
> Isso garante que o Docker Swarm instancie o container exclusivamente no nó onde a imagem `fleet-app:1.0.0` existe.

---

## 3. Criação dos Segredos no Docker Swarm (Docker Secrets)

No terminal do nó Manager (ou pela interface do Portainer em **Secrets**):

```bash
# 1. Cria a senha do banco PostgreSQL dedicada ao usuário fleet_user
openssl rand -base64 24 | tr -d '\n' | docker secret create db_password -

# 2. Cria a chave de API do Gemini para os serviços de IA e leitura de notas
echo -n "SUA_CHAVE_GEMINI_AQUI" | docker secret create gemini_api_key -
```

---

## 4. Publicação da Stack no Portainer

1. Acesse o painel web do **Portainer**.
2. No menu lateral do cluster Swarm, clique em **Stacks** > **Add stack**.
3. Escolha **Web editor** ou faça o upload do arquivo `docker-stack.yml`.
4. Defina o nome da stack: `fleet_telecom`.
5. Cole o conteúdo integral do arquivo `docker-stack.yml`.
6. Clique no botão **Deploy the stack**.

O Portainer criará os serviços `fleet_telecom_fleet_app` e `fleet_telecom_fleet_db`.

---

## 5. Execução das Migrations Iniciais do PostgreSQL

Com a stack iniciada e o serviço `fleet_db` saudável:

```bash
# Identifica o ID do container do banco
DB_CONTAINER=$(docker ps -q -f name=fleet_telecom_fleet_db)

# Executa as migrations versionadas contidas na pasta do projeto
docker exec -i ${DB_CONTAINER} bash < /opt/apps/fleet/database/scripts/migrate.sh
```

---

## 6. Verificação de Saúde e Roteamento

1. **Liveness Probe (Aplicação e Servidor Web):**
   ```bash
   curl -I https://fleet.nortetelecom.net.br/api/health
   # Retorno esperado: HTTP/2 200 OK
   ```

2. **Readiness Probe (Status da Aplicação):**
   ```bash
   curl -s https://fleet.nortetelecom.net.br/api/ready
   ```

3. **Logs dos Containers no Portainer:**
   - Acesse **Services** > `fleet_telecom_fleet_app` > **Logs** para verificar a inicialização do Express.
   - Acesse **Services** > `fleet_telecom_fleet_db` > **Logs** para verificar o PostgreSQL 17 rodando no volume persistente `fleet_postgres_data`.

---

## 7. Como Atualizar a Aplicação no Futuro

Para aplicar novas alterações de código no futuro:

```bash
cd /opt/apps/fleet
git pull origin main

# Reconstrua a imagem local
docker build -t fleet-app:1.0.0 .

# Force o Swarm a atualizar o serviço com a nova imagem compilada
docker service update --force --image fleet-app:1.0.0 fleet_telecom_fleet_app
```
*(Ou pelo Portainer, abra o serviço `fleet_app` e clique no botão **Service update**).*
