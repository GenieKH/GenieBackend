import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableCors();
  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
