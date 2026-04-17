import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.SETTLEMENT_PORT ?? 3003);

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
