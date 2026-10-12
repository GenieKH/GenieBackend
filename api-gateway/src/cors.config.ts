import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * Browser origins allowed to call the API.
 *
 * - `CORS_ORIGINS` = comma-separated list of allowed origins.
 * - Not set, outside production: any origin (convenient for local web dev).
 * - Not set, in production: no browser origin. The mobile app is unaffected
 *   because native HTTP clients do not use CORS.
 */
export function buildCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
  const allowedOrigins = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const origin = allowedOrigins.length > 0 ? allowedOrigins : env.NODE_ENV !== 'production';

  return {
    origin,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Accept,Authorization',
  };
}
