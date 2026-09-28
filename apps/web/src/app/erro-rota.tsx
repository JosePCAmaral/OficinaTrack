import { EstadoRota } from './estado-rota';

/** `errorElement`: evita a tela crua de erro do React Router quando algo quebra ao renderizar uma rota. */
export function ErroRota() {
  return <EstadoRota titulo="Algo deu errado" descricao="Não foi possível carregar esta página. Tente de novo." />;
}
