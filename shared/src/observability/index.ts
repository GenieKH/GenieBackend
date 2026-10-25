/**
 * Error reporting, reached as `@genie/shared/sentry`: light enough for the
 * gateway, and loadable before anything else in each `main.ts`.
 */
export { initSentry, withoutSecrets } from './sentry';
export { SentryErrorsModule } from './sentry-errors.module';
