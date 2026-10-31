# Sendero para outras pessoas — plano (31/10/2026)

Objetivo: um teste com cerca de 5 pessoas, cada uma com login próprio e experiência independente; no futuro, possível uso nacional na Nova Acrópole. Nada disto está feito ainda.

## Ponto de partida (o que o código já tem)

- 41 das 49 tabelas já têm `userId`, e as consultas já filtram por ele (ex.: `lib/db/caderno.ts`, `lib/db/agenda.ts`, `lib/db/lembretes.ts`).
- Sem `userId`, e tudo bem: biblioteca compartilhada (`IndexedWork`, `IndexedUnit`, `IndexedPassage`), mitos e trabalhos da Jornada (`JourneyMyth`, `JourneyLabor`), chaves do Web Push (`PushKey`).
- Precisa de dono: `MemorizationProgressLog` (hoje só pelo `itemId`; conferir o dono pelo item).
- O que prende o app a uma só pessoa:
  - `getActiveUser()` em `lib/db/sendero.ts` pega sempre o mesmo usuário (`sidclay@example.com`, ou o primeiro) e cria "Sidclay" com data de nascimento fixa;
  - `worker/auth.ts` tem uma senha e um PIN para o app inteiro;
  - `worker/mcp.ts` usa o primeiro usuário e o prompt do AD fala de Sidclay;
  - `components/inicio/InicioScreen.tsx` mostra "Sidclay" como nome padrão;
  - o cron (`sendDueReminders`) roda para o usuário ativo, não para todos.

## Decisão de base: uma instância separada para o teste

O app pessoal de Sidclay continua como está, com o banco dele. O teste roda numa **segunda cópia** do mesmo código:

- outro Worker, por exemplo `sendero-grupo`;
- outro banco D1, vazio;
- ambos cabem no plano gratuito.

Por que separar:

- os dados pessoais de Sidclay nunca ficam no mesmo banco que os de outras pessoas;
- um erro do multiusuário não ameaça o histórico dele;
- se o teste for adiante, essa instância é a que pode passar para uma conta da instituição.

Sidclay pode ter uma conta de teste lá também. O código é um só; as diferenças ficam em configuração.

## Fase 1: teste com 5 pessoas (três pacotes, uma conversa por pacote)

### Pacote M1: login individual e isolamento (Opus)

- **Contas e convites:**
  - tabela de credenciais com a senha guardada como hash (PBKDF2 no próprio Worker, sem serviço pago);
  - PIN por pessoa;
  - o admin gera um **link de convite** de uso único, e a pessoa cria a própria senha.
- **Sessão:**
  - o cookie de sessão passa a levar o `userId`;
  - `getActiveUser()` lê a pessoa da sessão, nunca de um e-mail fixo.
- **Proteção do login:**
  - limite de tentativas por conta, guardado no D1, não só no cookie;
  - "sair de todos os aparelhos".
- **Isolamento, a parte mais importante:**
  - revisar toda rota que recebe um `id` (página, reflexão, tarefa, livro…) para conferir que o item é da pessoa logada;
  - teste automático com dois usuários: o usuário B nunca lê, altera nem apaga nada do usuário A.
- **Outras partes que passam a respeitar cada pessoa:**
  - cron dos lembretes e avisos percorre cada pessoa, com o push de cada uma;
  - MCP/AD desligado na instância de grupo por enquanto (ou um token por pessoa, depois).
- Migrações novas: credenciais, convites, `userId` em `MemorizationProgressLog`.

### Pacote M2: app limpo e primeiro acesso (Opus, maquete antes)

- **Tela de boas-vindas no primeiro login:**
  - nome;
  - data de nascimento (opcional, só para o Mortem);
  - início do ciclo;
  - lembretes.
- **Conteúdo comum vs. conteúdo pessoal:**
  - todos recebem as fases e tônicas da ED, os mitos da Jornada e a biblioteca;
  - hábitos começam de um **modelo base**, que a pessoa ajusta;
  - nada do conteúdo pessoal de Sidclay (diário, reflexões, Caderno, Frases, tarefas) é copiado.
- **Módulos ligáveis:**
  - Escola, Bastião, Jornada, Leitura, Memorização podem ser ligados ou desligados em Configurações;
  - nem todo membro está na ED ou tem Bastião.
- Tirar os textos fixos com o nome "Sidclay".

### Pacote M3: privacidade e administração (Sonnet)

- **Termo de uso e privacidade** curto, aceito no primeiro acesso, dizendo:
  - o que é guardado;
  - onde fica (Cloudflare);
  - quem administra;
  - que o administrador tecnicamente consegue ver o banco e se compromete a não ler.
- **Exportar meus dados** (um arquivo com tudo da pessoa).
- **Apagar minha conta:** apaga tudo daquela pessoa, com confirmação dupla.
- **Tela do admin:**
  - criar e revogar convites;
  - desativar conta;
  - ver as **Pendências do app** enviadas pelos testadores (feedback);
  - **sem** acesso pelo app ao conteúdo das pessoas.
- **Backup:** cópia periódica do banco do grupo, nunca no GitHub.

## Fase 2: uso nacional (antes de crescer, não é só código)

- **Instituição:**
  - aprovação da Nova Acrópole para usar o conteúdo da ED e dos livros do AD, porque o índice dos livros vai dentro do app;
  - a conta Cloudflare e o domínio passam a ser da instituição, não de uma pessoa.
- **LGPD:**
  - reflexões sobre convicção filosófica ou religiosa são **dado pessoal sensível**;
  - exige consentimento claro e destacado, política de privacidade, um responsável (encarregado/DPO) e um plano para vazamento.
- **Criptografia no celular** para Diário e Reflexões:
  - nem o admin consegue ler;
  - custo: quem esquecer a senha perde esse conteúdo;
  - a busca e o AD não leem esses textos.
  - Decidir com a instituição.
- **Limites do plano gratuito:**
  - 100 mil acessos por dia no Worker;
  - escritas e leituras do D1 por dia;
  - o "batimento" de 1 em 1 minuto do PIN (`components/app/LockGuard.tsx`) gasta acessos;
  - estimativa: algumas centenas de pessoas ativas por dia cabem; milhares pedem o Workers Paid (US$ 5/mês), que **rompe o custo zero**. Decisão da instituição.
- **Operação:**
  - um ambiente de teste antes do oficial;
  - aviso de erros;
  - backups automáticos;
  - canal de suporte;
  - outros níveis além da ED (1º nível etc.);
  - Android funciona pelo mesmo app instalado pelo navegador.

## Ordem sugerida

1. Pedir a aprovação informal da instituição antes de convidar as 5 pessoas.
2. M1.
3. M2.
4. M3.
5. Teste com as 5 pessoas por um mês, recolhendo pendências.
6. Só então a Fase 2.

O Pacote D e a Fila de `docs/estado-atual.md` podem seguir em paralelo no app pessoal; o que entrar no código vale para as duas instâncias.
