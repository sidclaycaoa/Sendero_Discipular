# Sendero Discipular — Cloudflare Workers

Aplicativo pessoal do Sendero adaptado do Site original para **Cloudflare Workers + D1**. O código preserva as telas, APIs, sete obras indexadas e o endpoint `/mcp`. O repositório deve permanecer privado.

## Estado

O build Vinext/Workers, a preparação do D1 e os testes foram validados localmente. **Ainda não é uma implantação ativa.** O Site original permanece em uso enquanto o novo Worker e o banco são protegidos, importados e comparados.

## Configuração do Worker

1. Em `wrangler.jsonc`, use o nome exato do Worker criado na sua conta e associe o banco D1 correto ao binding `DB`. Troque o `database_id` provisório pelo ID desse banco.
2. Em Cloudflare Access, restrinja **produção e previews** desse Worker à sua identidade antes de publicar. Verifique também domínio personalizado e `workers.dev`.
3. Conecte este repositório privado em Workers Builds. Use `npm ci && npm run build` como build e `npx wrangler deploy --config dist/server/wrangler.json` como deploy. Não ative builds automáticos até concluir a proteção.
4. Aplique as migrações no D1 remoto com `npx wrangler d1 migrations apply sendero-discipular --remote` (ajuste o nome se diferente). Depois importe o backup privado gerado conforme abaixo.

## Importação privada

O backup pessoal **não entra no GitHub**. Coloque o JSON exportado dentro de `private-data/` e execute:

```bash
node scripts/prepare-d1-import.mjs private-data/SEU_BACKUP.json
for file in private-data/d1-import/*.sql; do npx wrangler d1 execute sendero-discipular --remote --file "$file"; done
```

Compare as contagens de tabelas e alguns registros recentes com o Site original. Faça uma sincronização final dos registros alterados depois do backup antes de mudar o uso diário. Não publique arquivos de `private-data/` nem variáveis de ambiente.

## Validação local

```bash
npm ci
npm run build
npm test
npx wrangler deploy --config dist/server/wrangler.json --dry-run
```

O endpoint MCP `/mcp` está no código, mas a conexão do plugin AD continua apontando ao Site atual até existir autenticação e uma conexão nova verificadas no Worker. O antigo Site só deve ser desativado após essa validação.

Nota de implantação: confira o commit publicado no histórico de builds antes de importar os dados.

A branch `cloudflare` é a fonte atual do deploy de produção. Este commit verifica a reconexão do build automático.
