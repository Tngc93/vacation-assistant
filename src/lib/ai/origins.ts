/**
 * API origins of the AI providers: the only places a user's key is sent, and the only third-party API origins
 * the Content-Security-Policy lets the page connect to. Kept import-free so next.config.ts can read it.
 */
export const AI_ORIGINS = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com",
  gemini: "https://generativelanguage.googleapis.com",
} as const;
