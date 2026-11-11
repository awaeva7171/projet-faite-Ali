# Backend Cours-Alygne Auth

## Stack

Node.js 22.12+, TypeScript strict, Express 5, Sequelize 6, MySQL, Zod, JWT, bcryptjs, Nodemailer, Pino, Swagger, Vitest et Supertest.

## Installation

~~~bash
cp .env.example .env
npm ci
npm run db:create
npm run db:migrate
npm run db:seed
npm run dev
~~~

## Scripts

| Commande | Rôle |
|---|---|
| npm run dev | serveur avec rechargement |
| npm run typecheck | vérification TypeScript |
| npm test | tests sans MySQL |
| npm run build | compilation production |
| npm run validate | typecheck + tests + build |
| npm run db:migrate | applique les migrations |
| npm run db:migrate:undo | annule le dernier lot |
| npm run db:seed | insère les comptes démo |
| npm run auth:cleanup | purge les anciennes données après `npm run build` |
| npm run auth:cleanup:dev | exécute le nettoyage directement en développement |

## Architecture d’un module

~~~text
route → validation/middlewares → controller → service → repository → model → MySQL
~~~

Le contrôleur ne porte pas les règles métier. Les repositories concentrent Sequelize. Les services contrôlent les scénarios d’authentification.

## Variables mail

En développement, MAIL_DRIVER=log affiche les liens de vérification et de reset dans le terminal. Pour un SMTP réel :

~~~env
MAIL_DRIVER=smtp
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=...
MAIL_PASSWORD=...
MAIL_FROM=Cours-Alygne <no-reply@example.com>
~~~

AUTH_EXPOSE_DEBUG_TOKENS=true ajoute les tokens à la réponse en développement pour faciliter Postman. Le démarrage de production refuse cette option.

`TRUST_PROXY=false` convient en local. Derrière un reverse proxy maîtrisé, indiquez le nombre exact de sauts de confiance (souvent `TRUST_PROXY=1`) afin que l’adresse IP et les limiteurs restent fiables. Les limites de connexion sont calculées par couple réseau/identité, ce qui permet à une classe de 30 apprenants de partager la même connexion Internet.

## Règles de jetons

- access token : court, signé, contient sub, sid, ver et type=access ;
- refresh token : long, signé, contient sid, jti et ver, une seule utilisation avant rotation ;
- base : seulement le SHA-256 du refresh token ;
- auth_version invalide immédiatement les anciens access tokens ;
- la rotation compare aussi ver à auth_version pour invalider les anciens refresh tokens ;
- un ancien refresh token réutilisé révoque sa famille.
- context_hash lie chaque token de vérification ou de reset à l’état visé du compte.

## Déploiement

~~~bash
npm ci
npm run build
NODE_ENV=production npm run db:migrate
npm prune --omit=dev
NODE_ENV=production npm start
~~~

TypeScript et `sequelize-cli` sont des dépendances de développement : la compilation et
les migrations doivent donc précéder `npm prune --omit=dev`. Configurez de vrais secrets
aléatoires, SMTP et MySQL avant le démarrage.

`npm run build` compile aussi le script de maintenance. `npm run auth:cleanup` reste donc
disponible après le prune ; `npm run auth:cleanup:dev` est la variante directe avec `tsx`.

## Passage à plusieurs instances

Le store des limiteurs est en mémoire, ce qui convient à l’atelier et à une instance unique.
Avant un déploiement horizontal, utilisez un store partagé comme Redis. Pour une plateforme
critique, regroupez aussi les mutations multi-tables dans des transactions MySQL et livrez les
e-mails via une outbox persistante.
