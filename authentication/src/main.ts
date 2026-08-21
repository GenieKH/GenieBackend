import "reflect-metadata";
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS to allow the Flutter Web app to talk to the backend
  app.enableCors();
  
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  const config = new DocumentBuilder()
    .setTitle('Genie Backend API')
    .setDescription('API documentation for the Genie Backend Service')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  
  const rawPort = (process.env.PORT ?? "").trim();
  const parsedPort = rawPort.length > 0 ? Number(rawPort) : Number.NaN;
  const port =
    Number.isFinite(parsedPort) && parsedPort >= 0 && parsedPort <= 65535 ? parsedPort : 3000;
  await app.listen(port, "0.0.0.0");
  console.log(`Server running at http://localhost:${port}`);
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
