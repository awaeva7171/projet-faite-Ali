# Le chemin, étape par étape

1. app.ts : les middlewares globaux

*requestId* donne un identifiant à la requête
*pinoHttp* la journalise
*helmet* et *cors* appliquent la sécurité
*express.json* transforme ton JSON en objet JavaScript
le limiteur général compte la requête
app.use('/api/auth', authRouter) l’envoie vers auth.routes.ts

2. auth.routes.ts : les filtres propres à /register

registerLimiter autorise 60 inscriptions par 15 minutes par réseau
validateBody(registerSchema) valide les données (voir 3)
asyncHandler(AuthController.register) appelle le contrôleur

3. validate.ts et auth.schema.ts : la validation
registerSchema vérifie name (2 à 120 caractères), email (nettoyé, mis en minuscules, format valide), password (règles de force) et que password et password_confirmation sont identiques. Si tout est bon, les données nettoyées sont rangées dans request.validated.body. Sinon, une ValidationError part vers errorHandler, qui répond 400.

4. auth.controller.ts : AuthController.register

il récupère les données validées
il construit sessionContext(request) (IP et navigateur)
il appelle service.register(...)
il répondra avec sendSuccess(response, result, 201)

5. auth.service.ts : AuthService.register, la logique métier

a. users.findByEmail(email) cherche si l’email existe déjà. Si oui, il lance une ConflictError, ce qui donne une réponse 409 EMAIL_ALREADY_USED.
b. hashPassword(password) (dans shared/password.ts) transforme le mot de passe avec bcrypt. Le mot de passe en clair n’est jamais stocké.
c. users.create({...}) (dans user.repository.ts) insère la ligne dans la table users, avec le rôle learner.
d. issueOneTimeToken(..., 'verify_email', ...) crée le lien de vérification d’email :
generateOpaqueToken() fabrique un jeton aléatoire
hashToken en calcule le hash SHA-256
oneTimeTokens.issue enregistre ce hash (pas le jeton) dans one_time_tokens, avec une date d’expiration et un context_hash lié à l’email
e. mail.sendEmailVerification(user, token) envoie l’email. En mode log, le lien s’affiche simplement dans ton terminal.
f. issueTokens(user, context) ouvre la session :
randomUUID() crée un sessionId
buildRefreshRecord appelle signRefreshToken (JWT de 7 jours), en calcule le hash et la date d’expiration
refreshTokens.create insère ce hash dans refresh_tokens
tokenPair appelle signAccessToken (JWT de 15 minutes) et assemble la réponse
g. recordAudit('auth.registered', ...) écrit une ligne dans auth_audit_events (l’email y est stocké haché).
h. Le service retourne le résultat au contrôleur.

6. Retour au contrôleur : sendSuccess(response, result, 201) met le résultat dans data et ajoute "success": true.

Ce que tu reçois dans Postman (statut 201 Created)
json
{
  "success": true,
  "data": {
    "user": { "id": "...", "name": "Awa Test", "email": "awa@example.com", "role": "learner", "email_verified": false, ... },
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "token_type": "Bearer",
    "expires_in": 900,
    "session_id": "...",
    "verification_required": true,
    "message": "Consultez votre messagerie pour vérifier votre adresse.",
    "debug": { "verification_token": "..." }
  }
}
Le champ user vient de toSafeJSON() dans user.model.ts, qui retire le password_hash.
Le champ debug n’apparaît que si AUTH_EXPOSE_DEBUG_TOKENS=true dans ton .env. C’est pratique pour tester l’étape suivante dans Postman, et la production l’interdit.
Résumé en une ligne

Postman → app.ts → auth.routes.ts → validate (schema) → controller → service → repository → modèle → MySQL, puis service → controller → sendSuccess → Postman.

Dans la base, 4 lignes ont été créées : une dans users, une dans one_time_tokens, une dans refresh_tokens et une dans auth_audit_events.

Dis-moi quand c’est clair, et on fait la même chose pour login, ou on regarde de plus près la suite de l’inscription (la vérification d’email avec le token reçu).
