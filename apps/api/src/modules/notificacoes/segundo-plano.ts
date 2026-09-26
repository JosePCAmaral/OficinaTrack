import { Injectable, Logger } from '@nestjs/common';

/**
 * Trabalho que roda depois da resposta (gerar token e mandar e-mail em "esqueci a senha" e
 * "reenviar confirmação"): a resposta sai no mesmo tempo exista ou não a conta (auditoria #11).
 * As tarefas ficam registradas até terminar, para os testes poderem esperar por elas
 * (`EnvioEmailMemoria.aguardarPendentes()`); erro vira log só com `erro.name` (sem dados pessoais).
 */
@Injectable()
export class SegundoPlano {
  private readonly logger = new Logger(SegundoPlano.name);
  private readonly pendentes = new Set<Promise<void>>();

  executar(descricaoFalha: string, tarefa: () => Promise<void>): void {
    const promessa: Promise<void> = Promise.resolve()
      .then(tarefa)
      .catch((erro: unknown) => this.logger.error(`${descricaoFalha}: ${erro instanceof Error ? erro.name : 'erro desconhecido'}`))
      .finally(() => this.pendentes.delete(promessa));
    this.pendentes.add(promessa);
  }

  /** Espera todas as tarefas em andamento, inclusive as que surgirem enquanto espera. */
  async aguardar(): Promise<void> {
    while (this.pendentes.size > 0) await Promise.all(this.pendentes);
  }
}
