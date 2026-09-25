import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../../config/env.js';
import { OficinasModule } from '../oficinas/oficinas.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AutenticacaoGuard } from './autenticacao.guard.js';
import { CadastroService } from './cadastro.service.js';
import { CodigosPilotoService } from './codigos-piloto.service.js';
import { LimiteTentativasService } from './limite-tentativas.service.js';
import { PermissaoGuard } from './permissao.guard.js';
import { SessoesService } from './sessoes.service.js';
import { TokensUsuarioService } from './tokens-usuario.service.js';

@Module({
  imports: [
    UsuariosModule,
    OficinasModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SEGREDO', { infer: true }),
        signOptions: { expiresIn: '15m', algorithm: 'HS256' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessoesService,
    LimiteTentativasService,
    CadastroService,
    TokensUsuarioService,
    CodigosPilotoService,
    { provide: APP_GUARD, useClass: AutenticacaoGuard },
    { provide: APP_GUARD, useClass: PermissaoGuard },
  ],
  exports: [SessoesService, AuthService, TokensUsuarioService, CodigosPilotoService],
})
export class AuthModule {}
