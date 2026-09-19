import type { FastifyPluginAsync } from 'fastify';
import { presenceSchema } from '@election/shared';
import { requireAppUser } from '../middleware/auth.js';

export const presenceRoutes: FastifyPluginAsync = async (app) => {
  app.post('/heartbeat', async (request, reply) => {
    const { appUser, db } = await requireAppUser(request, ['OBSERVER']);
    const parsed = presenceSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const { data, error } = await db.rpc('heartbeat_observer', {
      p_user_id: appUser.id,
      p_connection_status: parsed.data.connectionStatus
    });
    if (error) return reply.code(409).send({ error: 'HEARTBEAT_FAILED', message: error.message });
    return { ok: true, lastSeenAt: data };
  });
};
