# RBBinder

Tracker pessoal da tua coleção de **Riftbound TCG** (inglês). Duas áreas independentes:

- **Binders** — cria quantos binders quiseres (ex: "Coleção principal", "Trade binder"), cada um com o seu próprio layout de página (2×2, 3×3, 3×4 ou 4×4, como um álbum a sério) e a sua própria contagem de cópias por carta.
- **Bulk** — cartas repetidas / disponíveis para trocas, separado dos binders, com botão para copiar a lista.

Os dados de todas as cartas (nome, set, raridade, domínio, imagem, texto, etc.) vêm diretamente do site oficial `playriftbound.com` (inglês) e ficam guardados na tua base de dados Supabase — não são lidos ao vivo do site em cada visita. Quando a Riot lançar um set novo, usa o botão **"Sincronizar cartas"** no dashboard para atualizar o catálogo sem precisares de mexer em código ou fazer redeploy. As imagens **não são copiadas** — apontam sempre para o CDN oficial da Riot (`cmsassets.rgpub.io`). Dados e imagens são © Riot Games; este é um projeto pessoal não-oficial.

O site inteiro fica protegido por password (uma só, definida por ti) porque vai ficar publicado num URL público do Vercel.

## Testar localmente sem Supabase

Se `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` não estiverem definidas, a app guarda tudo (cartas, binders, bulk) automaticamente num ficheiro local `.data/local-db.json` (nunca é enviado para o git). Isto serve só para testares o site — criar binders, sincronizar cartas, definir quantidades — sem precisares de conta Supabase. Basta `npm install && npm run dev` e definir `SITE_PASSWORD`/`SESSION_SECRET` no `.env.local` (passo 2).

Antes de fazeres deploy no Vercel tens de configurar o Supabase real (passo 1) — o sistema de ficheiros lá é efémero, por isso o modo local não funciona em produção.

## 1. Criar o projeto Supabase (guarda a tua coleção e o catálogo de cartas)

1. Cria uma conta grátis em [supabase.com](https://supabase.com) e um novo projeto.
2. Vai a **SQL Editor** e corre o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) — cria as tabelas `cards`, `sets`, `binders`, `binder_cards` e `bulk`.
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

Abre [http://localhost:3000](http://localhost:3000) — vai pedir a password definida em `SITE_PASSWORD`. No dashboard, clica em **"Sincronizar cartas"** para carregar o catálogo pela primeira vez, depois cria o teu primeiro binder.

## 4. Deploy no Vercel

1. Sobe este projeto para um repositório no GitHub.
2. Em [vercel.com](https://vercel.com), importa o repositório (o Next.js é detetado automaticamente).
3. Em **Settings → Environment Variables**, adiciona as mesmas 4 variáveis do `.env.local`.
4. Deploy.

Não precisas de nenhuma configuração extra — não há ficheiros a persistir no servidor, tudo o que é permanente vive no Supabase (catálogo de cartas incluído).

## Atualizar a lista de cartas (novos sets)

No dashboard, clica em **"Sincronizar cartas"**. Isto vai buscar os dados atualizados diretamente ao site oficial, guardá-los na tabela `cards`/`sets` do Supabase, e mostrar quantas cartas/sets novos foram adicionados. Funciona tanto localmente como já em produção — não precisas de correr scripts nem fazer redeploy.

## Estrutura

- `src/lib/riftboundCatalog.ts` — vai buscar os dados oficiais das cartas ao `playriftbound.com` (nome, set, raridade, domínio, imagem, texto, etc).
- `src/app/api/cards/sync` — endpoint chamado pelo botão "Sincronizar cartas"; atualiza as tabelas `cards`/`sets` no Supabase.
- `src/app/api/cards` — devolve o catálogo de cartas guardado no Supabase.
- `src/app/api/binders` — CRUD dos binders (criar, listar, renomear, mudar layout, apagar).
- `src/app/api/binders/[id]/cards` — quantidades de cada carta dentro de um binder específico.
- `src/app/api/bulk` — quantidades da pilha de bulk (separada dos binders).
- `src/app/(app)/` — páginas protegidas (Dashboard, `/binder/[id]`, Bulk), partilham o mesmo layout com o provider de dados.
- `src/app/login` + `src/proxy.ts` — gate de password simples para todo o site.
