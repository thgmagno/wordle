/**
 * Health Check Endpoint - Simple Version
 *
 * Retorna status básico da aplicação
 * Endpoint: GET /api/health
 *
 * Response:
 * {
 *   "status": "ok",
 *   "timestamp": "2026-08-20T10:30:45.123Z",
 *   "uptime": 3600,
 *   "environment": "production"
 * }
 */

import { NextResponse } from "next/server";

// Rastrear tempo de inicialização
const startTime = Date.now();

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    environment: process.env.NODE_ENV || "unknown",
  });
}

/**
 * Exemplo de resposta bem-sucedida:
 *
 * {
 *   "status": "healthy",
 *   "timestamp": "2026-08-20T10:30:45.123Z",
 *   "uptime": 3600,
 *   "services": {
 *     "database": {
 *       "status": "ok",
 *       "latency": 45
 *     },
 *     "api": {
 *       "status": "ok"
 *     }
 *   }
 * }
 *
 * Exemplo de resposta degradada (HTTP 503):
 *
 * {
 *   "status": "unhealthy",
 *   "timestamp": "2026-08-20T10:30:45.123Z",
 *   "uptime": 3600,
 *   "services": {
 *     "database": {
 *       "status": "error"
 *     },
 *     "api": {
 *       "status": "ok"
 *     }
 *   }
 * }
 */
