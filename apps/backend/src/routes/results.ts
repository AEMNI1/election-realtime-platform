import type { FastifyPluginAsync } from 'fastify';
import { bureauResultSchema, correctionRequestSchema, correctionResolveSchema } from '@election/shared';
import { requireAppUser } from '../middleware/auth.js';

export const resultRoutes: FastifyPluginAsync = async (app) => {
  app.post('/confirm', async (request, reply) => {
    const { appUser, db } = await requireAppUser(request, ['OBSERVER']);
    const parsed = bureauResultSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });

    if (parsed.data.localBureauId !== appUser.local_bureau_id) {
      return reply.code(409).send({ error: 'STALE_BUREAU_ASSIGNMENT', message: 'Affectation du bureau modifiée. Rechargez la page.' });
    }

    const { data, error } = await db.rpc('confirm_bureau_results', {
      p_user_id: appUser.id,
      p_operation_uuid: parsed.data.operationUuid,
      p_results: parsed.data.results
    });
    if (error) return reply.code(409).send({ error: 'RESULT_CONFIRM_FAILED', message: error.message });

    const submission = Array.isArray(data) ? data[0] : data;
    const { data: values, error: valuesError } = await db
      .from('bureau_result_values')
      .select('category_code,votes')
      .eq('submission_id', submission.id);
    if (valuesError) throw valuesError;

    return {
      ok: true,
      result: {
        ...submission,
        values: Object.fromEntries((values ?? []).map(v => [v.category_code, v.votes])),
        corrections: []
      }
    };
  });

  app.post('/corrections', async (request, reply) => {
    const { appUser, db } = await requireAppUser(request, ['OBSERVER', 'REGIONAL_ADMIN']);
    const parsed = correctionRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });

    const { data, error } = await db.rpc('request_result_correction', {
      p_user_id: appUser.id,
      p_submission_id: parsed.data.submissionId,
      p_category_code: parsed.data.categoryCode,
      p_proposed_votes: parsed.data.proposedVotes,
      p_reason: parsed.data.reason
    });
    if (error) return reply.code(409).send({ error: 'CORRECTION_REQUEST_FAILED', message: error.message });
    return { ok: true, correction: data };
  });

  app.post('/corrections/:id/resolve', async (request, reply) => {
    const { appUser, db } = await requireAppUser(request, ['REGIONAL_ADMIN']);
    const parsed = correctionResolveSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const id = (request.params as { id: string }).id;
    const { data, error } = await db.rpc('resolve_result_correction', {
      p_user_id: appUser.id,
      p_correction_id: id,
      p_approve: parsed.data.approve
    });
    if (error) return reply.code(409).send({ error: 'CORRECTION_RESOLVE_FAILED', message: error.message });
    return { ok: true, correction: data };
  });
};
