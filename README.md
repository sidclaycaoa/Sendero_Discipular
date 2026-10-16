# Sendero

Aplicativo pessoal de reflexão, diário, hábitos, tarefas e trilha discipular. Este repositório contém a adaptação do Site original para Next.js na Vercel, com banco SQLite remoto. As sete obras aprovadas e o índice literal gerado são parte da aplicação; o repositório deve permanecer privado.

## Estado da migração

O build Next.js e as seis migrações SQL foram validados localmente. A publicação externa depende de importar um retrato **atual e completo** do banco, configurar Turso Cloud (SQLite), ligar GitHub à Vercel e proteger **todos** os domínios de produção com Vercel Authentication. O Site original permanece ativo durante a validação. Veja [MIGRATION.md](MIGRATION.md).

## Configuração

- Node.js >= 22.13 e `npm ci`.
- `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` em variáveis privadas da Vercel; nunca em Git.
- `npm run db:setup` cria o schema. `npm run db:setup -- --data private-data/sendero-current-export.json` importa a exportação atual.
- `npm run build` gera a aplicação; `npm run dev` inicia desenvolvimento local.
- `OPENAI_API_KEY` ou `GEMINI_API_KEY` são opcionais para as funções de IA.

O índice das obras está em `lib/data/ad-book-index.json`, gerado a partir dos arquivos originais. Quando uma obra for trocada, execute `scripts/index-books.py` com os requisitos de `scripts/requirements-index.txt`, revise o resultado e faça commit. O código nunca inventa passagens ou aceita citações fornecidas pelo cliente como fonte.

## Dados e acesso

A exportação do banco e o backup embutido no Site não entram no repositório. O aplicativo usa um usuário único já existente no banco; a autenticação externa será garantida na borda pela proteção de todos os deployments da Vercel. O endpoint MCP `/mcp` exige uma estratégia própria de autenticação e uma nova conexão antes de substituir o plugin AD que hoje aponta para o Site original.
