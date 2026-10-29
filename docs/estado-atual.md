# Sendero — estado atual (atualizado em 29/10/2026)

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
  - toda mudança é um novo arquivo em `migrations/` (hoje até `0022_caderno_sintese.sql`);
  - a migração é aplicada em produção pelo MCP da Cloudflare (`d1_database_query`), e o nome é registrado em `d1_migrations`;
  - nunca apagar dados sem perguntar.
- **Custo zero:**
  - só o plano gratuito da Cloudflare, sem IA paga;
  - Web Push é feito no próprio Worker (`lib/push.ts`, chaves VAPID guardadas no D1);
  - cron a cada 15 min (`wrangler.jsonc`).
- **Privacidade:**
  - tudo fica atrás de senha mais PIN (`worker/auth.ts`); o PIN tem **teclado próprio**, porque o teclado do iPhone às vezes não abre em apps instalados;
  - notificações nunca mostram conteúdo de reflexões.
- **Tela acesa ao escrever:** enquanto um campo de texto estiver com o cursor (Diário, reflexões, Caderno), `components/app/KeepAwake.tsx` segura a tela com o mesmo recurso das práticas (`lib/screen-awake.ts`: wake lock + vídeo mudo), digitando ou ditando (o ditado do iPhone quase não gera eventos de tecla). Volta a segurar quando o app é reaberto com o cursor num campo; solta 5 min depois de sair do campo, ou após 30 min sem escrever nada.
- **Pendências do app** têm "Copiar todas", para colar as abertas numa conversa.
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
  - **um trabalho de um mito por mês**, em ordem fixa, aberto sozinho na primeira visita do mês, sempre com o mês inteiro. A jornada começa em **1º/11/2026** (`User.journeyStart`, escolha do usuário); antes disso a tela é um **prólogo**: mostra o Leão de Nemeia, os doze trabalhos e os mitos que virão, só para leitura, e o Início diz "Jornada · prólogo";
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
- **Memorização** `/memorizar`: textos por linha (ler → iniciais → de cor), com as linhas já sabidas visíveis acima da nova; a tela fica acesa Cronômetro desde o primeiro toque (sino aos 3 min, segue contando), aquecimento ao abrir (recitar o já sabido) e "Fechar o treino" (recitar tudo do início).
- **Uma passagem para hoje** `/inspiracao` (card no Início): trecho inteiro e com contexto, sorteado dos livros do AD (texto do índice, nunca reescrito), das notas de aula (`SchoolClass`) ou das Frases; filtro por fonte e tema; "Guardar nas Frases" (trecho selecionado ou a passagem toda, até 900 letras).
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
- **Caderno** `/caderno` (`components/caderno/*`, `lib/db/caderno.ts`, `lib/caderno-shared.ts`), no estilo do OneNote:
  - cadernos → seções → páginas, com um nível de subpáginas; os cadernos iniciais (Escola do Discipulado, Leituras, Aulas, Vida e trabalho, Caixa de entrada) nascem na primeira visita e são editáveis;
  - editor TipTap (`components/caderno/PageEditor.tsx`, extensões próprias em `components/caderno/editor-extensions.ts`), barra de formatação acima do teclado (`visualViewport`), e a página rola para o cursor nunca ficar atrás da barra;
  - barra: duas paletas sempre visíveis (**Anotação** e **Comentário**, cores em `lib/caderno-shared.ts`), negrito, itálico, título, listas, caixinhas, **recuar/avançar** (subtópicos em vários níveis; Tab e Shift-Tab também), citação (dentro de lista, o item sai da lista antes), destaque, **marca de data** ("29/out", guarda o dia e aparece como "[29/out]" no texto puro), desfazer/refazer; o "⋯" abre sublinhado, tachado, título menor, linha, limpar formatação, alinhamento, **letra** (Livro = Source Serif, Clara = Atkinson Hyperlegible, Manuscrita = Caveat, todas servidas pelo app) e cores de destaque;
  - no topo da página: "Copiar tudo" (texto puro, com marcadores e níveis das listas), "Compartilhar" e "Escrever no fim"; **Síntese** recolhível (coluna `NotePage.synthesis`, salva à parte, sem versão) com "Copiar para a IA" (pedido de síntese + texto da página) e "Colar a resposta". Nenhuma IA roda no app;
  - salvamento automático; "salvo" só com confirmação do servidor; cópia no `localStorage` até confirmar, oferecida de volta se não chegou; uma versão a cada 10 min (até 50 por página) com restauração;
  - arquivar esconde (página com subpáginas, seção, caderno); apagar de vez só no Arquivo, com confirmação;
  - busca FTS5 (`SearchIndex`, sem acentos, por começo de palavra); "Incluir Reflexões e Diário" reindexa esses textos quando mudaram (`SearchSource`);
  - nota rápida cai na Caixa de entrada; "Organizar" mostra setas para mudar a ordem.
  - **Frases e passagens** `/caderno/frases` (`lib/db/frases.ts`, tabela `Passage`): caderno especial, criado também para quem já tinha cadernos; cada frase é **citação literal** (autor e obra obrigatórios) ou **minha síntese**, nunca misturadas; dos livros do AD, o trecho escolhido tem de ser igual ao do índice (`indexedPassage`), e o texto e a fonte não se editam, só a nota; filtro por autor; "Memorizar" cria um texto com uma frase por linha; arquivo e busca junto com o Caderno.
- **Menu de baixo:** Início, Refletir, Hábitos, Agenda e Caderno. O **Diário** abre pelo "play" do hábito "Escrever o Diário" (ferramenta `DIARIO`) e pelo cartão do Início.
- **Diário** `/diario`, **Mestre** `/mestre`, **Pendências do app** `/pendencias`, **Configurações** `/configuracoes` (lembretes).

## Pacotes das Pendências de 29/10/2026 (um pacote por conversa, um PR por pacote)

Cada pacote é feito numa conversa nova. Antes de começar, confira em `/pendencias` (ou no código) se algum item já foi resolvido.

**Pacote A: bugs e editor do Caderno** — entregue (itens #1, #2, #3, #4, #6, #7, #9, #10; ver Caderno e "Tela acesa" acima). Conferir no iPhone e marcar como resolvidos em `/pendencias`.

**Pacote B: Memorização** (Sonnet)
- **#11 Etapas:** depois da leitura, em vez de só as iniciais, a etapa 1 esconde 50% das palavras, a etapa 2 esconde 80% e a etapa 3 pede para recitar tudo. (#12 "Uma passagem para hoje" e #13 cronômetro/revisões já foram entregues; conferir e fechar.)

**Pacote C: modo escuro** (Sonnet)
- **#5** Claro, escuro ou automático, com chave em Configurações. Mostrar uma maquete antes.

**Pacote D: futuro** (Opus)
- **Desenho e formas no Caderno:** um toque abre uma tela de desenho (triângulo, círculo, seta, linha, texto); ao salvar, vira um bloquinho no meio do texto, guardado como SVG no banco, e um toque nele reabre a edição.
- **Offline (#8):**
  - o texto escrito sem conexão fica guardado no celular, com o aviso "não enviado";
  - o envio só acontece quando o usuário toca em "Enviar agora";
  - se a página mudou no servidor nesse meio-tempo, o app guarda as duas versões e nunca sobrescreve.
  - Sem Android ou APK: o app instalado no iPhone basta.
- **Fotos e anexos:** raros, por último.

## Fila (ordem combinada)

1. **Refino da Jornada** (depois de o usuário viver o primeiro mês):
   - pergunta do mês dentro do Diário ("como foi o confronto com o monstro hoje?");
   - escolher as armas de cada trabalho (hoje são todas as práticas diárias da ED);
   - editar os textos dos mitos pelo app;
   - um desenho próprio para cada trabalho (hoje: medalhão com o número romano).
2. **Caderno: próximas etapas** (maquete aprovada em 19/10/2026; etapas 1 e 2 entregues):
   - etapa 3: seleção de trecho → Memorização (em linhas), Frase, Tarefa, ligação entre páginas; página "Notas de leitura" por livro; página da aula e do Bastião; lista de ligações no fim da página; etiquetas;
   - etapa 4: **fotos** (câmera direto, imagem reduzida no celular e guardada no próprio banco) e **desenho** à mão com formas geométricas; nota rápida a partir de outras telas;
   - depois: trazer as anotações do OneNote do usuário.
3. **Faxina do banco:** o usuário apaga no painel D1 as tabelas antigas (`ReferencePassageSearch`, `ReferenceWork`, `ExportLog`, `bkp20261017_*`, `BastiaoWeek`). É preciso passar o passo a passo.
4. **Por último:**
   - **Face ID** via passkeys/WebAuthn. Avisar que o iPhone permite o código do aparelho como alternativa, e quem souber o código abriria o app.
   - Skill de **fechamento do mês** ("o que preciso viver de diferente no próximo mês").
   - O **AD num Projeto do Claude** com os 7 livros.
   - **Conector MCP seguro** ao banco.
