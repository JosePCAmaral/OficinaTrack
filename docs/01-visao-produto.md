# 01 — Visão do Produto

> Nome provisório: **OficinaTrack**. Troque à vontade.

## Problema

Oficinas pequenas e médias do interior (elétrica, mecânica, modificação, funilaria) operam com boca a boca, WhatsApp, papel e caneta.

- **A oficina** perde o controle de quais carros estão no pátio, em que etapa estão e o que está travando (aprovação do cliente, peça).
- **O cliente** não sabe o que está acontecendo com o carro. Liga, ninguém atende, e ele desconfia do orçamento.
- **O orçamento** trava o carro no box: o mecânico acha um problema e fica esperando o cliente atender o telefone para aprovar.

## Solução (MVP)

Um sistema com dois lados:

1. **Painel da oficina** (web desktop + mobile responsivo): quadro do pátio (kanban), ordens de serviço, checklist de entrada com fotos, orçamento e atualizações para o cliente.
2. **Acompanhamento do cliente** (PWA mobile, sem senha, acessado por link enviado no WhatsApp): linha do tempo do carro com status e fotos, aprovação de orçamento item a item e histórico.

## Público-alvo inicial

- Oficinas com 1 a 10 pessoas que hoje não usam sistema nenhum.
- Região: Ribeirão do Pinhal (PR) e cidades vizinhas, depois o interior de SP.
- Especialidades: mecânica geral, elétrica e modificação/preparação.

## Diferenciais

1. **Transparência para o cliente final**: fotos, status em tempo real e aprovação pelo celular. É o que a oficina consegue *vender* para o cliente dela.
2. **Simplicidade radical**: abrir uma OS em menos de 1 minuto pelo celular. Quem opera tem mão suja e pouco tempo.
3. **WhatsApp como canal**: não brigamos com o WhatsApp, usamos ele para levar o cliente até o link.
4. **Histórico do veículo pertencente ao dono do carro** (visão de longo prazo): "ficha médica" do carro que acompanha o dono entre oficinas, **só com o consentimento dele**.

## Princípios do produto

- A oficina é a cliente pagante; o cliente final usa **sempre grátis**.
- **O dado de serviço pertence à oficina que fez.** Uma oficina nunca vê OS, preços ou observações de outra.
- **O histórico do carro pertence ao dono.** Ele vê tudo e decide se compartilha (LGPD: consentimento explícito).
- Mobile-first até no painel da oficina. Na oficina pequena não há atendente: o mecânico faz tudo pelo celular.
- **Dar trabalho mata o produto.** O principal motivo citado para largar um sistema é ser "difícil de mexer e custar muito tempo para cadastrar e atualizar". Menos campos e menos toques vencem funcionalidade.
- Cada funcionalidade nova precisa responder: "isso faz o carro sair mais rápido ou traz o cliente de volta?"

## Modelo de negócio

Assinatura mensal por oficina, em níveis (valores a validar com os pilotos).
Referência das visitas de 24/09/2026: **R$ 100 a 150/mês** para o Básico, vindo de oficinas que hoje não pagam nenhuma ferramenta (no máximo internet).

| Plano | Inclui |
|---|---|
| **Básico** | Pátio (kanban), OS, checklist com fotos, acompanhamento e aprovação pelo cliente |
| **Plus** | Básico + estoque de peças ligado à OS + cotação com fornecedores |
| **Ultra** | Plus + financeiro, NFS-e/NF-e e relatórios |

Futuro: plano pago para o usuário final (detecção de problemas, lembretes inteligentes, indicações) e anúncios/destaque pagos por fornecedores.

## Estratégia de validação

1. Passar 1 a 2 dias dentro de uma oficina observando o fluxo real **antes** de programar as telas.
2. 3 a 5 oficinas piloto usando de graça por 3 a 6 meses, em troca de feedback.
3. Métricas do piloto: nº de OS abertas por semana, % de orçamentos aprovados pelo link, tempo entre enviar e aprovar o orçamento, e se a oficina continua usando depois de 30 dias.
