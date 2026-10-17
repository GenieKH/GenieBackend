import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Reject malformed bodies and drop any field a DTO does not declare.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // On SIGTERM (every deploy): finish what is running and close connections.
  app.enableShutdownHooks();

  // Internal service: it is only reached through the api-gateway, so no CORS.
  const port = process.env.PORT || 4001;
  // HOST=:: for private networks that only resolve to IPv6 (older Railway environments).
  await app.listen(port, process.env.HOST || '0.0.0.0');
}
bootstrap();
