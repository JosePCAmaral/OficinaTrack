# Roteiro de visita à oficina (Fase 0)

Objetivo: entender como a oficina trabalha **hoje**, antes de mostrar qualquer tela.
As respostas confirmam (ou derrubam) decisões do `02-escopo-mvp.md`.

## Como conduzir

- **Primeiro observe, depois pergunte, só no fim mostre.** Se mostrar o sistema antes, a pessoa passa a opinar sobre a tela e não conta como trabalha.
- Pergunte sobre **o que aconteceu**, não sobre o que a pessoa faria. "Me conta o último carro que ficou parado esperando aprovação" vale mais que "você usaria um link de aprovação?".
- Elogio não é validação ("que legal, faria sim"). Validação é compromisso: topar ser piloto, indicar outra oficina, mostrar o caderno de verdade.
- Peça para ver os papéis, o caderno, as conversas de WhatsApp com cliente (sem dados pessoais) e tire foto do quadro ou da ficha, se deixarem.
- Anote as frases exatas. A linguagem deles vira o texto das telas.

## 1. Observação (sem perguntar nada)

Anote durante algumas horas:

- [ ] Como um carro **chega**: quem recebe, o que anota, onde anota, quanto tempo leva.
- [ ] Quantos carros estão no pátio agora e como alguém sabe a situação de cada um.
- [ ] Quantas vezes o telefone ou o WhatsApp toca, e quem atende (o mecânico para o serviço para atender?).
- [ ] Como o orçamento é passado ao cliente (ligação, áudio, texto, foto do papel?).
- [ ] Quanto tempo um carro fica parado esperando resposta do cliente ou peça.
- [ ] Como é feita a entrega: quem avisa que ficou pronto, como cobra.
- [ ] Equipamento: computador no balcão? Que celular cada um usa? Tem Wi-Fi? Sinal 4G bom dentro da oficina?
- [ ] O mecânico mexe no celular durante o serviço? Com a mão suja ou limpa?

## 2. Perguntas para o dono

**Rotina e dor**
1. Quantos carros entram por semana? Quantos ficam no pátio ao mesmo tempo?
2. Me conta o último carro que deu problema (atraso, briga por preço, cliente reclamando). O que aconteceu?
3. Como você sabe hoje em que pé está cada carro? Já esqueceu algum?
4. Qual a parte do dia que mais toma seu tempo e não é mexer em carro?
5. Já perdeu serviço ou cliente por demora em responder ou aprovar orçamento? Quantas vezes no último mês?

**Ferramentas atuais**
6. O que vocês usam hoje para anotar (caderno, planilha, sistema, WhatsApp)? Já usaram algum sistema? Por que pararam?
7. O que faria você largar um sistema na primeira semana?

**Equipe (quem vai operar)**
8. Quem trabalha aqui e o que cada um faz? Quem atende cliente?
9. Quem você imagina abrindo a OS e atualizando o status: você, o atendente ou o mecânico?
10. Os mecânicos têm celular próprio? Usariam para o trabalho?

**Dinheiro**
11. Quanto vocês pagam hoje por mês em ferramentas ou serviços (contador, sistema, internet)?
12. O que é mais urgente para você: controlar o pátio, falar com o cliente, estoque de peças ou financeiro?
13. Se isso resolvesse [a dor que ele contou], quanto faria sentido pagar por mês? (anote o valor sem sugerir faixa)

## 3. Perguntas para o atendente (ou quem fica no balcão)

1. Me mostra como você anota um carro que acabou de chegar. O que você pergunta ao cliente?
2. Quais dados do cliente vocês guardam? Pedem CPF? E-mail?
3. Como o cliente fica sabendo que o carro está pronto?
4. Quantas vezes por dia um cliente liga perguntando "e o meu carro?"
5. Como você manda o orçamento? O cliente responde rápido? Aprova tudo ou só parte?
6. Já teve cliente dizendo "eu não autorizei esse serviço"? Como resolveram?

## 4. Perguntas para o mecânico

1. Quando você acha um problema novo no carro, o que acontece até poder continuar?
2. Você tira foto do que encontra? Manda para quem?
3. Quando o carro chega, você confere alguma coisa (combustível, km, riscos, estepe)? Anota onde?
4. Se tivesse que atualizar a situação do carro no celular, quantos toques aguentaria dar? (resposta real importa mais que a educada)

## 5. Perguntas para 2 ou 3 clientes da oficina (se possível)

1. Como você fica sabendo do andamento do seu carro?
2. Já ficou sem saber o que estava acontecendo? O que fez?
3. Você confia no orçamento que recebe? O que te deixaria mais seguro (foto da peça, lista detalhada)?
4. Se recebesse um link no WhatsApp da oficina, você abriria? Teria receio de golpe?

## 6. Decisões do MVP para confirmar

Marque o que foi confirmado ou o que mudou:

- [ ] **Status do kanban:** Triagem → Diagnóstico → Aguardando aprovação → Aguardando peça → Em execução → Pronto → Entregue. Faltou ou sobrou alguma etapa? Que nomes eles usam?
- [ ] **Itens do checklist de entrada:** combustível, km, estepe, macaco, som, documentos, avarias. O que mais eles conferem?
- [ ] **Orçamento item a item:** o cliente costuma aprovar parte do orçamento? Separam peça e mão de obra?
- [ ] **Quem opera no celular:** mecânico, atendente ou só o dono?
- [ ] **Link pelo WhatsApp:** o cliente abriria? A oficina manda do número pessoal ou de um número da oficina?
- [ ] **Fotos:** tirar foto no recebimento e no diagnóstico é viável na rotina?
- [ ] **Abrir OS em menos de 1 minuto:** quais campos são realmente obrigatórios na chegada?
- [ ] **Prioridade:** estoque e financeiro (fora do MVP) são decisivos para eles pagarem?

## 7. Fechamento (só no fim)

1. Mostre o protótipo ou o sistema, se tiver. Observe onde a pessoa trava, sem explicar.
2. "Se eu deixar vocês usarem de graça por 3 meses em troca de uma conversa por semana, topam?"
3. "Conhece outra oficina que tem esse mesmo problema?"

## Modelo de anotação

```
Oficina: ______________  Cidade: ________  Data: ___/___/____
Especialidade: ________  Nº de pessoas: ___  Carros/semana: ___
Quem operaria o sistema: ____________
Equipamento (celulares, PC, internet): ____________
3 maiores dores (com as palavras deles):
1.
2.
3.
Como fazem hoje (ferramentas):
Status reais do pátio:
Itens de checklist:
Disposição a pagar (valor citado): R$ ____
Topou ser piloto? ( ) sim ( ) talvez ( ) não  | Indicou outra oficina? ______
O que muda nos docs:
```

Depois de cada visita, atualize `docs/02-escopo-mvp.md` com o que mudou **antes** de implementar a sprint afetada.
