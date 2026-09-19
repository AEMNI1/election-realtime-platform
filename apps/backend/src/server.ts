import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';

import { authRoutes } from './routes/auth.js';
import { participationRoutes } from './routes/participation.js';
import { resultRoutes } from './routes/results.js';
import { presenceRoutes } from './routes/presence.js';
import { meRoutes } from './routes/me.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { adminRoutes } from './routes/admin.js';

import {
  realtimeHub,
  registerRealtimeRoute
} from './lib/realtime.js';

/* =========================================================
   1. Vérification des variables obligatoires
========================================================= */

const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET'
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing environment variable: ${key}`);
  }
}

if ((process.env.JWT_SECRET ?? '').length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

/* =========================================================
   2. Création Fastify
========================================================= */

const app = Fastify({
  logger: {
    redact: [
      'req.headers.authorization',
      'req.body.password',
      'req.body.currentPassword',
      'req.body.newPassword',
      'req.body.rows[*].password'
    ]
  }
});

/* =========================================================
   3. WebSocket
   Doit être enregistré avant les routes WebSocket
========================================================= */

await app.register(websocket);

/* =========================================================
   4. JWT
========================================================= */

await app.register(jwt, {
  secret: process.env.JWT_SECRET!
});

/* =========================================================
   5. Sécurité HTTP
========================================================= */

await app.register(helmet, {
  contentSecurityPolicy: false
});

/* =========================================================
   6. CORS
   Compatible :
   - localhost
   - Vercel production
   - plusieurs domaines Vercel si besoin

   Railway :
   FRONTEND_ORIGIN=https://xxx.vercel.app

   Ou plusieurs :
   FRONTEND_ORIGIN=https://xxx.vercel.app,https://yyy.vercel.app
========================================================= */

const allowedOrigins = [
  'http://localhost:3000',

  ...(process.env.FRONTEND_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
];

app.log.info(
  { allowedOrigins },
  'Allowed CORS origins'
);

await app.register(cors, {
  origin: (origin, callback) => {
    /*
      Requêtes sans "Origin":
      - PowerShell
      - Postman
      - Railway health check
      - appels serveur à serveur
    */
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    app.log.warn(
      { origin },
      'CORS origin rejected'
    );

    callback(
      new Error(`CORS origin not allowed: ${origin}`),
      false
    );
  },

  credentials: false,

  methods: [
    'GET',
    'HEAD',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS'
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization'
  ]
});

/* =========================================================
   7. Rate limiting
========================================================= */

await app.register(rateLimit, {
  max: 180,
  timeWindow: '1 minute'
});

/* =========================================================
   8. Health Check
========================================================= */

app.get('/health', async () => {
  return {
    ok: true,
    service: 'election-backend',
    version: '4.0.0',
    auth: 'username-password'
  };
});

/* =========================================================
   9. WebSocket / Realtime
========================================================= */

registerRealtimeRoute(app);

/* =========================================================
   10. Routes API
========================================================= */

await app.register(authRoutes, {
  prefix: '/api/auth'
});

await app.register(meRoutes, {
  prefix: '/api/me'
});

await app.register(participationRoutes, {
  prefix: '/api/participation'
});

await app.register(presenceRoutes, {
  prefix: '/api/presence'
});

await app.register(resultRoutes, {
  prefix: '/api/results'
});

await app.register(dashboardRoutes, {
  prefix: '/api/dashboard'
});

await app.register(adminRoutes, {
  prefix: '/api/admin'
});

/* =========================================================
   11. Gestion globale des erreurs
========================================================= */

app.setErrorHandler((error, request, reply) => {
  const err =
    error instanceof Error
      ? error
      : new Error('Unknown error');

  const statusCode =
    typeof (error as { statusCode?: unknown })?.statusCode === 'number'
      ? (error as { statusCode: number }).statusCode
      : 500;

  request.log.error(error);

  return reply.status(statusCode).send({
    error:
      statusCode >= 500
        ? 'INTERNAL_ERROR'
        : 'REQUEST_ERROR',

    message:
      statusCode >= 500
        ? 'Erreur interne'
        : err.message
  });
});

/* =========================================================
   12. Démarrage Supabase Realtime
========================================================= */

await realtimeHub.start();

/* =========================================================
   13. Port Railway / Local
========================================================= */

const port = Number(
  process.env.PORT ??
  process.env.BACKEND_PORT ??
  4000
);

/* =========================================================
   14. Démarrage du serveur
========================================================= */

try {
  await app.listen({
    host: '0.0.0.0',
    port
  });

  app.log.info(
    {
      port,
      environment: process.env.NODE_ENV ?? 'development'
    },
    'Election backend started'
  );
} catch (error) {
  app.log.error(error);
  process.exit(1);
}