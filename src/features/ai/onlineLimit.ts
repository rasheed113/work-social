/** The authoritative online-limit contract emitted by work-social-ai. */
export const GEMINI_RATE_LIMIT_CODE = 'GEMINI_RATE_LIMIT';

export function isGeminiRateLimitErrorMessage(message: string): boolean {
  return message.includes(`server ${GEMINI_RATE_LIMIT_CODE}`);
}

export function shouldOfferOfflineContinuation(message: string): boolean {
  return isGeminiRateLimitErrorMessage(message);
}
