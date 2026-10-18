# Sendero — estado atual (atualizado em 18/10/2026)

Leia junto com `CLAUDE.md` e `docs/dossie-sendero.md`. Este arquivo diz **o que já existe**, **como se trabalha** e **o que está na fila**.

## Como se trabalha neste projeto

- O usuário (Sidclay) não é desenvolvedor. Ele usa o app pelo iPhone, **instalado pela tela de início**. Explique onde tocar, passo a passo, em português.
- **Fluxo de entrega:**
  1. desenvolver no branch da sessão;
  2. rodar `npm run build && npm test && npx eslint app components lib tests worker`;
  3. abrir PR no GitHub;
  4. o **usuário faz o merge**;
  5. o Cloudflare Workers Builds publica sozinho a partir do `main`.
- **Banco D1 `sendero-discipular`** (id `8eecf873-d8f3-44ff-b72c-74d9d573dcd1`):
  - toda mudança é um novo arquivo em `migrations/` (hoje até `0018_jornada.sql`);
  - a migração é aplicada em produção pelo MCP da Cloudflare (`d1_database_query`), e o nome é registrado em `d1_migrations`;
  - nunca apagar dados sem perguntar.
- **Custo zero:**
  - só o plano gratuito da Cloudflare, sem IA paga;
  - Web Push é feito no próprio Worker (`lib/push.ts`, chaves VAPID guardadas no D1);
  - cron a cada 15 min (`wrangler.jsonc`).
- **Privacidade:**
  - tudo fica atrás de senha mais PIN (`worker/auth.ts`); o PIN tem **teclado próprio**, porque o teclado do iPhone às vezes não abre em apps instalados;
  - notificações nunca mostram conteúdo de reflexões.
- **Telas:**
  - folhas que sobem da base usam `components/app/Sheet.tsx` (que ignora o toque que a abriu);
  - telas de cliente não importam valores de `lib/db/*` (só tipos); rótulos compartilhados ficam em `lib/*-shared.ts`.
- **Testes:**
  - rodam o worker compilado com um D1 falso em `node:sqlite` (`tests/*.test.mjs`);
  - a falha de `book-index` exige PyMuPDF e é antiga.

## Módulos (rota → arquivos principais)

- **Início** `/inicio`:
  - tônica, anéis do dia, % de atendimento às reflexões com meta de 90%;
  - cartão da Jornada (trabalho do mês e etapa) e, no dia em que se chega a um marco, uma linha "Hoje, na jornada";
  - cards Escola e Mestre.
- **Jornada** `/jornada` (`components/jornada/JornadaScreen.tsx`, `lib/db/jornada.ts`, `lib/jornada-shared.ts`), no lugar do antigo "karma":
  - **um trabalho de um mito por mês**, em ordem fixa, aberto sozinho na primeira visita do mês (o primeiro, o Leão de Nemeia, começa no dia da primeira visita e vai até o fim daquele mês);
  - o mês atravessa as **7 etapas do herói** (Campbell), divididas pelos dias: o chamado (o monstro), o mestre (o conselho), o limiar, as provas, o abismo (a queda e a volta), o elixir e o retorno;
  - os textos são do usuário (`JourneyCycle`); quem fecha o trabalho é ele: "cumprido" ou "o monstro ainda vive" (o trabalho se repete no mês seguinte, se o mês novo ainda estiver em branco);
  - armas = práticas diárias da ED; quedas = 2+ dias sem prática da ED; os números aparecem só como "testemunhas";
  - **pedras do caminho**: reflexões, temas, sequências, Diários, horas cronometradas, água (marcos: reflexões 1 e a cada 100; Diário 1, 10, 25 e a cada 50; primeiro dia na meta de água);
  - o Percurso (mapa de calor, constância, força, mês contra mês, reflexões por mês) saiu do Início e fica no fim desta tela;
  - **os 10 mitos, em ordem** (76 meses no total, textos em `migrations/0018_jornada.sql`, editáveis no banco): Hércules (12 trabalhos), Ulisses (12 ilhas da Odisseia), Teseu (7), Rama (os 7 livros do Ramayana), Psiquê (4 tarefas), Perseu (6), Arjuna (Bhagavad Gita, 7), Gilgamesh (7), Jasão (7), Parsifal (7). Os significados são a leitura tradicional do mito; o usuário corrige com o que aprende na Escola. Novos mitos entram como novas linhas em `JourneyMyth`/`JourneyLabor`;
  - fonte dos títulos: Cormorant SC, servida pelo próprio app (`public/fonts`).
- **Refletir** `/refletir`: reflexões do ciclo, fila do mês com filtro do mês anterior, AD.
- **Hábitos** `/habitos` (`components/habitos/HabitsScreen.tsx`):
  - lista por período do dia, com horário e lembrete por hábito;
  - pontinhos de 7 dias e foguinho com cores por tempo de sequência (`lib/habit-streak.ts`);
  - água em copos, com meta pelo peso;
  - seção "Para viver · Bastião".
- **Praticar** `/praticar/[id]`:
  - Tratak, Asana (imagem do dia), formas geométricas, músicas;
  - a tela fica acesa durante o exercício (`lib/screen-awake.ts`).
- **Memorização** `/memorizar`: textos por linha (ler → iniciais → de cor), com as linhas já sabidas visíveis acima da nova; a tela fica acesa.
- **Leitura** `/leitura`: livros, apostilas, textos e leituras de aula com prazo; cronômetro; trechos que viram Memorização.
- **Escola** `/escola`:
  - **Bastião da semana** (nº, nome, lido, ideias-força, até 3 ideias "para viver" com check diário, reflexão), com arquivo e busca;
  - **aula do mês** (vivências com pontos e reflexões, Bastiões do período, "levar para a próxima aula").
  - As ideias também aparecem em Hábitos, no Início e no Diário (5ª pergunta).
- **Agenda** `/tarefas` (`components/agenda/*`, `lib/db/agenda.ts`):
  - Dia: atrasadas, tarefas do dia, agenda hora a hora com compromissos, tarefas com hora e hábitos com horário (verde = feito, vermelho = em aberto);
  - Semana;
  - Compras: lista simples;
  - adicionar falando ("amanhã 15h", `lib/quick-add.ts`).
- **Diário** `/diario`, **Mestre** `/mestre`, **Pendências do app** `/pendencias`, **Configurações** `/configuracoes` (lembretes).

## Fila (ordem combinada)

1. **Refino da Jornada** (depois de o usuário viver o primeiro mês):
   - pergunta do mês dentro do Diário ("como foi o confronto com o monstro hoje?");
   - escolher as armas de cada trabalho (hoje são todas as práticas diárias da ED);
   - editar os textos dos mitos pelo app;
   - um desenho próprio para cada trabalho (hoje: medalhão com o número romano).
2. **Caderno de anotações**, estilo OneNote:
   - cadernos → seções → páginas, editor TipTap, busca (FTS5 do D1), ligação com Leitura, Escola e Memorização;
   - maquete antes.
3. **Frases e passagens** (pode entrar no Caderno).
4. **Faxina do banco:** o usuário apaga no painel D1 as tabelas antigas (`ReferencePassageSearch`, `ReferenceWork`, `ExportLog`, `bkp20261017_*`, `BastiaoWeek`). É preciso passar o passo a passo.
5. **Por último:**
   - **Face ID** via passkeys/WebAuthn. Avisar que o iPhone permite o código do aparelho como alternativa, e quem souber o código abriria o app.
   - Skill de **fechamento do mês** ("o que preciso viver de diferente no próximo mês").
   - O **AD num Projeto do Claude** com os 7 livros.
   - **Conector MCP seguro** ao banco.
