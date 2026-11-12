# Cours-Alygne Auth Backend

API REST d’authentification et de gestion de comptes destinée à servir de socle pédagogique ou de backend pour une application de formation. Le projet expose des mécanismes de compte, de sécurité, de sessions et d’administration ; il ne contient pas l’interface web cliente.

## Sommaire

- [Cours-Alygne Auth Backend](#cours-alygne-auth-backend)
  - [Sommaire](#sommaire)
  - [Fonctionnalités](#fonctionnalités)
  - [Technologies et dépendances](#technologies-et-dépendances)
  - [Prérequis et installation](#prérequis-et-installation)
  - [Configuration](#configuration)
  - [Démarrage et commandes](#démarrage-et-commandes)
  - [Architecture du code](#architecture-du-code)
  - [Concepts et techniques dans `src`](#concepts-et-techniques-dans-src)
    - [Démarrage et assemblage HTTP](#démarrage-et-assemblage-http)
    - [Base de données](#base-de-données)
    - [Middlewares Express](#middlewares-express)
    - [Module `auth`](#module-auth)
    - [Module `users`](#module-users)
    - [Module `demo`](#module-demo)
    - [Modules partagés et types](#modules-partagés-et-types)
    - [Tests dans `src`](#tests-dans-src)
  - [API HTTP](#api-http)
    - [Santé et documentation](#santé-et-documentation)
    - [Authentification et compte](#authentification-et-compte)
    - [Administration et démonstration RBAC](#administration-et-démonstration-rbac)
  - [Base de données et migrations](#base-de-données-et-migrations)
  - [Tests et validation](#tests-et-validation)
  - [Sécurité et limites de déploiement](#sécurité-et-limites-de-déploiement)

## Fonctionnalités

- Inscription, connexion, profil et désactivation de compte.
- Vérification d’adresse email et changement d’adresse.
- Demande de réinitialisation et changement de mot de passe.
- Jetons d’accès JWT et jetons de renouvellement rotatifs.
- Consultation, révocation et fermeture des sessions.
- Rôles `admin`, `teacher` et `learner`, avec contrôle d’accès par rôle.
- Administration des utilisateurs, pagination, filtres et consultation de leurs événements de sécurité.
- Limitation de débit, journalisation structurée, identifiant de requête et documentation OpenAPI.

## Technologies et dépendances

| Dépendance | Utilisation |
|---|---|
| Node.js 22.12+ | Environnement d’exécution requis par le projet. |
| TypeScript 5 | Typage strict et compilation vers JavaScript. |
| Express 5 | Serveur HTTP, routes et middlewares. |
| Sequelize 6 | ORM, modèles et requêtes relationnelles. |
| MySQL (`mysql2`) | Base de données persistante. |
| Zod 4 | Validation et normalisation des entrées. |
| `jsonwebtoken` | Signature et vérification des JWT. |
| `bcryptjs` | Hachage et vérification des mots de passe. |
| `express-rate-limit` | Limitation des requêtes par réseau ou identité. |
| Helmet et CORS | En-têtes HTTP de sécurité et contrôle des origines navigateur. |
| Pino et `pino-http` | Logs structurés de l’application et des requêtes. |
| Nodemailer | Envoi des emails via SMTP ou journalisation locale. |
| Swagger UI | Consultation interactive du contrat OpenAPI. |
| Vitest et Supertest | Tests unitaires et tests HTTP. |
| `tsx` | Exécution TypeScript pendant le développement. |
| `sequelize-cli` | Création de base, migrations et seeders. |

Les scripts `dev`, `typecheck`, `test`, `build`, `validate`, `db:*` et `auth:cleanup*` sont déclarés dans [package.json](./package.json). `npm run validate` enchaîne le contrôle TypeScript, les tests et la compilation.

## Prérequis et installation

1. Installer Node.js 22.12 ou une version ultérieure, npm et MySQL.
2. Créer/configurer un utilisateur MySQL pouvant créer la base demandée et modifier son schéma.
3. Depuis le répertoire du projet :

```bash
cp .env.example .env
npm ci
```

4. Adapter `.env` aux paramètres de MySQL et au port d’écoute souhaité.
5. Créer la base, appliquer les migrations puis, si nécessaire, charger les comptes de démonstration :

```bash
npm run db:create
npm run db:migrate
npm run db:seed
```

6. Lancer l’API :

```bash
npm run dev
```

L’API écoute par défaut sur `http://localhost:3000`. La documentation interactive est disponible sur `http://localhost:3000/api/docs`.

Le seeder ajoute les comptes `admin@cours-alygne.test`, `teacher@cours-alygne.test` et `learner@cours-alygne.test`, avec le mot de passe de démonstration `Password123!`. Ces identifiants sont exclusivement destinés au développement local : ne les utilisez pas dans un environnement partagé ou en production.

## Configuration

Le fichier `.env.example` décrit la configuration locale. Les variables sont lues et validées au démarrage par `src/config/env.ts` avec Zod. Les chaînes booléennes acceptées sont `true` et `false`.

| Variable | Rôle |
|---|---|
| `NODE_ENV` | Environnement : `development`, `test` ou `production`. |
| `PORT` | Port HTTP de l’API. |
| `APP_URL` | URL publique de l’API, utilisée dans les informations de démarrage. |
| `FRONTEND_URL` | Origine autorisée par CORS et base des liens de vérification/reset envoyés par email. |
| `TRUST_PROXY` | `false` en local ou nombre de proxies de confiance derrière un reverse proxy maîtrisé. |
| `DB_HOST`, `DB_PORT` | Hôte et port MySQL. |
| `DB_NAME`, `DB_TEST_NAME` | Bases applicative et de test. |
| `DB_USER`, `DB_PASSWORD` | Identifiants MySQL. |
| `DB_LOGGING` | Active le détail des requêtes SQL dans les logs. |
| `DB_SSL` | Active TLS MySQL avec vérification du certificat. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Secrets distincts de signature des deux catégories de JWT, d’au moins 32 caractères. |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | Durées de validité JWT, par exemple `15m` et `7d`. |
| `EMAIL_VERIFICATION_TTL_MINUTES` | Durée de validité d’un lien de vérification. |
| `PASSWORD_RESET_TTL_MINUTES` | Durée de validité d’un lien de réinitialisation. |
| `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCK_MINUTES` | Seuil d’échecs avant verrouillage temporaire et durée du verrouillage. |
| `MAIL_DRIVER` | `log` pour journaliser les liens en local ou `smtp` pour envoyer des emails. |
| `MAIL_FROM`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE` | Expéditeur et paramètres du transport SMTP. |
| `MAIL_USER`, `MAIL_PASSWORD` | Identifiants SMTP facultatifs selon le serveur de courrier. |
| `AUTH_EXPOSE_DEBUG_TOKENS` | En développement seulement, permet d’inclure les jetons temporaires dans les réponses API. |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` | Fenêtre et nombre maximum de requêtes du limiteur général. |

En production, le démarrage refuse les secrets JWT par défaut ou d’exemple, les deux secrets identiques, les jetons de debug activés ou un transport mail autre que SMTP. Fournissez des secrets aléatoires et gardez `.env` hors du contrôle de version.

> Les valeurs de configuration du CLI Sequelize sont dans `config/config.cjs`. Configurez aussi les paramètres MySQL dans `.env` avant toute commande `db:*`. La valeur de port de l’exemple local est `3307` ; le schéma de configuration de l’application utilise `3306` par défaut si `DB_PORT` n’est pas défini.

## Démarrage et commandes

| Commande | Description |
|---|---|
| `npm run dev` | Démarre le serveur en mode développement avec rechargement. |
| `npm run typecheck` | Vérifie les types TypeScript sans générer de fichiers. |
| `npm test` | Exécute les tests Vitest. |
| `npm run test:watch` | Lance Vitest en mode interactif/watch. |
| `npm run test:coverage` | Exécute les tests avec couverture. |
| `npm run build` | Nettoie `dist/` puis compile l’application et le script de maintenance. |
| `npm start` | Démarre le JavaScript compilé depuis `dist/src/server.js`. |
| `npm run validate` | Enchaîne `typecheck`, tests et build. |
| `npm run db:create` | Crée la base configurée pour l’environnement. |
| `npm run db:drop` | Supprime cette base. |
| `npm run db:migrate` | Applique les migrations en attente. |
| `npm run db:migrate:undo` | Annule la dernière migration appliquée. |
| `npm run db:seed` | Insère les comptes de démonstration. |
| `npm run db:reset` | Supprime et recrée la base, applique les migrations et le seeder. **Détruit les données existantes.** |
| `npm run auth:cleanup:dev` | Purge les anciennes données avec `tsx`. |
| `npm run auth:cleanup` | Exécute le script de purge compilé après le build. |

Déploiement compilé :

```bash
npm ci
npm run build
NODE_ENV=production npm run db:migrate
npm prune --omit=dev
NODE_ENV=production npm start
```

Les migrations nécessitent `sequelize-cli`, une dépendance de développement : exécutez-les avant `npm prune --omit=dev`.

## Architecture du code

Le traitement d’une requête suit généralement cette chaîne :

```text
HTTP → route → middlewares → contrôleur → service → repository → modèle Sequelize → MySQL
```

- **Routes** : définissent les URL, l’ordre des middlewares et le contrôleur appelé.
- **Middlewares** : valident la requête, identifient l’utilisateur, appliquent les permissions et propagent les erreurs.
- **Contrôleurs** : adaptent HTTP à l’application (lecture de la requête, appel du service, réponse).
- **Services** : portent les scénarios fonctionnels et leurs règles métier.
- **Repositories** : isolent les opérations de persistance Sequelize.
- **Modèles** : décrivent les données et leur représentation sûre.

Les services acceptent des repositories et des services externes par injection de dépendances. Les tests les remplacent par des fakes en mémoire, ce qui permet de tester les scénarios métier sans connexion MySQL.

## Concepts et techniques dans `src`

### Démarrage et assemblage HTTP

- `src/server.ts` vérifie les règles de configuration de production, se connecte à MySQL, démarre le serveur et traite `SIGINT`/`SIGTERM` avec fermeture du serveur et de la connexion.
- `src/app.ts` assemble Express : identifiant de requête, logs HTTP, Helmet, CORS, parseurs JSON/formulaire, limiteur général, routes de santé, Swagger et routeurs métier. Les erreurs et routes inconnues sont traitées à la fin de la chaîne.
- `src/config/env.ts` valide les variables d’environnement et interdit quelques configurations dangereuses en production.
- `src/config/logger.ts` configure Pino et masque les mots de passe, les jetons et les en-têtes sensibles des logs.
- `src/config/openapi.ts` contient le document OpenAPI 3.1 affiché par Swagger UI.

### Base de données

- `src/database/sequelize.ts` configure Sequelize pour MySQL, le pool de connexions, les logs SQL et l’option TLS.
- `src/database/models.ts` initialise une seule fois les modèles et leurs associations : utilisateur, sessions de renouvellement, jetons à usage unique et événements d’audit.
- Les modèles Sequelize sont dans `src/modules/users/` et `src/modules/auth/`. Ils utilisent des UUID, des noms de colonnes `snake_case` et des timestamps.
- Les migrations SQL versionnées sont à la racine dans `migrations/` ; elles constituent la source de création du schéma, pas `sequelize.sync()`.

### Middlewares Express

- `request-id.ts` conserve un `x-request-id` au format UUID ou en génère un, puis l’ajoute à la réponse et au contexte de requête.
- `validate.ts` parse les paramètres, query strings ou corps avec le schéma Zod correspondant ; les contrôleurs utilisent les données validées.
- `authenticate.ts` vérifie le bearer access token, retrouve l’utilisateur et vérifie que sa session est active et que sa version d’authentification correspond. Il expose ensuite le contexte authentifié à Express. `authorize()` applique les rôles et `requireVerifiedEmail` impose un email vérifié.
- `rate-limit.ts` fournit un limiteur réseau et un limiteur par identité. L’identité (email, jeton ou utilisateur) est hachée avant d’être utilisée comme clé, pour éviter de conserver ces valeurs brutes dans le store.
- `not-found.ts` convertit une URL inconnue en erreur applicative 404.
- `error-handler.ts` normalise les erreurs métier, de validation, de contrainte unique et les erreurs internes dans une enveloppe JSON commune.

### Module `auth`

- `auth.routes.ts` déclare les routes publiques et authentifiées, les schémas de validation et des limiteurs spécifiques à l’inscription, à la connexion et aux opérations de récupération.
- `auth.controller.ts` extrait les entrées validées, construit le contexte IP/agent utilisateur et délègue à `AuthService`.
- `auth.service.ts` orchestre les cas d’usage : inscription, login, refresh, logout, profil, changement/récupération du mot de passe, vérification/changement d’email, sessions et désactivation de compte. Les événements d’audit sont enregistrés sans transformer une opération métier déjà terminée en erreur HTTP si le stockage d’audit échoue.
- `auth.schema.ts` normalise les emails et valide les mots de passe, confirmations, jetons et paramètres. La longueur des mots de passe tient compte de la limite bcrypt de 72 octets.
- `refresh-token.repository.ts` et `one-time-token.repository.ts` regroupent les lectures/écritures des jetons. Les jetons à usage unique sont revendiqués par une mise à jour conditionnelle afin qu’ils ne soient consommés qu’une fois.
- `auth-audit.repository.ts` et `auth-audit-event.model.ts` stockent les événements de sécurité, avec une empreinte de l’email plutôt que l’email en clair dans ce champ.
- `mail.service.ts` définit l’interface d’envoi, un mode local qui écrit les liens dans les logs, et un transport SMTP. Les noms insérés dans le HTML des emails SMTP sont échappés.

**Cycle des jetons :**

1. L’access token est un JWT de courte durée avec sujet, rôle, session et version d’authentification.
2. Le refresh token est signé séparément, limité dans le temps et associé à une session. Seule son empreinte SHA-256 est stockée en base.
3. Au renouvellement, le jeton courant est révoqué et remplacé. Une réutilisation d’un jeton déjà remplacé entraîne la révocation de sa famille de session.
4. La version d’authentification permet d’invalider les anciens jetons après certaines actions de sécurité.
5. Les jetons de vérification et de reset sont opaques, stockés sous forme hachée, expirables, à usage unique et liés à leur cible par un `context_hash`.

### Module `users`

- `user.routes.ts` protège l’ensemble des routes par authentification, email vérifié et rôle `admin`.
- `user.controller.ts` convertit les entrées validées en appels métier et enveloppe les réponses.
- `user.service.ts` porte les opérations administratives : création et consultation des utilisateurs, pagination, changement de rôle/statut, révocation des sessions et consultation des événements de sécurité.
- `user.repository.ts` construit les requêtes Sequelize, normalise les emails et protège les changements de rôle/statut du dernier administrateur actif avec des transactions et des verrous en base.
- `user.model.ts` définit les rôles, champs du compte et `toSafeJSON()`, qui exclut notamment le hash du mot de passe.
- `user.schema.ts` valide les filtres, la pagination, les identifiants UUID et les formulaires de gestion de comptes.

### Module `demo`

`demo.routes.ts` expose des routes illustrant l’accès authentifié, l’accès réservé aux comptes vérifiés, l’autorisation `admin` et l’autorisation de l’équipe pédagogique (`admin` ou `teacher`). Ce sont des exemples de RBAC, et non des fonctionnalités métier de formation.

### Modules partagés et types

- `shared/password.ts` encapsule le hachage et la comparaison bcrypt.
- `shared/token.ts` signe/vérifie les JWT, génère les jetons opaques et calcule les empreintes, expirations et durées.
- `shared/errors.ts` fournit les erreurs applicatives typées (400, 401, 403, 404, 409, 410 et 429).
- `shared/api-response.ts` standardise l’enveloppe des réponses réussies ; `shared/async-handler.ts` transmet les rejets asynchrones au middleware d’erreur Express.
- `types/express.d.ts` étend les types de requête Express avec l’identifiant, les données validées et le contexte d’authentification.

### Tests dans `src`

Les fichiers `*.test.ts` vérifient les schémas, primitives cryptographiques, middleware d’authentification et de limitation, services d’authentification et d’administration, ainsi que l’API HTTP. `src/tests/fakes/auth-fakes.ts` fournit les implémentations en mémoire utilisées par les tests métier. La configuration Vitest se trouve dans `vitest.config.ts`.

## API HTTP

Toutes les routes sont préfixées par `/api`. Une requête authentifiée doit fournir `Authorization: Bearer <access_token>`. Les réponses réussies suivent le format `{ "success": true, "data": ... }` ; les erreurs incluent `success: false`, un code, un message et un identifiant de requête.

### Santé et documentation

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/health` | État, durée de fonctionnement et horodatage du processus. |
| `GET` | `/api/health/database` | Vérifie la connexion MySQL. |
| `GET` | `/api/docs` | Documentation OpenAPI/Swagger UI. |

### Authentification et compte

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Crée un compte apprenant et envoie un lien de vérification. |
| `POST` | `/api/auth/login` | Public | Authentifie et fournit une paire de jetons. |
| `POST` | `/api/auth/refresh` | Public + refresh token | Fait tourner le refresh token. |
| `POST` | `/api/auth/logout` | Public + refresh token | Révoque la famille de session correspondante. |
| `POST` | `/api/auth/forgot-password` | Public | Demande un lien de réinitialisation. |
| `POST` | `/api/auth/reset-password` | Public + jeton | Définit un nouveau mot de passe. |
| `POST` | `/api/auth/email/verify` | Public + jeton | Vérifie l’adresse email. |
| `GET` | `/api/auth/me` | Authentifié | Retourne le compte courant. |
| `PATCH` | `/api/auth/profile` | Authentifié | Modifie le nom du compte courant. |
| `PATCH` | `/api/auth/password` | Authentifié | Change le mot de passe et révoque les sessions. |
| `POST` | `/api/auth/email/change` | Authentifié | Change l’adresse, relance une vérification et ferme les sessions. |
| `POST` | `/api/auth/email/verification-notification` | Authentifié | Renvoie un lien de vérification si nécessaire. |
| `POST` | `/api/auth/logout-all` | Authentifié | Révoque toutes les sessions du compte. |
| `GET` | `/api/auth/sessions` | Authentifié | Liste les sessions actives du compte. |
| `DELETE` | `/api/auth/sessions/:sessionId` | Authentifié | Révoque une session du compte courant. |
| `DELETE` | `/api/auth/account` | Authentifié | Désactive le compte après confirmation par mot de passe. |

### Administration et démonstration RBAC

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/api/users` | Admin vérifié | Liste paginée, avec filtres par rôle, statut, vérification et recherche. |
| `POST` | `/api/users` | Admin vérifié | Crée un compte avec rôle et état configurables. |
| `GET` | `/api/users/:id` | Admin vérifié | Consulte un compte. |
| `PATCH` | `/api/users/:id/role` | Admin vérifié | Modifie le rôle sans supprimer le dernier admin actif. |
| `PATCH` | `/api/users/:id/active` | Admin vérifié | Active/désactive un compte avec protection du dernier admin. |
| `POST` | `/api/users/:id/revoke-sessions` | Admin vérifié | Révoque les sessions de l’utilisateur ciblé. |
| `GET` | `/api/users/:id/security-events` | Admin vérifié | Consulte ses événements d’audit. |
| `GET` | `/api/demo/authenticated` | Authentifié | Démonstration d’accès à toute session authentifiée. |
| `GET` | `/api/demo/verified` | Email vérifié | Démonstration de la règle de vérification d’adresse. |
| `GET` | `/api/demo/admin` | Admin | Démonstration du contrôle par rôle. |
| `GET` | `/api/demo/teaching-team` | Admin ou enseignant | Démonstration d’une permission multi-rôles. |

Le contrat complet, notamment les schémas de requête/réponse, est dans `/api/docs`.

## Base de données et migrations

Les migrations créent les tables suivantes :

- `users` : identité, hash de mot de passe, rôle, état, vérification email, version d’authentification et informations de connexion.
- `refresh_tokens` : empreintes des refresh tokens, durée de validité, révocation, chaîne de rotation et métadonnées de session.
- `one_time_tokens` : jetons de vérification/reset hachés, cible, expiration et consommation.
- `auth_audit_events` : événements de sécurité, statut et métadonnées.

Les relations utilisateur/jetons sont supprimées en cascade quand un compte est supprimé ; les événements d’audit conservent leur enregistrement avec `user_id` nul. Des index couvrent notamment les emails, empreintes de jetons, sessions, dates d’expiration et consultations d’audit.

Les migrations et données de démonstration sont sous `migrations/` et `seeders/`. Le script `scripts/cleanup-auth-data.ts` supprime les refresh tokens expirés/révoqués depuis plus de 30 jours, les jetons à usage unique expirés/consommés depuis plus de 7 jours et les événements d’audit de plus de 180 jours.

## Tests et validation

```bash
npm run typecheck
npm test
npm run build
# Ou les trois étapes :
npm run validate
```

Les tests actuels s’exécutent sans MySQL avec Vitest et Supertest. Ils couvrent les validations, les primitives de sécurité, les services avec dépôts fictifs, les middlewares et les routes HTTP de base. Pour valider le schéma réel, les migrations et les verrous transactionnels, une base MySQL de test et des tests d’intégration dédiés restent nécessaires.

## Sécurité et limites de déploiement

- Les mots de passe sont stockés sous forme bcrypt, jamais en clair. Les mots de passe doivent respecter la politique définie dans le schéma, et ne pas dépasser la limite de 72 octets utilisée par bcrypt.
- Les réponses utilisateur passent par `toSafeJSON()` et n’exposent pas le hash du mot de passe.
- Les secrets JWT d’accès et de renouvellement doivent être indépendants, aléatoires et conservés dans le gestionnaire de secrets de l’environnement.
- Configurez `TRUST_PROXY` seulement si l’API est derrière un proxy que vous contrôlez. La valeur impacte l’adresse IP interprétée par Express et les limiteurs.
- Le store du limiteur de débit est en mémoire : il ne partage pas les compteurs entre plusieurs instances et se réinitialise au redémarrage. Utilisez un store distribué, par exemple Redis, avant un déploiement horizontal.
- Plusieurs opérations métier mettent à jour plusieurs tables successivement. Pour une plateforme critique, évaluez des transactions couvrant l’ensemble de chaque scénario et une outbox persistante pour fiabiliser la livraison d’emails.
- Les emails et jetons de debug du mode local peuvent apparaître dans les logs ou les réponses. Gardez `MAIL_DRIVER=log` et `AUTH_EXPOSE_DEBUG_TOKENS=true` au développement local uniquement.
- Les comptes et le mot de passe du seeder sont publics et prévisibles ; ne chargez pas ces données en production.