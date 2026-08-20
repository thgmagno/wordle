/**
 * Sistema de Logging Estruturado
 *
 * Fornece logs estruturados para:
 * - Erros de aplicação
 * - Eventos de segurança
 * - Performance metrics
 * - User actions
 *
 * Em produção, enviar para Sentry ou LogRocket
 */

type LogLevel = "debug" | "info" | "warn" | "error";
type LogCategory =
  | "auth"
  | "game"
  | "room"
  | "word"
  | "security"
  | "performance"
  | "error"
  | "realtime";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: Record<string, any>;
  userId?: string;
  error?: {
    message: string;
    stack?: string;
  };
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";

  /**
   * Log de debug (apenas desenvolvimento)
   */
  debug(
    category: LogCategory,
    message: string,
    data?: Record<string, any>
  ) {
    if (this.isDevelopment) {
      this.log("debug", category, message, data);
    }
  }

  /**
   * Log informativo
   */
  info(
    category: LogCategory,
    message: string,
    data?: Record<string, any>,
    userId?: string
  ) {
    this.log("info", category, message, data, userId);
  }

  /**
   * Log de aviso
   */
  warn(
    category: LogCategory,
    message: string,
    data?: Record<string, any>,
    userId?: string
  ) {
    this.log("warn", category, message, data, userId);
  }

  /**
   * Log de erro
   */
  error(
    category: LogCategory,
    message: string,
    error?: Error,
    data?: Record<string, any>,
    userId?: string
  ) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "error",
      category,
      message,
      data,
      userId,
    };

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
      };
    }

    this.sendLog(entry);
    console.error(
      `[${category.toUpperCase()}] ${message}`,
      error || data || ""
    );
  }

  /**
   * Implementação base de log
   */
  private log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: Record<string, any>,
    userId?: string
  ) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      userId,
    };

    this.sendLog(entry);

    // Imprimir no console em desenvolvimento
    if (this.isDevelopment) {
      const prefix = `[${category.toUpperCase()}]`;
      const color = {
        debug: "\x1b[36m", // Cyan
        info: "\x1b[32m", // Green
        warn: "\x1b[33m", // Yellow
        error: "\x1b[31m", // Red
      }[level];
      const reset = "\x1b[0m";

      console.log(
        `${color}${prefix}${reset} ${message}`,
        data ? data : ""
      );
    }
  }

  /**
   * Enviar log para serviço externo
   * Em produção, enviar para Sentry, DataDog, CloudWatch, etc.
   */
  private sendLog(entry: LogEntry) {
    // TODO: Integrar com Sentry
    // TODO: Integrar com LogRocket
    // TODO: Integrar com CloudWatch

    // Atualmente apenas log local
    // Em produção:
    // sentry.captureMessage(entry.message, entry.level);
    // logRocket.log(entry);
  }
}

export const logger = new Logger();

/**
 * Exemplos de uso:
 *
 * logger.info("auth", "Usuário fez login", { userId: "123" });
 * logger.warn("security", "Múltiplas tentativas de login falhadas", { ip: "192.168.1.1" });
 * logger.error("game", "Erro ao processar tentativa", error, { gameId: "xyz" });
 *
 * logger.info("performance", "Query lenta detectada", {
 *   query: "select * from words",
 *   duration: 1234
 * });
 *
 * logger.warn("security", "Palavra bloqueada foi tentada", {
 *   word: "inapropriada",
 *   userId: "123",
 *   ip: "192.168.1.1"
 * });
 */
