const json = (schema: unknown) => ({
  content: { 'application/json': { schema } },
})

const body = (schema: string) => ({
  required: true,
  ...json({ $ref: `#/components/schemas/${schema}` }),
})

const error = (description: string) => ({
  description,
  ...json({ $ref: '#/components/schemas/ApiError' }),
})

const secured = { security: [{ bearerAuth: [] }] }

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Cours-Alygne — Auth API',
    version: '1.0.0',
    description:
      'Socle pédagogique complet : comptes, JWT, sessions, vérification email, récupération du mot de passe et RBAC.',
  },
  servers: [{ url: 'http://localhost:3000/api', description: 'Développement local' }],
  tags: [
    { name: 'System' },
    { name: 'Authentication' },
    { name: 'Profile' },
    { name: 'Sessions' },
    { name: 'Users administration' },
    { name: 'Authorization demos' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      ApiError: {
        type: 'object',
        required: ['success', 'error', 'request_id'],
        properties: {
          success: { type: 'boolean', const: false },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              details: {},
            },
          },
          request_id: { type: 'string', format: 'uuid' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['admin', 'teacher', 'learner'] },
          is_active: { type: 'boolean' },
          email_verified: { type: 'boolean' },
          email_verified_at: { type: ['string', 'null'], format: 'date-time' },
          last_login_at: { type: ['string', 'null'], format: 'date-time' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      TokenPair: {
        type: 'object',
        properties: {
          access_token: { type: 'string' },
          refresh_token: { type: 'string' },
          token_type: { type: 'string', const: 'Bearer' },
          expires_in: { type: 'integer', example: 900 },
          session_id: { type: 'string', format: 'uuid' },
        },
      },
      Session: {
        type: 'object',
        properties: {
          session_id: { type: 'string', format: 'uuid' },
          ip_address: { type: ['string', 'null'] },
          user_agent: { type: ['string', 'null'] },
          last_used_at: { type: 'string', format: 'date-time' },
          expires_at: { type: 'string', format: 'date-time' },
          is_current: { type: 'boolean' },
        },
      },
      RegisterInput: {
        type: 'object',
        required: ['name', 'email', 'password', 'password_confirmation'],
        properties: {
          name: { type: 'string', example: 'Awa Ndiaye' },
          email: { type: 'string', format: 'email', example: 'awa@example.com' },
          password: { type: 'string', format: 'password', example: 'Secret123!' },
          password_confirmation: {
            type: 'string',
            format: 'password',
            example: 'Secret123!',
          },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password' },
        },
      },
      RefreshInput: {
        type: 'object',
        required: ['refresh_token'],
        properties: { refresh_token: { type: 'string' } },
      },
      ForgotPasswordInput: {
        type: 'object',
        required: ['email'],
        properties: { email: { type: 'string', format: 'email' } },
      },
      ResetPasswordInput: {
        type: 'object',
        required: ['token', 'password', 'password_confirmation'],
        properties: {
          token: { type: 'string' },
          password: { type: 'string', format: 'password' },
          password_confirmation: { type: 'string', format: 'password' },
        },
      },
      VerifyEmailInput: {
        type: 'object',
        required: ['token'],
        properties: { token: { type: 'string' } },
      },
      UpdateProfileInput: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' } },
      },
      ChangePasswordInput: {
        type: 'object',
        required: ['current_password', 'password', 'password_confirmation'],
        properties: {
          current_password: { type: 'string', format: 'password' },
          password: { type: 'string', format: 'password' },
          password_confirmation: { type: 'string', format: 'password' },
        },
      },
      ChangeEmailInput: {
        type: 'object',
        required: ['email', 'current_password'],
        properties: {
          email: { type: 'string', format: 'email' },
          current_password: { type: 'string', format: 'password' },
        },
      },
      DeactivateAccountInput: {
        type: 'object',
        required: ['current_password', 'confirmation'],
        properties: {
          current_password: { type: 'string', format: 'password' },
          confirmation: { type: 'string', const: 'DESACTIVER' },
        },
      },
      UpdateUserRoleInput: {
        type: 'object',
        required: ['role'],
        properties: {
          role: { type: 'string', enum: ['admin', 'teacher', 'learner'] },
        },
      },
      UpdateUserActiveInput: {
        type: 'object',
        required: ['is_active'],
        properties: {
          is_active: { type: 'boolean' },
        },
      },
      CreateUserInput: {
        allOf: [
          { $ref: '#/components/schemas/RegisterInput' },
          {
            type: 'object',
            required: ['role'],
            properties: {
              role: { type: 'string', enum: ['admin', 'teacher', 'learner'] },
              is_active: { type: 'boolean', default: true },
              email_verified: { type: 'boolean', default: false },
            },
          },
        ],
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        operationId: 'health',
        summary: 'Vérifie le processus HTTP',
        responses: { '200': { description: 'API disponible' } },
      },
    },
    '/health/database': {
      get: {
        tags: ['System'],
        operationId: 'databaseHealth',
        summary: 'Vérifie la connexion MySQL',
        responses: { '200': { description: 'MySQL disponible' }, '500': error('MySQL indisponible') },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        operationId: 'register',
        summary: 'Crée un compte apprenant et une première session',
        requestBody: body('RegisterInput'),
        responses: {
          '201': { description: 'Compte créé' },
          '400': error('Données invalides'),
          '409': error('Email déjà utilisé'),
          '429': error('Trop de tentatives'),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        operationId: 'login',
        summary: 'Ouvre une session',
        requestBody: body('LoginInput'),
        responses: {
          '200': { description: 'Utilisateur et paire de jetons' },
          '401': error('Identifiants invalides'),
          '429': error('Compte ou IP limité'),
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Authentication'],
        operationId: 'refresh',
        summary: 'Effectue la rotation du refresh token',
        requestBody: body('RefreshInput'),
        responses: {
          '200': { description: 'Nouvelle paire de jetons' },
          '401': error('Jeton invalide, expiré ou réutilisé'),
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Authentication'],
        operationId: 'logout',
        summary: 'Révoque la session du refresh token',
        requestBody: body('RefreshInput'),
        responses: { '200': { description: 'Déconnexion idempotente' } },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Authentication'],
        operationId: 'forgotPassword',
        summary: 'Demande un lien sans révéler si le compte existe',
        requestBody: body('ForgotPasswordInput'),
        responses: { '202': { description: 'Demande acceptée' }, '429': error('Limite atteinte') },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['Authentication'],
        operationId: 'resetPassword',
        summary: 'Consomme un token et remplace le mot de passe',
        requestBody: body('ResetPasswordInput'),
        responses: { '200': { description: 'Mot de passe modifié' }, '410': error('Token expiré ou utilisé') },
      },
    },
    '/auth/email/verify': {
      post: {
        tags: ['Authentication'],
        operationId: 'verifyEmail',
        summary: 'Vérifie une adresse avec un token à usage unique',
        requestBody: body('VerifyEmailInput'),
        responses: { '200': { description: 'Adresse vérifiée' }, '410': error('Token expiré ou utilisé') },
      },
    },
    '/auth/me': {
      get: {
        ...secured,
        tags: ['Profile'],
        operationId: 'me',
        summary: 'Retourne le profil courant',
        responses: { '200': { description: 'Profil' }, '401': error('Non authentifié') },
      },
    },
    '/auth/profile': {
      patch: {
        ...secured,
        tags: ['Profile'],
        operationId: 'updateProfile',
        summary: 'Modifie le nom du profil',
        requestBody: body('UpdateProfileInput'),
        responses: { '200': { description: 'Profil modifié' }, '401': error('Non authentifié') },
      },
    },
    '/auth/password': {
      patch: {
        ...secured,
        tags: ['Profile'],
        operationId: 'changePassword',
        summary: 'Change le mot de passe et révoque toutes les sessions',
        requestBody: body('ChangePasswordInput'),
        responses: { '200': { description: 'Mot de passe modifié' }, '401': error('Mot de passe actuel incorrect') },
      },
    },
    '/auth/email/change': {
      post: {
        ...secured,
        tags: ['Profile'],
        operationId: 'changeEmail',
        summary: 'Change l’email, révoque les sessions et demande une vérification',
        requestBody: body('ChangeEmailInput'),
        responses: { '200': { description: 'Adresse modifiée' }, '409': error('Adresse déjà utilisée') },
      },
    },
    '/auth/email/verification-notification': {
      post: {
        ...secured,
        tags: ['Profile'],
        operationId: 'resendVerification',
        summary: 'Renvoie le lien de vérification',
        responses: { '202': { description: 'Demande acceptée' }, '429': error('Limite atteinte') },
      },
    },
    '/auth/logout-all': {
      post: {
        ...secured,
        tags: ['Sessions'],
        operationId: 'logoutAll',
        summary: 'Révoque toutes les sessions',
        responses: { '200': { description: 'Toutes les sessions sont révoquées' } },
      },
    },
    '/auth/sessions': {
      get: {
        ...secured,
        tags: ['Sessions'],
        operationId: 'listSessions',
        summary: 'Liste les appareils connectés',
        responses: { '200': { description: 'Sessions actives' } },
      },
    },
    '/auth/sessions/{sessionId}': {
      delete: {
        ...secured,
        tags: ['Sessions'],
        operationId: 'revokeSession',
        summary: 'Révoque une session appartenant au compte',
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Session révoquée' }, '404': error('Session introuvable') },
      },
    },
    '/auth/account': {
      delete: {
        ...secured,
        tags: ['Profile'],
        operationId: 'deactivateAccount',
        summary: 'Désactive le compte après confirmation',
        requestBody: body('DeactivateAccountInput'),
        responses: {
          '200': { description: 'Compte désactivé' },
          '400': error('Confirmation invalide'),
          '401': error('Mot de passe actuel incorrect'),
          '403': error('Action interdite'),
        },
      },
    },
    '/users': {
      get: {
        ...secured,
        tags: ['Users administration'],
        operationId: 'listUsers',
        summary: 'Liste, filtre et pagine les utilisateurs',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            name: 'per_page',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
          { name: 'search', in: 'query', schema: { type: 'string', maxLength: 100 } },
          {
            name: 'role',
            in: 'query',
            schema: { type: 'string', enum: ['admin', 'teacher', 'learner'] },
          },
          { name: 'is_active', in: 'query', schema: { type: 'boolean' } },
          { name: 'is_verified', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: { '200': { description: 'Liste paginée' }, '403': error('Admin requis') },
      },
      post: {
        ...secured,
        tags: ['Users administration'],
        operationId: 'createUser',
        summary: 'Crée un utilisateur avec un rôle',
        requestBody: body('CreateUserInput'),
        responses: { '201': { description: 'Utilisateur créé' }, '409': error('Email utilisé') },
      },
    },
    '/users/{id}': {
      get: {
        ...secured,
        tags: ['Users administration'],
        operationId: 'showUser',
        summary: 'Affiche un utilisateur',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Utilisateur' }, '404': error('Introuvable') },
      },
    },
    '/users/{id}/role': {
      patch: {
        ...secured,
        tags: ['Users administration'],
        operationId: 'updateUserRole',
        summary: 'Modifie le rôle et révoque les sessions',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: body('UpdateUserRoleInput'),
        responses: { '200': { description: 'Rôle modifié' }, '403': error('Dernier admin protégé') },
      },
    },
    '/users/{id}/active': {
      patch: {
        ...secured,
        tags: ['Users administration'],
        operationId: 'updateUserStatus',
        summary: 'Active ou désactive un compte',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: body('UpdateUserActiveInput'),
        responses: { '200': { description: 'Statut modifié' }, '403': error('Action interdite') },
      },
    },
    '/users/{id}/revoke-sessions': {
      post: {
        ...secured,
        tags: ['Users administration'],
        operationId: 'adminRevokeSessions',
        summary: 'Révoque toutes les sessions d’un utilisateur',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Sessions révoquées' } },
      },
    },
    '/users/{id}/security-events': {
      get: {
        ...secured,
        tags: ['Users administration'],
        operationId: 'listSecurityEvents',
        summary: 'Liste les derniers événements d’authentification',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Événements' } },
      },
    },
    '/demo/authenticated': {
      get: {
        ...secured,
        tags: ['Authorization demos'],
        operationId: 'demoAuthenticated',
        summary: 'Démontre authenticate',
        responses: { '200': { description: 'Autorisé' }, '401': error('Non authentifié') },
      },
    },
    '/demo/verified': {
      get: {
        ...secured,
        tags: ['Authorization demos'],
        operationId: 'demoVerified',
        summary: 'Démontre requireVerifiedEmail',
        responses: { '200': { description: 'Autorisé' }, '403': error('Email non vérifié') },
      },
    },
    '/demo/admin': {
      get: {
        ...secured,
        tags: ['Authorization demos'],
        operationId: 'demoAdmin',
        summary: 'Démontre authorize(admin)',
        responses: { '200': { description: 'Autorisé' }, '403': error('Rôle insuffisant') },
      },
    },
    '/demo/teaching-team': {
      get: {
        ...secured,
        tags: ['Authorization demos'],
        operationId: 'demoTeachingTeam',
        summary: 'Démontre authorize(admin, teacher)',
        responses: { '200': { description: 'Autorisé' }, '403': error('Rôle insuffisant') },
      },
    },
  },
} as const
