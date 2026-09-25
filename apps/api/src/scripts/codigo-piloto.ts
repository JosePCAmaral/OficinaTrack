import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { CodigosPilotoService } from '../modules/auth/codigos-piloto.service.js';

const descricao = process.argv.slice(2).join(' ').trim();
if (!descricao) {
  process.stderr.write('Uso: pnpm --filter @oficinatrack/api codigo-piloto "Oficina do Zé - Ribeirão do Pinhal"\n');
  process.exit(1);
}
const app = await NestFactory.createApplicationContext(AppModule, { logger: new Logger() });
try {
  const codigo = await app.get(CodigosPilotoService).gerar(descricao);
  // saída única do código em claro: o banco guarda só o hash
  process.stdout.write(`Código de piloto para "${descricao}": ${codigo}\nVálido por 30 dias, uso único.\n`);
} finally {
  await app.close();
}
