import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.BET_SERVICE_PORT ?? 3002);

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
