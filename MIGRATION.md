# Sendero: Sites → GitHub → Vercel

Origem verificada: Site Sendero (36), commit `70cd7376c5d922979cfa2a86ed2c636d411f1058`.
Esta cópia é um preparo de migração; não é ainda uma publicação validada.

## Proteção dos dados

- `lib/data/sendero-db-full.json`, o snapshot histórico embutido no Site, foi retirado do código preparado para GitHub. Não publique exportações do D1 nem `.env`.
- O Site atual permanece ativo até o corte validado.
- Repositório GitHub **privado** e projeto Vercel com proteção de acesso em produção são requisitos antes de implantar. Sem isso, as APIs e os arquivos de obras estarão publicamente acessíveis.
- A integração MCP original do plugin AD continua apontando ao Site. O endpoint `/mcp` no novo host precisará de proteção e uma nova conexão OAuth antes do corte.

## Banco

O código preparado usa SQLite remoto via libSQL/Turso para conservar as consultas D1 e a busca textual normalizada. Configure `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` em ambiente seguro. `npm run db:setup` cria o schema pelas seis migrações. `npm run db:setup -- --data private-data/export-atual.json` importa um JSON completo no formato `{ "tables": { "User": [ ... ], ... } }`. Uma exportação completa de 16/10/2026 foi obtida e validada em banco local isolado, mas fica fora deste repositório. Conte linhas por tabela e faça uma sincronização final antes do corte para capturar alterações feitas depois da exportação.

## Checagens para o corte

1. Abrir todas as telas e comparar resultados com o Site original.
2. Registrar uma reflexão de teste, diário, hábito e tarefa na nova base; confirmar persistência após recarregar.
3. Verificar os sete livros, 828 trechos, referências literais, MCP, exportações e integrações de IA com as chaves cadastradas.
4. Confirmar que GitHub está privado e Vercel exige login no domínio de produção; confirmar que o endereço do Site antigo ainda funciona.
5. Fazer exportação final, importar diferenças e comparar contagens e registros recentes antes de mudar o uso diário.
