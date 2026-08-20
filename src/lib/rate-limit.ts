/**
 * Sistema de Rate Limiting
 *
 * Protege contra:
 * - Força bruta em autenticação
 * - Spam de submissão de palavras
 * - DDoS de tentativas
 * - Flood de Socket.io
 */

import { headers } from "next/headers";

interface RateLimitConfig {
  windowMs: number; // Janela de tempo em ms
  maxRequests: number; // Max requisições por janela
  message: string; // Mensagem de erro
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Store em-memória (simples, funciona bem para single-server)
// Em produção com múltiplos servidores, usar Redis
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Obter IP do cliente (compatível com proxies como Vercel)
 */
async function getClientIp(): Promise<string> {
  try {
    const headersList = await headers();

    // Tentar diferentes headers comuns
    const forwarded = headersList.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }

    const realIp = headersList.get("x-real-ip");
    if (realIp) {
      return realIp;
    }
  } catch {
    // headers() pode não estar disponível em contextos não-request
  }

  // Fallback
  return "unknown";
}

/**
 * Verificar se requisição está dentro do limite
 */
export function isRateLimited(
  key: string,
  config: RateLimitConfig
): { limited: boolean; remainingTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Limpar entrada expirada
  if (entry && entry.resetTime <= now) {
    rateLimitStore.delete(key);
    return { limited: false, remainingTime: 0 };
  }

  // Primeira requisição
  if (!entry) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return { limited: false, remainingTime: 0 };
  }

  // Incrementar contador
  entry.count++;

  // Verificar limite
  if (entry.count > config.maxRequests) {
    const remainingTime = entry.resetTime - now;
    return { limited: true, remainingTime };
  }

  return { limited: false, remainingTime: 0 };
}

/**
 * Middleware para Server Actions
 *
 * Uso:
 * export async function myServerAction() {
 *   const result = await checkRateLimit("my-action", {
 *     windowMs: 60000,
 *     maxRequests: 10,
 *     message: "Muitas tentativas. Aguarde 1 minuto."
 *   });
 *
 *   if (!result.allowed) {
 *     throw new Error(result.message);
 *   }
 *   // ... resto da ação
 * }
 */
export async function checkRateLimit(
  actionName: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; message?: string }> {
  const ip = await getClientIp();
  const key = `${ip}:${actionName}`;

  const { limited, remainingTime } = isRateLimited(key, config);

  if (limited) {
    const secondsRemaining = Math.ceil(remainingTime / 1000);
    return {
      allowed: false,
      message: `${config.message} (tente novamente em ${secondsRemaining}s)`,
    };
  }

  return { allowed: true };
}

/**
 * Configurações padrão para diferentes ações
 */
export const RATE_LIMIT_CONFIGS = {
  // Autenticação - proteção contra força bruta
  AUTH_LOGIN: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 5, // 5 tentativas
    message: "Muitas tentativas de login. Tente novamente em 15 minutos.",
  } as RateLimitConfig,

  // Submissão de palavra secreta
  WORD_SUBMISSION: {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 5,
    message: "Muitas submissões de palavras. Aguarde um pouco.",
  } as RateLimitConfig,

  // Tentativas de jogo
  GAME_ATTEMPT: {
    windowMs: 1000, // 1 segundo (previne flood)
    maxRequests: 1, // 1 por segundo
    message: "Aguarde antes de enviar outra tentativa.",
  } as RateLimitConfig,

  // Criação de sala
  ROOM_CREATION: {
    windowMs: 5 * 60 * 1000, // 5 minutos
    maxRequests: 3,
    message: "Limite de criação de salas atingido. Tente novamente em 5 minutos.",
  } as RateLimitConfig,

  // Início de partida solo — mais generoso que a criação de sala, já que
  // jogar várias partidas seguidas é o uso normal do modo solo.
  SINGLE_PLAYER_START: {
    windowMs: 5 * 60 * 1000, // 5 minutos
    maxRequests: 15,
    message: "Muitas partidas iniciadas. Aguarde um pouco.",
  } as RateLimitConfig,

  // Dica enviada pelo espectador (dono da palavra) durante uma rodada
  ROUND_HINT: {
    windowMs: 5 * 1000, // 5 segundos
    maxRequests: 1,
    message: "Aguarde antes de enviar outra dica.",
  } as RateLimitConfig,

  // Requisições gerais de API
  API_REQUEST: {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 60, // 60 por minuto = 1 por segundo
    message: "Muitas requisições. Aguarde um pouco.",
  } as RateLimitConfig,
};

/**
 * Limpador de entradas antigas (rodar periodicamente)
 * Evita que o Map cresça indefinidamente
 */
export function cleanupExpiredEntries() {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime <= now) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0 && process.env.NODE_ENV === "development") {
    console.log(`[Rate Limit] Limpas ${cleaned} entradas expiradas`);
  }
}

// Executar limpeza a cada 5 minutos. unref() so this background interval
// never keeps the process alive by itself — matters for the Next.js
// server (irrelevant there since the HTTP listener already does that) and
// for test runners, which would otherwise hang after the last test
// finishes just because this timer is still pending.
if (typeof global !== "undefined" && !global._rateLimitCleanupInterval) {
  global._rateLimitCleanupInterval = setInterval(
    cleanupExpiredEntries,
    5 * 60 * 1000
  );
  global._rateLimitCleanupInterval.unref?.();
}

declare global {
  var _rateLimitCleanupInterval: NodeJS.Timeout;
}
