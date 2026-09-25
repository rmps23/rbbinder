# RBBinder

Tracker pessoal da tua coleção de **Riftbound TCG** (inglês). Duas secções independentes:

- **Binder** — a tua coleção organizada, define quantas cópias de cada carta tens.
- **Bulk** — cartas repetidas / disponíveis para trocas, separado do binder, com botão para copiar a lista.

Dados de todas as 1189 cartas (5 sets: Origins, Proving Grounds, Spiritforged, Unleashed, Vendetta) vêm diretamente do site oficial `playriftbound.com` (inglês). As imagens **não são copiadas** — apontam sempre para o CDN oficial da Riot (`cmsassets.rgpub.io`). Dados e imagens são © Riot Games; este é um projeto pessoal não-oficial.

O site inteiro fica protegido por password (uma só, definida por ti) porque vai ficar publicado num URL público do Vercel.

## 1. Criar o projeto Supabase (guarda a tua coleção)

1. Cria uma conta grátis em [supabase.com](https://supabase.com) e um novo projeto.
2. Vai a **SQL Editor** e corre o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) — cria a tabela `collection`.
3. Vai a **Project Settings → API** e guarda:
   - `Project URL` → vai para `SUPABASE_URL`
   - `service_role` key (não a `anon`!) → vai para `SUPABASE_SERVICE_ROLE_KEY`

A `service_role` key nunca é exposta ao browser — só é usada nas rotas de API do servidor.

## 2. Configurar variáveis de ambiente

Copia `.env.example` para `.env.local` e preenche:

```bash
cp .env.example .env.local
```

| Variável | O que é |
|---|---|
| `SUPABASE_URL` | URL do teu projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key do Supabase |
| `SITE_PASSWORD` | Password que vais usar para entrar no site |
| `SESSION_SECRET` | Qualquer string longa e aleatória (usada para assinar o cookie de sessão) |

## 3. Correr localmente

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) — vai pedir a password definida em `SITE_PASSWORD`.

## 4. Deploy no Vercel

1. Sobe este projeto para um repositório no GitHub.
2. Em [vercel.com](https://vercel.com), importa o repositório (o Next.js é detetado automaticamente).
3. Em **Settings → Environment Variables**, adiciona as mesmas 4 variáveis do `.env.local`.
4. Deploy.

Não precisas de nenhuma configuração extra — não há base de dados local nem ficheiros a persistir no servidor, tudo o que é permanente vive no Supabase.

## Atualizar a lista de cartas (novos sets)

Os dados das cartas estão em `public/data/cards.json` (gerado, não editar à mão). Quando a Riot lançar um novo set, corre:

```bash
npm run fetch:cards
```

Isto vai buscar os dados atualizados diretamente ao site oficial e sobrescrever `public/data/cards.json` e `public/data/sets.json`. Depois faz commit e volta a fazer deploy.

## Estrutura

- `scripts/fetch-cards.mjs` — descarrega os dados oficiais das cartas (nome, set, raridade, domínio, imagem, texto, etc).
- `src/app/(app)/` — páginas protegidas (Dashboard, Binder, Bulk), partilham o mesmo layout com o provider de dados.
- `src/app/api/collection` — API que lê/escreve a tua coleção no Supabase (`binder_qty` e `bulk_qty` por carta).
- `src/app/login` + `src/proxy.ts` — gate de password simples para todo o site.
