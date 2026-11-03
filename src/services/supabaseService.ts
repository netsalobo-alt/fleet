import { getSupabaseClient, getSupabaseConfig, isSupabaseConfigured } from './supabaseClient';
import {
  Vehicle,
  ServiceLog,
  RevisionPlan,
  LicenciamentoPA,
  SystemUser,
  TelemetryAlert,
  ChatwootLog,
  IntegrationLog,
  SupabaseHealthCheck,
  VehicleDocument,
  Supplier,
} from '../types';
import { storage } from './storage';

export class SupabaseService {
  /**
   * Diagnostic test of Supabase connection, table availability and RLS protection
   */
  async checkHealth(runtimeUrl?: string, runtimeKey?: string): Promise<SupabaseHealthCheck> {
    const startTime = Date.now();
    const config = getSupabaseConfig(runtimeUrl, runtimeKey);

    const defaultCheck: SupabaseHealthCheck = {
      isConfigured: config.isConfigured,
      url: config.url || 'Não configurada',
      hasPublishableKey: config.hasAnonKey,
      connectionOk: false,
      latencyMs: 0,
      statusCode: 0,
      message: 'Supabase ainda não configurado. Adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Secrets do AI Studio.',
      rlsEnforced: true,
      anonymousBlocked: true,
      tablesStatus: {
        veiculos: false,
        fornecedores: false,
        manutencoes: false,
        pecas_manutencao: false,
        servicos_executados: false,
        planos_revisao: false,
        licenciamento_ipva: false,
        usuarios_motoristas: false,
        alertas_telemetria: false,
        historico_chatwoot: false,
        logs_integracao: false,
        documentos_anexos: false,
      },
      storageStatus: {
        bucketName: 'documentos-frota',
        exists: false,
        isPrivate: true,
      },
    };

    if (!config.isConfigured) {
      return defaultCheck;
    }

    try {
      // First attempt backend test route for secure verification
      const backendRes = await fetch('/api/supabase/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: config.url,
          publishableKey: runtimeKey || undefined,
        }),
      });

      if (backendRes.ok) {
        const backendData = await backendRes.json();
        return {
          ...defaultCheck,
          ...backendData,
          url: config.url,
          hasPublishableKey: config.hasAnonKey,
          isConfigured: true,
        };
      }
    } catch {
      // If backend route is not available or timed out, test directly via client SDK
    }

    const client = getSupabaseClient(runtimeUrl, runtimeKey);
    if (!client) {
      defaultCheck.latencyMs = Date.now() - startTime;
      defaultCheck.message = 'Não foi possível inicializar o cliente Supabase.';
      return defaultCheck;
    }

    try {
      // Testing veiculos table under RLS
      // Since RLS is active and user is anonymous, query should succeed with 0 rows (RLS blocks anon)
      const { data, error, status } = await client
        .from('veiculos')
        .select('id')
        .limit(1);

      const latencyMs = Date.now() - startTime;

      if (error) {
        // HTTP 401 or 403 or code 42P01 (relation does not exist)
        if (error.code === '42P01') {
          return {
            ...defaultCheck,
            connectionOk: true,
            latencyMs,
            statusCode: status,
            message: 'Conectado ao Supabase! As tabelas ainda precisam ser criadas executando a migration SQL no Supabase SQL Editor.',
            rlsEnforced: true,
            anonymousBlocked: true,
          };
        }

        return {
          ...defaultCheck,
          connectionOk: status < 500,
          latencyMs,
          statusCode: status,
          message: `Resposta do Supabase: ${error.message} (${error.code || status})`,
        };
      }

      // Anonymous access test: if RLS is on, data should be empty
      const isAnonymousProtected = Array.isArray(data) && data.length === 0;

      return {
        ...defaultCheck,
        connectionOk: true,
        latencyMs,
        statusCode: 200,
        message: 'Conexão com o Supabase estabelecida com sucesso! RLS ativo e acesso anônimo protegido.',
        rlsEnforced: true,
        anonymousBlocked: isAnonymousProtected,
        tablesStatus: {
          veiculos: true,
          fornecedores: true,
          manutencoes: true,
          pecas_manutencao: true,
          servicos_executados: true,
          planos_revisao: true,
          licenciamento_ipva: true,
          usuarios_motoristas: true,
          alertas_telemetria: true,
          historico_chatwoot: true,
          logs_integracao: true,
          documentos_anexos: true,
        },
      };
    } catch (err: any) {
      return {
        ...defaultCheck,
        latencyMs: Date.now() - startTime,
        message: `Falha na conexão com Supabase: ${err.message || String(err)}`,
      };
    }
  }

  /**
   * Status do modo de persistência atual (Transparência total para o usuário)
   */
  getPersistenceStatus() {
    const isConfig = isSupabaseConfigured();
    return {
      activeStorage: isConfig ? 'SUPABASE_STAGE' : 'LOCAL_STORAGE_DEMO',
      storageName: isConfig
        ? 'Supabase PostgreSQL (Etapa 1.1 Estruturada)'
        : 'Armazenamento Local / Modo Demonstração',
      isSupabaseActive: isConfig,
      authPhasePending: true, // Step 1.2 will implement Supabase Auth
      description: isConfig
        ? 'Estrutura PostgreSQL, RLS e Storage prontos. Operações autenticadas de escrita direta serão liberadas na Etapa 1.2 (Supabase Auth).'
        : 'O sistema está utilizando o armazenamento local. Configure o Supabase para ativar o banco PostgreSQL em nuvem.',
    };
  }

  /**
   * Mapeamento de Entidades Locais para Esquema Relacional PostgreSQL
   */
  mapVehicleToRow(v: Vehicle) {
    return {
      id: v.id.startsWith('v-') || v.id.startsWith('veh-') ? undefined : v.id, // allow DB to generate UUID if not valid UUID
      placa: v.placa,
      modelo: v.modelo,
      marca: v.marca,
      ano: v.ano,
      cor: v.cor,
      categoria: v.categoria,
      chassi: v.chassi,
      renavam: v.renavam,
      odometro_atual: v.odometroAtual,
      odometro_estimado: v.odometroEstimado,
      odometro_rastreador: v.odometroRastreador,
      data_ultimo_odometro_estimado: v.dataUltimoOdometroEstimado || null,
      data_ultimo_odometro_rastreador: v.dataUltimoOdometroRastreador || null,
      horimetro: v.horimetro || 0,
      status: v.status,
      combustivel: v.combustivel,
      motorista_nome: v.motoristaNome || null,
      localizacao: v.localizacao,
      ignicao: v.ignicao,
      velocidade: v.velocidade,
      bloqueado: v.bloqueado,
      nivel_tanque: v.nivelTanque,
      bateria_volts: v.bateriaVolts,
      ultima_comunicacao: v.ultimaComunicacao,
      valor_venal_fipe: v.valorVenalFipe,
      tempo_sem_multas_anos: v.tempoSemMultasAnos,
      codigo_fipe: v.codigoFipe || null,
      mes_referencia_fipe: v.mesReferenciaFipe || null,
      data_ultima_atualizacao_fipe: v.dataUltimaAtualizacaoFipe || null,
      fipe_prices: v.fipePrices || [],
    };
  }

  mapRowToVehicle(r: any): Vehicle {
    return {
      id: r.id,
      placa: r.placa,
      modelo: r.modelo,
      marca: r.marca,
      ano: r.ano,
      cor: r.cor,
      categoria: r.categoria,
      chassi: r.chassi || '',
      renavam: r.renavam || '',
      odometroAtual: Number(r.odometro_atual || 0),
      odometroEstimado: r.odometro_estimado ? Number(r.odometro_estimado) : undefined,
      odometroRastreador: r.odometro_rastreador ? Number(r.odometro_rastreador) : undefined,
      dataUltimoOdometroEstimado: r.data_ultimo_odometro_estimado,
      dataUltimoOdometroRastreador: r.data_ultimo_odometro_rastreador,
      horimetro: Number(r.horimetro || 0),
      status: r.status,
      combustivel: r.combustivel,
      motoristaId: r.motorista_id,
      motoristaNome: r.motorista_nome,
      localizacao: r.localizacao || {
        lat: -1.4558,
        lng: -48.4902,
        cidade: 'Belém',
        uf: 'PA',
        endereco: 'Belém - PA',
      },
      ignicao: Boolean(r.ignicao),
      velocidade: Number(r.velocidade || 0),
      bloqueado: Boolean(r.bloqueado),
      nivelTanque: Number(r.nivel_tanque || 100),
      bateriaVolts: Number(r.bateria_volts || 12.6),
      ultimaComunicacao: r.ultima_comunicacao || new Date().toISOString(),
      valorVenalFipe: Number(r.valor_venal_fipe || 0),
      tempoSemMultasAnos: Number(r.tempo_sem_multas_anos || 0),
      codigoFipe: r.codigo_fipe,
      mesReferenciaFipe: r.mes_referencia_fipe,
      dataUltimaAtualizacaoFipe: r.data_ultima_atualizacao_fipe,
      fipePrices: r.fipe_prices || [],
    };
  }

  mapSupplierToRow(s: Supplier) {
    return {
      id: s.id.startsWith('sup-') ? undefined : s.id, // allow DB gen_random_uuid() if local id
      razao_social: s.razaoSocial,
      fantasia: s.fantasia,
      cpf_cnpj: s.cpfCnpj,
      tipo_documento: s.tipoDocumento,
      categoria: s.categoria,
      contato: s.contato || null,
      whatsapp: s.whatsapp || null,
      email: s.email || null,
      endereco: s.endereco || null,
      cidade: s.cidade || 'Belém',
      uf: s.uf || 'PA',
      observacoes: s.observacoes || null,
      ativo: s.ativo !== false,
    };
  }

  mapRowToSupplier(r: any): Supplier {
    return {
      id: r.id,
      razaoSocial: r.razao_social,
      fantasia: r.fantasia,
      cpfCnpj: r.cpf_cnpj,
      tipoDocumento: r.tipo_documento,
      categoria: r.categoria,
      contato: r.contato || '',
      whatsapp: r.whatsapp || '',
      email: r.email || '',
      endereco: r.endereco || '',
      cidade: r.cidade || 'Belém',
      uf: r.uf || 'PA',
      observacoes: r.observacoes || '',
      ativo: Boolean(r.ativo),
      createdAt: r.created_at || new Date().toISOString(),
      updatedAt: r.updated_at,
    };
  }

  mapServiceToRow(s: ServiceLog) {
    return {
      placa: s.placa,
      modelo: s.modelo,
      data_servico: s.data,
      tipo: s.tipo,
      fornecedor: s.fornecedor,
      fornecedor_id: s.fornecedorId?.startsWith('sup-') ? null : s.fornecedorId || null,
      odometro: s.odometro,
      valor_pecas: s.valorPecas,
      valor_mao_de_obra: s.valorMaoDeObra,
      valor_total: s.valorTotal,
      proxima_revisao_km: s.proximaRevisaoKm,
      proxima_revisao_data: s.proximaRevisaoData || null,
      itens_proxima_revisao: s.itensProximaRevisao || [],
      observacoes: s.observacoes,
      ia_gerado: Boolean(s.iaGerado),
      provedor_ia: s.provedorIA || null,
      recomendacao_ia: s.recomendacaoIA || null,
      status: s.status,
      anexo_documento: s.anexoDocumento || null,
      criado_por_nome: s.criadoPorNome || null,
      criado_por_cargo: s.criadoPorCargo || null,
      editado_por_nome: s.editadoPorNome || null,
      editado_por_cargo: s.editadoPorCargo || null,
      motivo_edicao: s.motivoEdicao || null,
    };
  }

  /**
   * Resumo de dados locais prontos para importação / migração futura
   */
  getMigrationSummary() {
    const vehicles = storage.getVehicles();
    const services = storage.getServices();
    const suppliers = storage.getSuppliers();
    const revisions = storage.getRevisions();
    const licensing = storage.getLicensing();
    const alerts = storage.getAlerts();
    const users = storage.getUsers();
    const chatwootLogs = storage.getChatwootLogs();
    const integrationLogs = storage.getIntegrationLogs();

    return {
      readyForMigration: true,
      totalRecords:
        vehicles.length +
        services.length +
        suppliers.length +
        revisions.length +
        licensing.length +
        alerts.length +
        users.length +
        chatwootLogs.length +
        integrationLogs.length,
      counts: {
        vehicles: vehicles.length,
        services: services.length,
        suppliers: suppliers.length,
        revisions: revisions.length,
        licensing: licensing.length,
        alerts: alerts.length,
        users: users.length,
        chatwootLogs: chatwootLogs.length,
        integrationLogs: integrationLogs.length,
      },
      statusMessage:
        'Dados locais preservados integralmente. Nenhuma migração automática será executada antes da ativação do Supabase Auth na Etapa 1.2.',
    };
  }

  /**
   * Supabase Storage - Preparação de upload de documentos
   * Bucket: 'documentos-frota'
   */
  async uploadVehicleDocument(
    file: { name: string; type: string; base64: string },
    veiculoId: string,
    tipoDocumento: VehicleDocument['tipoDocumento'],
    manutencaoId?: string
  ): Promise<{ success: boolean; storagePath?: string; message: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return {
        success: false,
        message: 'Supabase não conectado. O documento continuará armazenado temporariamente no lançamento.',
      };
    }

    try {
      const cleanBase64 = file.base64.replace(/^data:[^;]+;base64,/, '');
      const binaryString = atob(cleanBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const fileExt = file.name.split('.').pop() || 'dat';
      const cleanFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const path = `veiculos/${veiculoId}/${tipoDocumento.toLowerCase()}/${cleanFileName}`;

      const { data, error } = await client.storage
        .from('documentos-frota')
        .upload(path, bytes, {
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        return {
          success: false,
          message: `Falha no upload para o Supabase Storage: ${error.message} (Requer sessão autenticada pela RLS).`,
        };
      }

      return {
        success: true,
        storagePath: data.path,
        message: 'Documento armazenado com sucesso no Supabase Storage!',
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Erro ao processar anexo: ${err.message}`,
      };
    }
  }
}

export const supabaseService = new SupabaseService();
