import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

const CHAVE_OFICINA = 'oficinaId';
const CHAVE_SEM_TENANT = 'semTenant';

export class TenantAusenteError extends Error {
  constructor(modelo: string, operacao: string) {
    super(`Consulta em ${modelo}.${operacao} sem oficina no contexto`);
    this.name = 'TenantAusenteError';
  }
}

export class TenantViolacaoError extends Error {
  constructor(modelo: string, operacao: string) {
    super(`${modelo}.${operacao} tentou gravar dados de outra oficina`);
    this.name = 'TenantViolacaoError';
  }
}

/**
 * Falha fechado (não aberto): um model que não está em `Oficina`, `MODELOS_COM_TENANT` nem
 * `MODELOS_GLOBAIS` (`apps/api/src/prisma/modelos-tenant.ts`) é tratado como erro de
 * configuração, nunca como "sem tenant, filtro desligado". Sem isso, esquecer de registrar um
 * model novo (com `oficinaId` opcional, ou relacionado a um model com tenant) faria a extensão
 * devolver dados de todas as oficinas silenciosamente.
 */
export class TenantModeloDesconhecidoError extends Error {
  constructor(modelo: string, operacao: string) {
    super(
      `${modelo}.${operacao}: model não registrado em MODELOS_COM_TENANT nem em MODELOS_GLOBAIS ` +
        '(apps/api/src/prisma/modelos-tenant.ts); a extensão de tenant não sabe se deve filtrar por oficina',
    );
    this.name = 'TenantModeloDesconhecidoError';
  }
}

@Injectable()
export class TenantContext {
  constructor(private readonly cls: ClsService) {}

  oficinaId(): string | undefined {
    return this.cls.isActive() ? this.cls.get<string | undefined>(CHAVE_OFICINA) : undefined;
  }

  oficinaIdAtual(): string {
    const oficinaId = this.oficinaId();
    if (!oficinaId) throw new TenantAusenteError('contexto', 'oficinaIdAtual');
    return oficinaId;
  }

  ignorandoTenant(): boolean {
    return this.cls.isActive() && this.cls.get<boolean | undefined>(CHAVE_SEM_TENANT) === true;
  }

  /**
   * Chamado pelo guard de autenticação com o `oficinaId` do JWT, uma vez por requisição.
   * Falha fechado: não pode ser usado dentro de `executarSemTenant` (o filtro continuaria
   * desligado) nem trocar uma oficina já definida. Para "entrar" numa oficina a partir de
   * um fluxo sem tenant (ex.: aceite de convite), use `executarComo`.
   */
  definirOficina(oficinaId: string): void {
    if (!this.cls.isActive()) throw new Error('definirOficina fora de um contexto CLS ativo');
    if (this.ignorandoTenant()) {
      throw new Error('definirOficina não pode ser chamado dentro de executarSemTenant; use executarComo');
    }
    const atual = this.oficinaId();
    if (atual === oficinaId) return;
    if (atual !== undefined) throw new Error('Oficina já definida neste contexto com outro valor');
    this.cls.set(CHAVE_OFICINA, oficinaId);
  }

  executarComo<T>(oficinaId: string, fn: () => Promise<T>): Promise<T> {
    // `await` aqui dentro (em vez de só repassar a Promise) é necessário: as operações
    // do Prisma são "thenables" preguiçosos que só executam de fato no `.then`/`await`.
    // Se devolvêssemos a Promise sem aguardar, a consulta rodaria fora do contexto do
    // AsyncLocalStorage (já fechado) e `tenant.oficinaId()` voltaria `undefined`.
    return this.cls.run(async () => {
      this.cls.set(CHAVE_SEM_TENANT, false);
      this.cls.set(CHAVE_OFICINA, oficinaId);
      return await fn();
    });
  }

  /**
   * Desliga o filtro de oficina. Uso restrito: login, refresh, aceite de convite,
   * portal por token (achar o registro pelo hash), seeds e testes.
   * Todo uso precisa de comentário justificando.
   */
  executarSemTenant<T>(fn: () => Promise<T>): Promise<T> {
    // Ver comentário em `executarComo` sobre o `await` interno.
    return this.cls.run(async () => {
      this.cls.set(CHAVE_OFICINA, undefined);
      this.cls.set(CHAVE_SEM_TENANT, true);
      return await fn();
    });
  }
}
