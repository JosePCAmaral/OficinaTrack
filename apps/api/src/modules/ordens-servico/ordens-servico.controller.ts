import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  abrirOsSchema, alterarOsSchema, consultaPlacaSchema, listarOsSchema, paginacaoSchema,
  type AbrirOs, type AlterarOs, type ConsultaPlaca, type DetalheOS, type ListarOs, type Pagina, type Paginacao, type ResumoOS,
} from '@oficinatrack/shared';
import { ZodValidationPipe } from '../../common/validacao/zod-validation.pipe.js';
import { ExigePermissao, UsuarioAtual, type UsuarioAutenticado } from '../auth/decorators.js';
import { OrdensServicoService } from './ordens-servico.service.js';

@ApiTags('ordens-servico')
@Controller('ordens-servico')
export class OrdensServicoController {
  constructor(private readonly os: OrdensServicoService) {}

  @Post()
  @HttpCode(201)
  @ExigePermissao('OS_GERENCIAR')
  abrir(@Body(new ZodValidationPipe(abrirOsSchema)) dados: AbrirOs, @UsuarioAtual() ator: UsuarioAutenticado): Promise<DetalheOS> {
    return this.os.abrir(dados, ator);
  }

  @Get()
  @ExigePermissao('OS_GERENCIAR')
  listar(@Query(new ZodValidationPipe(listarOsSchema)) { situacao: _situacao, ...p }: ListarOs): Promise<Pagina<ResumoOS>> {
    return this.os.listarAbertas(p);
  }

  @Get(':id')
  @ExigePermissao('OS_GERENCIAR')
  detalhe(@Param('id') id: string): Promise<DetalheOS> {
    return this.os.detalhe(id);
  }

  @Patch(':id')
  @ExigePermissao('OS_GERENCIAR')
  alterar(@Param('id') id: string, @Body(new ZodValidationPipe(alterarOsSchema)) dados: AlterarOs): Promise<DetalheOS> {
    return this.os.alterar(id, dados);
  }
}

/**
 * Rotas de OS penduradas em veículo e cliente. Ficam neste módulo (e não em `veiculos`/`clientes`)
 * porque precisam do `OrdensServicoService`, e `ordens-servico` já depende daqueles módulos.
 * `GET /veiculos/consulta` é estática: o `OrdensServicoModule` é registrado antes do
 * `VeiculosModule` no `AppModule`, então esta rota vem antes de `GET /veiculos/:id`
 * (e2e `consultar-os` prova que a consulta não cai na ficha).
 */
@ApiTags('ordens-servico')
@Controller()
export class HistoricoOsController {
  constructor(private readonly os: OrdensServicoService) {}

  // permissão OS_GERENCIAR: é a checagem do balcão antes de abrir a OS
  @Get('veiculos/consulta')
  @ExigePermissao('OS_GERENCIAR')
  consultarPlaca(@Query(new ZodValidationPipe(consultaPlacaSchema)) { placa }: { placa: string }): Promise<ConsultaPlaca> {
    return this.os.consultarPlaca(placa);
  }

  @Get('veiculos/:id/ordens-servico')
  @ExigePermissao('OS_GERENCIAR')
  porVeiculo(@Param('id') id: string, @Query(new ZodValidationPipe(paginacaoSchema)) p: Paginacao): Promise<Pagina<ResumoOS>> {
    return this.os.listarPorVeiculo(id, p);
  }

  @Get('clientes/:id/ordens-servico')
  @ExigePermissao('OS_GERENCIAR')
  porCliente(@Param('id') id: string, @Query(new ZodValidationPipe(paginacaoSchema)) p: Paginacao): Promise<Pagina<ResumoOS>> {
    return this.os.listarPorCliente(id, p);
  }
}
