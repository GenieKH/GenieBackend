import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { buildCorsOptions } from './cors.config';

async function bootstrap() {
  // bodyParser is off: request bodies are streamed straight to the services.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  app.set('trust proxy', 1);
  app.use(helmet());
  // Gzips what the services answer (JSON listings shrink several times) for
  // clients that accept it. Small bodies are sent as they are; WebSocket
  // upgrades never pass through here.
  app.use(compression());
  app.enableCors(buildCorsOptions());
  app.enableShutdownHooks();

  await app.init();
  const server = app.getHttpServer();
  for (const proxy of app.get(AppModule).websocketProxies) {
    server.on('upgrade', proxy.upgrade);
  }

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
}
void bootstrap();
