import type { FastifyPluginAsync } from 'fastify';
import { requireAppUser } from '../middleware/auth.js';

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const { appUser, db } = await requireAppUser(request);
    const { data: setting } = await db.from('regional_settings').select('election_mode,orange_minutes,red_minutes').eq('regional_office_id', appUser.regional_office_id).maybeSingle();
    const electionMode = setting?.election_mode ?? 'PREPARATION';

    if (appUser.role === 'REGIONAL_ADMIN') {
      return { user: appUser, electionMode, bureau: null, participation: null, result: null, presence: null };
    }

    const bureauId = appUser.local_bureau_id!;
    const [{ data: bureau }, { data: counter }, { data: submission }, { data: presence }] = await Promise.all([
      db.from('local_bureaus').select('id,code,name,address,active').eq('id', bureauId).single(),
      db.from('participation_counters').select('current_count,updated_at').eq('local_bureau_id', bureauId).maybeSingle(),
      db.from('bureau_result_submissions').select('id,local_bureau_id,observer_id,status,submitted_at,confirmed_at,updated_at').eq('local_bureau_id', bureauId).maybeSingle(),
      db.from('observer_presence').select('last_seen_at,connection_status').eq('observer_id', appUser.id).maybeSingle()
    ]);

    let result = null;
    if (submission) {
      const [{ data: values, error: valuesError }, { data: corrections, error: correctionsError }] = await Promise.all([
        db.from('bureau_result_values').select('category_code,votes').eq('submission_id', submission.id),
        db.from('result_corrections').select('id,submission_id,category_code,old_value,proposed_value,reason,status,created_at').eq('submission_id', submission.id).eq('status', 'PENDING')
      ]);
      if (valuesError) throw valuesError;
      if (correctionsError) throw correctionsError;
      result = {
        ...submission,
        values: Object.fromEntries((values ?? []).map(v => [v.category_code, v.votes])),
        corrections: corrections ?? []
      };
    }

    return {
      user: appUser,
      electionMode,
      bureau,
      participation: { currentCount: counter?.current_count ?? 0, updatedAt: counter?.updated_at ?? null },
      result,
      presence: presence ?? null
    };
  });
};
