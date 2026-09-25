# 05 — Roadmap

Sprints de ~2 semanas no seu ritmo. Ajuste à vontade, mas **não pule a Fase 0**.

## Fase 0 — Validação (antes de codar telas)

- [x] Passar 1–2 dias numa oficina conhecida observando: entrada do carro, anotações, contato com cliente, orçamento, entrega. (24/09/2026, ver `docs/validacao/2026-09-24-visitas.md`)
- [x] Anotar: quem vai operar o sistema, que celular usam, se tem computador no balcão, como é a internet.
- [ ] Mostrar o sistema real (Sprint 5) para 3–5 oficinas.
- [x] Confirmar os status do kanban e os itens do checklist com eles.
- [ ] Fechar 3 oficinas piloto.

## Fase 1 — MVP

Ordem revisada em 24/09/2026: o pátio e o acompanhamento do cliente (as dores confirmadas nas visitas) vêm antes do orçamento, para ter algo real para mostrar às oficinas ao fim da Sprint 5.

| Sprint | Entrega |
|---|---|
| **1. Fundação** | Monorepo, Docker Compose (Postgres + MinIO), NestJS + Prisma, React + Vite + Tailwind, CI (lint + testes), tenant context + extensão Prisma com teste de isolamento |
| **2. Auth e oficina** | Cadastro da oficina, login, refresh token, convite de funcionários, perfis `DONO`/`FUNCIONARIO` (Épico A) |
| **3. OS rápida** | Abertura de OS com placa + WhatsApp + queixa, criando ou reaproveitando cliente e veículo; busca por placa/nome/telefone; comentários e eventos (Épico B + C1 + C3 sem fotos) |
| **4. Quadro do pátio** | Lista mobile por status com "avançar" em 1 toque, kanban desktop, filtros, tempo na etapa (Épico D) |
| **5. Portal do cliente v1** | PWA `/c/:token`, oficina identificada, linha do tempo, prévia do link no WhatsApp, "Avisar cliente" (Épico F1, F2, F4 + G1). **Marco: mostrar às oficinas** |
| **6. Fotos e entrada** | Upload R2, fotos na OS e no portal, registro de entrada opcional (Épico C2 + fotos do C3) |
| **7. Orçamento** | Itens, versões, envio pelo link, aprovação item a item pelo cliente, histórico no portal, aviso na oficina (Épico E + F3 + G2) |
| **8. Polimento e piloto** | Deploy de produção, domínio, backup, termos/LGPD, onboarding das oficinas piloto, correções |

**Marco final:** 3 oficinas usando no dia a dia por 30 dias.

## Fase 2 — Plano Plus (estoque)

- Cadastro de peças, entrada/saída, estoque mínimo
- Item do orçamento puxando do estoque e baixa automática na entrega
- Cadastro de fornecedores + **cotação enviada por WhatsApp/e-mail** para vários fornecedores (sem integração ainda)
- Lembretes de revisão (por data/km) com botão de envio pelo WhatsApp

## Fase 3 — Plano Ultra (financeiro)

- Pagamentos da OS (Pix, cartão, dinheiro, parcelado), contas a receber
- Emissão de NFS-e/NF-e via API terceirizada (Focus NFe, PlugNotas, eNotas...)
- Relatórios: faturamento, ticket médio, serviços mais feitos, tempo médio por etapa
- Cobrança da assinatura (Asaas, Stripe, Mercado Pago...)

## Fase 4 — Escala e canal

- API oficial do WhatsApp (notificações automáticas)
- Push notification no PWA
- Consulta de placa automática
- Agendamento online pelo cliente
- Avaliação pós-serviço + link para o Google

## Fase 5 — Ecossistema

- App nativo do cliente (React Native / Expo)
- Histórico universal do veículo com consentimento (`ContaCliente`, `VeiculoGlobal`)
- Marketplace/destaque de fornecedores
- Plano pago do usuário final (diagnóstico, alertas, indicações)
- IA: orçamento a partir de áudio do mecânico, sugestão de peças pelo diagnóstico
