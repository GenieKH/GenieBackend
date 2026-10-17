import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { buildCorsOptions } from './cors.config';

async function bootstrap() {
  // bodyParser is off: request bodies are streamed straight to the services.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });

  app.set('trust proxy', 1);
  app.use(helmet());
  app.enableCors(buildCorsOptions());
  app.enableShutdownHooks();

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
