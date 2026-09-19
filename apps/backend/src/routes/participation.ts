import type { FastifyPluginAsync } from 'fastify';
import { participationConfirmSchema } from '@election/shared';
import { requireAppUser } from '../middleware/auth.js';

export const participationRoutes: FastifyPluginAsync = async (app) => {
  app.post('/confirm', async (request, reply) => {
    const { appUser, db } = await requireAppUser(request, ['OBSERVER']);
    const parsed = participationConfirmSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });

    if (parsed.data.localBureauId !== appUser.local_bureau_id) return reply.code(409).send({ error: 'STALE_BUREAU_ASSIGNMENT', message: 'Affectation du bureau modifiée. Rechargez la page.' });
    const { delta, operationUuid, deviceId } = parsed.data;
    const { data, error } = await db.rpc('confirm_participation_delta', {
      p_user_id: appUser.id,
      p_delta: delta,
      p_operation_uuid: operationUuid,
      p_device_id: deviceId
    });

    if (error) {
      request.log.warn({ err: error, operationUuid }, 'participation confirmation failed');
      const status = error.message.includes('observer') ? 403 : 409;
      return reply.code(status).send({ error: 'PARTICIPATION_CONFIRM_FAILED', message: error.message });
    }
    return { ok: true, currentCount: data, serverTime: new Date().toISOString() };
  });
};
