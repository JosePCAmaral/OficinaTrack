import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import type { Env } from './config/env.js';
import { FiltroErros } from './common/erros/filtro-erros.js';

/**
 * O erro de corpo grande/malformado nasce no middleware de parsing do Express
 * (antes de chegar no pipeline do Nest), então o `FiltroErros` não o vê.
 * Este middleware traduz esses erros para o formato padrão de erro da API.
 */
function tratarErroDeBodyParser(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (err && typeof err === 'object' && 'type' in err) {
    if (err.type === 'entity.too.large') {
      res.status(413).json({ statusCode: 413, code: 'CORPO_MUITO_GRANDE', message: 'Requisição muito grande' });
      return;
    }
    if (err.type === 'entity.parse.failed') {
      res.status(400).json({ statusCode: 400, code: 'REQUISICAO_INVALIDA', message: 'Requisição inválida' });
      return;
    }
  }
  next(err);
}

export function configurarApp(app: INestApplication): void {
  const config = app.get(ConfigService<Env, true>);
  const express = app as NestExpressApplication;

  express.use(helmet());
  express.useBodyParser('json', { limit: '100kb' });
  express.use(tratarErroDeBodyParser);
  express.enableCors({ origin: config.get('CORS_ORIGEM', { infer: true }), credentials: true });
  express.setGlobalPrefix('api/v1');
  express.useGlobalFilters(new FiltroErros());
  express.enableShutdownHooks();

  // opt-in: só em development. Um deploy sem NODE_ENV, ou com test/staging, não publica a doc.
  if (config.get('NODE_ENV', { infer: true }) === 'development') {
    const doc = SwaggerModule.createDocument(
      express,
      new DocumentBuilder().setTitle('OficinaTrack API').setVersion('1').build(),
    );
    SwaggerModule.setup('api/docs', express, doc);
  }
}
