import type { FastifyPluginAsync } from 'fastify';
import { electionModeSchema, RESULT_CATEGORY_CODES } from '@election/shared';
import { requireAppUser } from '../middleware/auth.js';

function byKey(rows: any[] | null, key: string) {
  return new Map((rows ?? []).map((row: any) => [row[key], row]));
}

const zeroTotals = () => Object.fromEntries(RESULT_CATEGORY_CODES.map(code => [code, 0]));

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/participation', async (request) => {
    const { appUser, db } = await requireAppUser(request, ['REGIONAL_ADMIN']);
    const [bureausQ, observersQ, settingsQ] = await Promise.all([
      db.from('local_bureaus').select('id,code,name,address,active').eq('regional_office_id', appUser.regional_office_id).eq('active', true).order('code'),
      db.from('users').select('id,username,full_name,phone,local_bureau_id,active').eq('regional_office_id', appUser.regional_office_id).eq('role', 'OBSERVER').eq('active', true),
      db.from('regional_settings').select('election_mode,orange_minutes,red_minutes').eq('regional_office_id', appUser.regional_office_id).maybeSingle()
    ]);
    for (const q of [bureausQ, observersQ, settingsQ]) if (q.error) throw q.error;

    const bureauIds = (bureausQ.data ?? []).map(b => b.id);
    let counters: any[] = [], presence: any[] = [];
    if (bureauIds.length) {
      const [countersQ, presenceQ] = await Promise.all([
        db.from('participation_counters').select('local_bureau_id,current_count,updated_at').in('local_bureau_id', bureauIds),
        db.from('observer_presence').select('observer_id,local_bureau_id,last_seen_at,connection_status').in('local_bureau_id', bureauIds)
      ]);
      if (countersQ.error) throw countersQ.error;
      if (presenceQ.error) throw presenceQ.error;
      counters = countersQ.data ?? [];
      presence = presenceQ.data ?? [];
    }

    const counterMap = byKey(counters, 'local_bureau_id');
    const observerMap = byKey(observersQ.data, 'local_bureau_id');
    const presenceMap = byKey(presence, 'local_bureau_id');

    return {
      electionMode: settingsQ.data?.election_mode ?? 'PREPARATION',
      thresholds: { orange_minutes: settingsQ.data?.orange_minutes ?? 5, red_minutes: settingsQ.data?.red_minutes ?? 15 },
      serverTime: new Date().toISOString(),
      bureaus: (bureausQ.data ?? []).map(b => ({
        ...b,
        observer: observerMap.get(b.id) ?? null,
        currentCount: counterMap.get(b.id)?.current_count ?? 0,
        counterUpdatedAt: counterMap.get(b.id)?.updated_at ?? null,
        presence: presenceMap.get(b.id) ?? null
      }))
    };
  });

  app.get('/results', async (request) => {
    const { appUser, db } = await requireAppUser(request, ['REGIONAL_ADMIN']);
    const [bureausQ, observersQ, settingQ, categoriesQ] = await Promise.all([
      db.from('local_bureaus').select('id,code,name,address,active').eq('regional_office_id', appUser.regional_office_id).eq('active', true).order('code'),
      db.from('users').select('id,username,full_name,phone,local_bureau_id').eq('regional_office_id', appUser.regional_office_id).eq('role', 'OBSERVER').eq('active', true),
      db.from('regional_settings').select('election_mode').eq('regional_office_id', appUser.regional_office_id).maybeSingle(),
      db.from('result_categories').select('code,label,category_type,display_order').eq('active', true).order('display_order')
    ]);
    for (const q of [bureausQ, observersQ, settingQ, categoriesQ]) if (q.error) throw q.error;

    const bureauIds = (bureausQ.data ?? []).map(b => b.id);
    let submissions: any[] = [], valuesRows: any[] = [], correctionsRows: any[] = [];
    if (bureauIds.length) {
      const submissionsQ = await db.from('bureau_result_submissions').select('id,local_bureau_id,observer_id,status,submitted_at,confirmed_at,updated_at').in('local_bureau_id', bureauIds);
      if (submissionsQ.error) throw submissionsQ.error;
      submissions = submissionsQ.data ?? [];
      const submissionIds = submissions.map(s => s.id);
      if (submissionIds.length) {
        const [valuesQ, correctionsQ] = await Promise.all([
          db.from('bureau_result_values').select('submission_id,category_code,votes').in('submission_id', submissionIds),
          db.from('result_corrections').select('id,submission_id,category_code,old_value,proposed_value,reason,status,created_at').in('submission_id', submissionIds).eq('status', 'PENDING')
        ]);
        if (valuesQ.error) throw valuesQ.error;
        if (correctionsQ.error) throw correctionsQ.error;
        valuesRows = valuesQ.data ?? [];
        correctionsRows = correctionsQ.data ?? [];
      }
    }

    const observers = byKey(observersQ.data, 'local_bureau_id');
    const submissionsByBureau = byKey(submissions, 'local_bureau_id');
    const valuesBySubmission = new Map<string, Record<string, number>>();
    for (const row of valuesRows) {
      const bucket = valuesBySubmission.get(row.submission_id) ?? {};
      bucket[row.category_code] = row.votes;
      valuesBySubmission.set(row.submission_id, bucket);
    }
    const correctionsBySubmission = new Map<string, any[]>();
    for (const row of correctionsRows) {
      const bucket = correctionsBySubmission.get(row.submission_id) ?? [];
      bucket.push(row);
      correctionsBySubmission.set(row.submission_id, bucket);
    }

    const categoryTotals: Record<string, number> = zeroTotals();
    for (const row of valuesRows) categoryTotals[row.category_code] = (categoryTotals[row.category_code] ?? 0) + Number(row.votes ?? 0);

    return {
      electionMode: settingQ.data?.election_mode ?? 'PREPARATION',
      serverTime: new Date().toISOString(),
      categories: categoriesQ.data ?? [],
      categoryTotals,
      bureaus: (bureausQ.data ?? []).map(b => {
        const submission = submissionsByBureau.get(b.id) ?? null;
        return {
          ...b,
          observer: observers.get(b.id) ?? null,
          result: submission ? {
            ...submission,
            values: valuesBySubmission.get(submission.id) ?? zeroTotals(),
            corrections: correctionsBySubmission.get(submission.id) ?? []
          } : null
        };
      })
    };
  });

  app.get('/audit', async (request) => {
    const { appUser, db } = await requireAppUser(request, ['REGIONAL_ADMIN']);
    const { data, error } = await db.from('audit_logs').select('id,user_id,action,entity_type,entity_id,metadata,created_at').eq('regional_office_id', appUser.regional_office_id).order('created_at', { ascending: false }).limit(10000);
    if (error) throw error;
    return { rows: data ?? [] };
  });

  app.get('/evolution', async (request) => {
    const { appUser, db } = await requireAppUser(request, ['REGIONAL_ADMIN']);
    const { data: bureaus, error: bureauError } = await db.from('local_bureaus').select('id').eq('regional_office_id', appUser.regional_office_id);
    if (bureauError) throw bureauError;
    const ids = (bureaus ?? []).map(b => b.id);
    if (!ids.length) return { points: [] };
    const { data, error } = await db.from('participation_events').select('created_at,delta,local_bureau_id').in('local_bureau_id', ids).order('created_at', { ascending: true }).limit(50000);
    if (error) throw error;
    let cumulative = 0;
    const points = (data ?? []).map((event: any) => {
      cumulative += event.delta;
      return { at: event.created_at, total: cumulative, localBureauId: event.local_bureau_id };
    });
    return { points };
  });

  app.post('/election-mode', async (request, reply) => {
    const { appUser, db } = await requireAppUser(request, ['REGIONAL_ADMIN']);
    const parsed = electionModeSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const { data, error } = await db.rpc('set_election_mode', { p_user_id: appUser.id, p_mode: parsed.data.mode });
    if (error) return reply.code(409).send({ error: 'MODE_CHANGE_FAILED', message: error.message });
    return { ok: true, mode: data };
  });
};
