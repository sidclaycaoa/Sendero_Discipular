# Sendero Discipular

App pessoal de um único usuário (Sidclay), usado principalmente pelo celular. Antes de mudar produto ou dados, leia `docs/dossie-sendero.md`: propósito, módulos, persona AD, decisões de design e frustrações históricas.

- Stack: vinext (Next.js em Vite) num Cloudflare Worker + banco D1 (`sendero-discipular`). Entrada do Worker: `worker/index.ts`.
- Acesso: todo o Worker fica atrás do login por senha de `worker/auth.ts` (secret `SENDERO_SENHA`). Não abrir rotas sem passar pelo gate.
- Custo zero: usar só recursos do plano gratuito do Cloudflare; não adicionar APIs de IA pagas.
- Fuso do usuário: America/Sao_Paulo.
- Validação: `npm run build && npm test` (o teste de `scripts/index-books.py` exige PyMuPDF).
- O usuário não é desenvolvedor: instruções para ele (GitHub, painel Cloudflare) devem dizer exatamente onde tocar e o que preencher.
