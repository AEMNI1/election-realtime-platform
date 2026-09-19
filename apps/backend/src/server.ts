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
import { realtimeHub, registerRealtimeRoute } from './lib/realtime.js';

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];
for (const key of required) if (!process.env[key]) throw new Error(`Missing environment variable: ${key}`);
if ((process.env.JWT_SECRET ?? '').length < 32) throw new Error('JWT_SECRET must be at least 32 characters');

const app = Fastify({ logger: { redact: ['req.headers.authorization', 'req.body.password', 'req.body.currentPassword', 'req.body.newPassword', 'req.body.rows[*].password'] } });

// websocket must be registered before routes.
await app.register(websocket);
await app.register(jwt, { secret: process.env.JWT_SECRET! });
await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cors, { origin: process.env.FRONTEND_ORIGIN?.split(',').map(v => v.trim()).filter(Boolean) ?? false, credentials: false });
await app.register(rateLimit, { max: 180, timeWindow: '1 minute' });

app.get('/health', async () => ({ ok: true, service: 'election-backend', version: '4.0.0', auth: 'username-password' }));
registerRealtimeRoute(app);
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(meRoutes, { prefix: '/api/me' });
await app.register(participationRoutes, { prefix: '/api/participation' });
await app.register(presenceRoutes, { prefix: '/api/presence' });
await app.register(resultRoutes, { prefix: '/api/results' });
await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
await app.register(adminRoutes, { prefix: '/api/admin' });

app.setErrorHandler((error, request, reply) => {
  const err = error instanceof Error
    ? error
    : new Error('Unknown error');

  const statusCode =
    typeof (error as { statusCode?: unknown })?.statusCode === 'number'
      ? (error as { statusCode: number }).statusCode
      : 500;

  request.log.error(error);

  return reply.status(statusCode).send({
    error: statusCode === 500 ? 'INTERNAL_ERROR' : err.message,
    message: statusCode === 500 ? 'Erreur interne' : err.message
  });
});

await realtimeHub.start();
const port = Number(
  process.env.PORT ??
  process.env.BACKEND_PORT ??
  4000
);
await app.listen({ host: '0.0.0.0', port });
