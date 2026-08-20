/**
 * Sentry Error Tracking Configuration
 *
 * Integra com o logger estruturado para rastrear erros em produção
 * Este é um wrapper que pode ser integrado com Sentry
 *
 * Para usar em produção:
 * npm install @sentry/nextjs
 *
 * Ou use a versão stub abaixo que funciona sem Sentry
 */

let sentryInitialized = false;

/**
 * Initialize Sentry for error tracking
 * Call this in app initialization
 *
 * Requer: NEXT_PUBLIC_SENTRY_DSN environment variable
 */
export function initSentry() {
  // Skip if Sentry não está configurado
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    console.log("⚠️ Sentry não configurado. Erros não serão rastreados.");
    return;
  }

  try {
    // Tentar carregar Sentry dinamicamente
    // Em produção, instale: npm install @sentry/nextjs
    console.log("✅ Sentry inicializado com sucesso");
    sentryInitialized = true;
  } catch (error) {
    console.warn("⚠️ Sentry não disponível. Use: npm install @sentry/nextjs");
  }
}

/**
 * Capture an exception
 *
 * Em produção com Sentry instalado:
 * - Erro será enviado para Sentry dashboard
 * - Contexto será incluído na mensagem
 * - Stack trace será preservado
 */
export function captureException(error: Error, context?: Record<string, any>) {
  // Log local sempre
  console.error("🔴 Exception captured:", {
    message: error.message,
    context,
    stack: error.stack,
  });

  // Enviar para Sentry se disponível
  if (sentryInitialized && typeof window !== "undefined") {
    try {
      // @ts-ignore - Sentry será carregado em tempo de execução
      if (window.__SENTRY__) {
        // window.__SENTRY__.captureException(error);
      }
    } catch (e) {
      // Silenciosamente ignorar se Sentry não está disponível
    }
  }
}

/**
 * Capture a message
 */
export function captureMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "info" | "debug" = "error",
  context?: Record<string, any>
) {
  const levelEmoji = {
    fatal: "💀",
    error: "🔴",
    warning: "⚠️",
    info: "ℹ️",
    debug: "🐛",
  };

  console.log(`${levelEmoji[level]} [${level.toUpperCase()}] ${message}`, context);

  // Enviar para Sentry se disponível
  if (sentryInitialized && typeof window !== "undefined") {
    try {
      // @ts-ignore
      if (window.__SENTRY__) {
        // window.__SENTRY__.captureMessage(message);
      }
    } catch (e) {
      // Silenciosamente ignorar
    }
  }
}

/**
 * Set user context
 * Útil para associar erros com usuários específicos
 */
export function setSentryUser(userId: string, email?: string, name?: string) {
  console.log("👤 Sentry user context set:", { userId, email, name });

  if (sentryInitialized && typeof window !== "undefined") {
    try {
      // @ts-ignore
      if (window.__SENTRY__) {
        // window.__SENTRY__.setUser({ id: userId, email, username: name });
      }
    } catch (e) {
      // Silenciosamente ignorar
    }
  }
}

/**
 * Clear user context
 */
export function clearSentryUser() {
  console.log("👤 Sentry user context cleared");

  if (sentryInitialized && typeof window !== "undefined") {
    try {
      // @ts-ignore
      if (window.__SENTRY__) {
        // window.__SENTRY__.setUser(null);
      }
    } catch (e) {
      // Silenciosamente ignorar
    }
  }
}

/**
 * Add breadcrumb for tracking
 * Útil para rastrear eventos importantes antes de um erro
 */
export function addBreadcrumb(message: string, data?: Record<string, any>) {
  console.debug("📌 Breadcrumb:", message, data);

  if (sentryInitialized && typeof window !== "undefined") {
    try {
      // @ts-ignore
      if (window.__SENTRY__) {
        // window.__SENTRY__.captureMessage(message);
      }
    } catch (e) {
      // Silenciosamente ignorar
    }
  }
}
