import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Safe environment variable retrieval in Vite client environment
const ENV_SUPABASE_URL = (
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  ''
).trim();

const ENV_SUPABASE_ANON_KEY = (
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  ''
).trim();

let cachedClient: SupabaseClient | null = null;
let lastUsedUrl = '';
let lastUsedKey = '';

export interface SupabaseConfigInfo {
  url: string;
  hasAnonKey: boolean;
  isConfigured: boolean;
  source: 'env' | 'settings' | 'none';
}

/**
 * Validação de segurança: Impede estritamente o uso de service_role ou senhas no frontend
 */
export function validateSafeKey(key: string): { valid: boolean; error?: string } {
  if (!key) return { valid: false, error: 'Chave não informada.' };
  const lower = key.toLowerCase();
  if (lower.includes('service_role') || lower.includes('secret') || lower.includes('service-role')) {
    return {
      valid: false,
      error: 'SEGURANÇA: Chaves administrativas do tipo "service_role" NUNCA devem ser usadas no frontend. Utilize apenas a Anon / Publishable Key.',
    };
  }
  return { valid: true };
}

/**
 * Retorna as configurações ativas do Supabase
 */
export function getSupabaseConfig(runtimeUrl?: string, runtimeKey?: string): SupabaseConfigInfo {
  const activeUrl = (runtimeUrl || ENV_SUPABASE_URL || '').trim();
  const activeKey = (runtimeKey || ENV_SUPABASE_ANON_KEY || '').trim();

  const isConfigured = Boolean(
    activeUrl &&
    activeUrl.startsWith('https://') &&
    activeUrl.includes('.supabase.co') &&
    activeKey &&
    activeKey.length > 20
  );

  return {
    url: activeUrl,
    hasAnonKey: Boolean(activeKey && activeKey.length > 20),
    isConfigured,
    source: (ENV_SUPABASE_URL && ENV_SUPABASE_ANON_KEY) ? 'env' : runtimeUrl ? 'settings' : 'none',
  };
}

/**
 * Obtém ou cria o cliente Supabase singleton
 */
export function getSupabaseClient(runtimeUrl?: string, runtimeKey?: string): SupabaseClient | null {
  const config = getSupabaseConfig(runtimeUrl, runtimeKey);

  if (!config.isConfigured) {
    return null;
  }

  const activeUrl = config.url;
  const activeKey = (runtimeKey || ENV_SUPABASE_ANON_KEY || '').trim();

  const keyValidation = validateSafeKey(activeKey);
  if (!keyValidation.valid) {
    console.error(keyValidation.error);
    return null;
  }

  if (cachedClient && lastUsedUrl === activeUrl && lastUsedKey === activeKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(activeUrl, activeKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      db: {
        schema: 'public',
      },
    });

    lastUsedUrl = activeUrl;
    lastUsedKey = activeKey;

    return cachedClient;
  } catch (error) {
    console.error('Falha ao inicializar o cliente Supabase:', error);
    return null;
  }
}

/**
 * Verifica se o Supabase está operacionalmente configurado
 */
export function isSupabaseConfigured(runtimeUrl?: string, runtimeKey?: string): boolean {
  return getSupabaseConfig(runtimeUrl, runtimeKey).isConfigured;
}
