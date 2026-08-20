/**
 * Exemplos de como usar o sistema de Rate Limiting
 *
 * Integrar estas verificações em src/server/room-actions.ts,
 * src/server/game-actions.ts, etc.
 */

import { checkRateLimit, RATE_LIMIT_CONFIGS } from "./rate-limit";

/**
 * Exemplo 1: Proteger submissão de palavra secreta
 *
 * Em src/server/room-actions.ts:
 *
 * export async function submitWord(
 *   roomId: string,
 *   userId: string,
 *   word: string
 * ) {
 *   // ⬇️ ADICIONAR ESTA VERIFICAÇÃO
 *   const rateLimit = await checkRateLimit(
 *     `submit-word-${userId}`,
 *     RATE_LIMIT_CONFIGS.WORD_SUBMISSION
 *   );
 *
 *   if (!rateLimit.allowed) {
 *     return {
 *       success: false,
 *       error: rateLimit.message || "Limite de requisições atingido"
 *     };
 *   }
 *   // ⬆️ FIM DA ADIÇÃO
 *
 *   // ... resto do código
 * }
 */

/**
 * Exemplo 2: Proteger tentativas de jogo
 *
 * Em src/server/game-actions.ts:
 *
 * export async function submitAttempt(
 *   roundId: string,
 *   userId: string,
 *   attemptWord: string
 * ) {
 *   // ⬇️ ADICIONAR ESTA VERIFICAÇÃO
 *   const rateLimit = await checkRateLimit(
 *     `game-attempt-${userId}`,
 *     RATE_LIMIT_CONFIGS.GAME_ATTEMPT
 *   );
 *
 *   if (!rateLimit.allowed) {
 *     return {
 *       success: false,
 *       error: rateLimit.message || "Aguarde antes de enviar outra tentativa"
 *     };
 *   }
 *   // ⬆️ FIM DA ADIÇÃO
 *
 *   // ... resto do código
 * }
 */

/**
 * Exemplo 3: Proteger criação de salas
 *
 * Em src/server/room-actions.ts:
 *
 * export async function createRoom(
 *   hostId: string,
 *   wordLength: number
 * ) {
 *   // ⬇️ ADICIONAR ESTA VERIFICAÇÃO
 *   const rateLimit = await checkRateLimit(
 *     `create-room-${hostId}`,
 *     RATE_LIMIT_CONFIGS.ROOM_CREATION
 *   );
 *
 *   if (!rateLimit.allowed) {
 *     return {
 *       success: false,
 *       error: rateLimit.message || "Limite de criação de salas atingido"
 *     };
 *   }
 *   // ⬆️ FIM DA ADIÇÃO
 *
 *   // ... resto do código
 * }
 */

/**
 * Exemplo 4: Criar limite customizado
 *
 * import { checkRateLimit } from "./rate-limit";
 *
 * const customConfig = {
 *   windowMs: 60000,      // 1 minuto
 *   maxRequests: 20,      // 20 requisições
 *   message: "Muito rápido!"
 * };
 *
 * const result = await checkRateLimit("my-action", customConfig);
 * if (!result.allowed) {
 *   throw new Error(result.message);
 * }
 */

// ✅ Próximo passo: Integrar estas verificações nos Server Actions
