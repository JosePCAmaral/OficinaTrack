import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';
import { configurarApp } from './configurar-app.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  configurarApp(app);
  await app.listen(app.get(ConfigService<Env, true>).get('PORT', { infer: true }));
}
void bootstrap();
