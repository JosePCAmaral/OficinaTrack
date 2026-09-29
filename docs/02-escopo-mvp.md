# 02 — Escopo do MVP

Tudo que **não** está aqui fica fora do MVP. Na dúvida, fica fora.

> Revisado em 24/09/2026 após as visitas de validação (`docs/validacao/2026-09-24-visitas.md`).

## Quem opera o sistema

Na oficina pequena **não existe atendente**: o mecânico recebe o cliente, atende o celular (às vezes com a mão suja), passa o orçamento e avisa quando fica pronto. Por isso:

- O painel é desenhado **primeiro para o celular**. Computador no balcão é exceção.
- O maior risco de abandono é **dar trabalho** ("difícil de mexer, custar muito tempo para cadastrar e atualizar"). Toda tela deve pedir o mínimo de campos e de toques.

## Perfis de usuário

| Perfil | Onde usa | O que faz |
|---|---|---|
| **Dono** (`DONO`) | Celular + web | Tudo, incluindo usuários e configurações da oficina |
| **Funcionário** (`FUNCIONARIO`) | Celular | Toda a operação: clientes, veículos, OS, pátio, fotos, orçamentos, envio ao cliente |
| **Cliente final** | PWA pelo link | Acompanha, aprova/recusa orçamento, vê histórico |

## Status da OS (quadro do pátio)

```
TRIAGEM → DIAGNOSTICO → AGUARDANDO_APROVACAO → AGUARDANDO_PECA → EM_EXECUCAO → PRONTO → ENTREGUE
                                   ↘ CANCELADO (a partir de qualquer status antes de ENTREGUE)
```

Validado nas visitas ("está bom").

- A oficina pode pular etapas (ex.: TRIAGEM → EM_EXECUCAO numa troca de óleo).
- Mudar para a próxima etapa leva **1 toque** no celular.
- Toda mudança de status gera um `EventoOS` (linha do tempo).
- Enviar orçamento muda automaticamente para `AGUARDANDO_APROVACAO`.
- Quando o cliente responde, a OS volta para `DIAGNOSTICO` e o sistema avisa a oficina, que decide o próximo passo.

## Histórias de usuário

### Épico A — Conta e oficina

- **A1.** Como dono, quero criar a conta da minha oficina (nome, CNPJ/CPF opcional, telefone, endereço) para começar a usar. Cadastro **fechado durante o piloto**: exige um código de piloto gerado pelo administrador (`CADASTRO_EXIGE_CODIGO`, padrão `true`). Upload da logo fica para a Sprint 6.
- **A2.** Como dono, quero convidar funcionários (nome, e-mail obrigatório, telefone opcional, perfil) para que usem o sistema, com um botão para enviar o convite pelo WhatsApp.
- **A3.** Como usuário da oficina, quero fazer login com e-mail/telefone e senha e ficar logado no celular.

**Critérios:**
- E-mail entra no MVP como canal de autenticação: confirmação de e-mail no cadastro/convite, redefinição de senha e envio de convite são todos por e-mail (SMTP/Mailpit). SMS continua fora do MVP (interface sem implementação real). Trocar e-mail de uma conta existente fica fora da Sprint 2.
- **E-mail é obrigatório para todo usuário** (dono e funcionário); todo mundo redefine a própria senha por e-mail.
- **O dono só acessa o painel depois de confirmar o e-mail** (o funcionário entra com `emailConfirmadoEm` já preenchido pelo aceite do convite).
- Senha com hash (argon2id); JWT de acesso curto (15 min) + refresh token opaco rotativo em cookie; um usuário pertence a uma oficina no MVP; convite com token de uso único e expiração de 72 h.
- **Perfis com permissões:** `DONO` e `FUNCIONARIO`, com um mapa de permissões por perfil (não um `if perfil === ...` espalhado), para caber perfis futuros (`FINANCEIRO`, `PATIO`) sem mexer em telas e endpoints. Permissões finas por funcionário continuam fora do MVP.

### Épico B — Clientes e veículos

- **B1.** Como usuário da oficina, quero cadastrar um cliente só com o WhatsApp; o nome é opcional e pode ser completado depois.
- **B2.** Como usuário da oficina, quero cadastrar o veículo só pela placa e completar marca, modelo, ano, cor e km depois.
- **B3.** Como usuário da oficina, quero buscar por placa, nome ou telefone e ver o histórico **da minha oficina** para aquele carro.

**Critérios:** placa normalizada (maiúsculas, sem hífen, aceita padrão antigo e Mercosul); telefone em E.164 (+55...); CPF e e-mail opcionais (as oficinas só guardam o celular); placa e telefone já cadastrados na oficina são reaproveitados; **nunca** mostra dados de OS de outra oficina.

### Épico C — Ordem de serviço e checklist de entrada

- **C1.** Como usuário da oficina, quero abrir uma OS em menos de 1 minuto pelo celular informando só **placa, WhatsApp do cliente e queixa**. O sistema reaproveita ou cria o cliente e o veículo; o resto (km, responsável, previsão) é opcional. **Placa já cadastrada com outro cliente (D1):** a tela pergunta se o carro mudou de dono — sim, o veículo passa para o novo cliente (evento interno `VEICULO_TRANSFERIDO`); não, a OS fica em nome de quem trouxe e o veículo continua com o dono atual; em ambos os casos o cliente da OS é quem trouxe o carro. **Carro com OS já aberta (D4):** a tela avisa ("Este carro já está na OS #0012, aberta há 2 dias") e oferece abrir a existente ou criar uma nova mesmo assim — nunca bloqueia. *(D1/D4 implementados na Sprint 3.)*
- **C2.** Como usuário da oficina, quero, **se quiser**, registrar a entrada do carro: fotos primeiro e, opcionalmente, combustível, km, itens (estepe, macaco, som, documentos) e avarias.
- **C3.** Como usuário da oficina, quero registrar na OS anotações em duas áreas separadas: **Notas internas** (equipe, nunca vão ao portal) e **Atualizações para o cliente** (vão ao portal, com botão "Avisar no WhatsApp"). Uma atualização publicada por engano pode ser **retirada** do portal por quem escreveu ou pelo dono, sem apagar o registro interno (continua no histórico com `retiradoEm`/`retiradoPorId`). *(Implementado na Sprint 3, só o texto — fotos na anotação entram com o Épico C2 (Sprint 6).)*

**Critérios:** checklist de entrada nunca bloqueia a abertura da OS; fotos comprimidas no celular antes do upload (máx. ~1600px, JPEG ~0.7); upload direto para o storage via URL pré-assinada; número da OS sequencial **por oficina** (ex.: #0001); nota interna nunca fica visível ao cliente (nem por edição, nem por body malicioso); retirar uma atualização de outra pessoa exige `EQUIPE_GERENCIAR`.

### Épico D — Quadro do pátio

- **D1.** Como usuário da oficina, quero ver todos os carros em aberto por status, com placa, modelo, cliente, há quanto tempo está na etapa e o responsável.
- **D2.** Como usuário da oficina, quero mudar o status com um botão "avançar" (celular) ou arrastando o card (desktop).
- **D3.** Como dono, quero filtrar por responsável e ver destacados os carros parados há mais de X dias.

**Critérios:** no celular, lista agrupada por status (não kanban horizontal); avançar status em 1 toque, sem formulário.

### Épico E — Orçamento e aprovação

- **E1.** Como usuário da oficina, quero montar um orçamento com itens (tipo PEÇA ou MÃO DE OBRA, descrição, quantidade, valor unitário) e observações.
- **E2.** Como usuário da oficina, quero enviar o orçamento ao cliente: o sistema gera o link e abre o WhatsApp com a mensagem pronta (`wa.me`).
- **E3.** Como cliente, quero aprovar ou recusar **item a item** pelo link e confirmar.
- **E4.** Como usuário da oficina, quero ver na OS o que foi aprovado/recusado e quando, e poder criar uma nova versão do orçamento (ex.: achou outro problema).

**Critérios:**
- Valores em centavos (inteiro), nunca float.
- Orçamento enviado fica imutável (alterações = nova versão).
- **A aprovação é sempre feita pelo cliente, pelo link.** É a prova do que foi combinado ("o cliente acha que combinou uma coisa e no fim diz que era outra"). Mesmo quando o orçamento foi combinado pessoalmente ou por telefone, a oficina envia o link e o cliente confirma por ele. A oficina **não** pode marcar um orçamento como aprovado.
- A mensagem para o caso "combinado pessoalmente" é própria: "Confirme pelo link o que combinamos".
- A aprovação registra data/hora, IP e user-agent como evidência.

### Épico F — Acompanhamento do cliente (PWA)

- **F1.** Como cliente, quero abrir o link recebido no WhatsApp e ver meu carro sem criar conta nem senha.
- **F2.** Como cliente, quero ver a linha do tempo (status, fotos e comentários visíveis) e a etapa atual em destaque.
- **F3.** Como cliente, quero ver o histórico dos serviços anteriores do meu carro **naquela oficina** (no MVP).
- **F4.** Como cliente, quero botões para falar com a oficina no WhatsApp e ver o endereço.

**Critérios:**
- Link com token aleatório (≥ 32 bytes, guardado como hash no banco), escopado a um cliente de uma oficina, com expiração renovável; a oficina pode revogar/reenviar.
- PWA instalável, mas funciona 100% sem instalar.
- **Confiança no link:** o cliente só abre se souber de quem veio. A mensagem começa com o nome da oficina; a prévia do link no WhatsApp (Open Graph) mostra o nome e a logo da oficina; a primeira tela do portal mostra a oficina antes de qualquer outra coisa.

### Épico G — Notificações (MVP simples)

- **G1.** Como usuário da oficina, quero um botão "Avisar cliente" em qualquer evento, que abre o WhatsApp com texto pronto + link.
- **G2.** Como usuário da oficina, quero ver no painel quando um cliente aprovou/recusou um orçamento (badge + atualização ao focar a tela / polling).

Sem API oficial do WhatsApp no MVP (custo por mensagem). Sem push notification no MVP. O link sai do WhatsApp de quem clica, então funciona mesmo em oficina sem número próprio.

## Fora do MVP (explicitamente)

- Estoque, fornecedores e cotação (decisivo "para alguns" nas visitas; fica para o plano Plus)
- Financeiro, contas a receber, NFS-e/NF-e
- API oficial do WhatsApp, SMS, push
- App nativo (React Native)
- Histórico compartilhado entre oficinas e transferência de veículo
- Agendamento online, lembretes de revisão
- Multi-unidade (uma conta com várias oficinas)
- Consulta automática de placa (API paga)
- Permissões finas por funcionário (além de `DONO` e `FUNCIONARIO`)
- Trocar e-mail de uma conta existente; SMS real; login em dois fatores; login social; tela de administração de códigos de piloto; upload de logo da oficina (Sprint 6); criptografia campo a campo de CPF/CNPJ

## Definição de pronto (para cada história)

- Endpoint(s) com validação de entrada (schemas Zod de `packages/shared`) e testes do caso feliz e do isolamento entre oficinas.
- Tela funcionando em celular (360px) e desktop.
- Nenhuma query sem filtro `oficinaId` em tabelas da oficina.
- Estados de carregando, vazio e erro tratados.
