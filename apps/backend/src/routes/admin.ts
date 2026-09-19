import type { FastifyPluginAsync } from 'fastify';
import { hash } from 'bcryptjs';
import {
  importObserversSchema,
  localBureauCreateSchema,
  localBureauUpdateSchema,
  resetPasswordSchema,
  userCreateSchema,
  userUpdateSchema
} from '@election/shared';
import { requireAppUser } from '../middleware/auth.js';

function normalizeCode(value: string) { return value.trim().toUpperCase(); }
function normalizeUsername(value: string) { return value.trim().toLowerCase(); }
function dbConflict(message: string) { return Object.assign(new Error(message), { statusCode: 409 }); }

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get('/bureaux', async (request) => {
    const { appUser, db } = await requireAppUser(request, ['REGIONAL_ADMIN']);
    const [bureausQ, observersQ] = await Promise.all([
      db.from('local_bureaus').select('id,code,name,address,active,created_at,updated_at').eq('regional_office_id', appUser.regional_office_id).order('code'),
      db.from('users').select('id,username,full_name,local_bureau_id,active').eq('regional_office_id', appUser.regional_office_id).eq('role', 'OBSERVER').eq('active', true)
    ]);
    if (bureausQ.error) throw bureausQ.error;
    if (observersQ.error) throw observersQ.error;
    const observers = new Map((observersQ.data ?? []).map(o => [o.local_bureau_id, o]));
    return { rows: (bureausQ.data ?? []).map(b => ({ ...b, observer: observers.get(b.id) ?? null })) };
  });

  app.post('/bureaux', async (request, reply) => {
    const { appUser, db } = await requireAppUser(request, ['REGIONAL_ADMIN']);
    const parsed = localBureauCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
    const code = normalizeCode(parsed.data.code);
    const { data, error } = await db.from('local_bureaus').insert({
      regional_office_id: appUser.regional_office_id,
      code,
      name: parsed.data.name,
      address: parsed.data.address || null,
      active: true
    }).select('id,code,name,address,active').single();
    if (error) {
      if (error.code === '23505') throw dbConflict('Ce code de bureau existe déjà dans le bureau régional.');
      throw error;
    }
    await db.from('audit_logs').insert({ regional_office_id: appUser.regional_office_id, user_id: appUser.id, action: 'LOCAL_BUREAU_CREATED', entity_type: 'local_bureau', entity_id: data.id, metadata: { code, name: data.name } });
    return reply.code(201).send({ ok: true, bureau: data });
  });

  app.patch('/bureaux/:id', async (request, reply) => {
    const { appUser, db } = await requireAppUser(request, ['REGIONAL_ADMIN']);
    const parsed = localBureauUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
    const id = (request.params as { id: string }).id;

    const { data: bureau } = await db.from('local_bureaus').select('id,active').eq('id', id).eq('regional_office_id', appUser.regional_office_id).maybeSingle();
    if (!bureau) return reply.code(404).send({ error: 'BUREAU_NOT_FOUND' });
    if (parsed.data.active === false) {
      const { data: observer } = await db.from('users').select('id').eq('local_bureau_id', id).eq('role', 'OBSERVER').eq('active', true).maybeSingle();
      if (observer) return reply.code(409).send({ error: 'BUREAU_HAS_ACTIVE_OBSERVER', message: 'Désactivez ou réaffectez d’abord l’observateur de ce bureau.' });
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.address !== undefined) patch.address = parsed.data.address || null;
    if (parsed.data.active !== undefined) patch.active = parsed.data.active;
    const { data, error } = await db.from('local_bureaus').update(patch).eq('id', id).eq('regional_office_id', appUser.regional_office_id).select('id,code,name,address,active').single();
    if (error) throw error;
    await db.from('audit_logs').insert({ regional_office_id: appUser.regional_office_id, user_id: appUser.id, action: 'LOCAL_BUREAU_UPDATED', entity_type: 'local_bureau', entity_id: id, metadata: patch });
    return { ok: true, bureau: data };
  });

  app.get('/users', async (request) => {
    const { appUser, db } = await requireAppUser(request, ['REGIONAL_ADMIN']);
    const { data, error } = await db.from('users')
      .select('id,username,full_name,email,phone,role,local_bureau_id,active,must_change_password,last_login_at,created_at')
      .eq('regional_office_id', appUser.regional_office_id)
      .order('role')
      .order('full_name');
    if (error) throw error;
    return { rows: data ?? [] };
  });

  app.post('/users', async (request, reply) => {
    const { appUser, db } = await requireAppUser(request, ['REGIONAL_ADMIN']);
    const parsed = userCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });

    if (parsed.data.role === 'OBSERVER') {
      const { data: bureau } = await db.from('local_bureaus').select('id,active').eq('id', parsed.data.localBureauId!).eq('regional_office_id', appUser.regional_office_id).maybeSingle();
      if (!bureau || !bureau.active) return reply.code(400).send({ error: 'INVALID_BUREAU', message: 'Bureau local inexistant ou inactif.' });
      const { data: assigned } = await db.from('users').select('id,full_name').eq('local_bureau_id', bureau.id).eq('role', 'OBSERVER').eq('active', true).maybeSingle();
      if (assigned) return reply.code(409).send({ error: 'BUREAU_ALREADY_ASSIGNED', message: `Ce bureau est déjà affecté à ${assigned.full_name}.` });
    }

    const passwordHash = await hash(parsed.data.password, 12);
    const { data, error } = await db.from('users').insert({
      regional_office_id: appUser.regional_office_id,
      username: normalizeUsername(parsed.data.username),
      password_hash: passwordHash,
      full_name: parsed.data.fullName,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      role: parsed.data.role,
      local_bureau_id: parsed.data.role === 'OBSERVER' ? parsed.data.localBureauId : null,
      active: parsed.data.active,
      must_change_password: true,
      created_by: appUser.id
    }).select('id,username,full_name,email,phone,role,local_bureau_id,active,must_change_password').single();
    if (error) {
      if (error.code === '23505') throw dbConflict('Username déjà utilisé ou bureau déjà affecté à un observateur actif.');
      throw error;
    }
    await db.from('audit_logs').insert({ regional_office_id: appUser.regional_office_id, user_id: appUser.id, action: 'USER_CREATED', entity_type: 'user', entity_id: data.id, metadata: { username: data.username, role: data.role, local_bureau_id: data.local_bureau_id } });
    return reply.code(201).send({ ok: true, user: data });
  });

  app.patch('/users/:id', async (request, reply) => {
    const { appUser, db } = await requireAppUser(request, ['REGIONAL_ADMIN']);
    const parsed = userUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
    const id = (request.params as { id: string }).id;
    const { data: target } = await db.from('users').select('id,role,local_bureau_id,active').eq('id', id).eq('regional_office_id', appUser.regional_office_id).maybeSingle();
    if (!target) return reply.code(404).send({ error: 'USER_NOT_FOUND' });

    let nextBureau = target.local_bureau_id;
    let nextActive = target.active;
    if (parsed.data.localBureauId !== undefined) nextBureau = parsed.data.localBureauId;
    if (parsed.data.active !== undefined) nextActive = parsed.data.active;

    if (target.role === 'OBSERVER') {
      if (!nextBureau) return reply.code(400).send({ error: 'BUREAU_REQUIRED', message: 'Un observateur doit être affecté à un bureau local.' });
      const { data: bureau } = await db.from('local_bureaus').select('id,active').eq('id', nextBureau).eq('regional_office_id', appUser.regional_office_id).maybeSingle();
      if (!bureau || !bureau.active) return reply.code(400).send({ error: 'INVALID_BUREAU' });
      if (nextActive) {
        const { data: assigned } = await db.from('users').select('id,full_name').eq('local_bureau_id', nextBureau).eq('role', 'OBSERVER').eq('active', true).neq('id', id).maybeSingle();
        if (assigned) return reply.code(409).send({ error: 'BUREAU_ALREADY_ASSIGNED', message: `Ce bureau est déjà affecté à ${assigned.full_name}.` });
      }
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.fullName !== undefined) patch.full_name = parsed.data.fullName;
    if (parsed.data.phone !== undefined) patch.phone = parsed.data.phone || null;
    if (parsed.data.email !== undefined) patch.email = parsed.data.email || null;
    if (parsed.data.localBureauId !== undefined && target.role === 'OBSERVER') patch.local_bureau_id = parsed.data.localBureauId;
    if (parsed.data.active !== undefined) patch.active = parsed.data.active;

    const { data, error } = await db.from('users').update(patch).eq('id', id).eq('regional_office_id', appUser.regional_office_id).select('id,username,full_name,email,phone,role,local_bureau_id,active,must_change_password').single();
    if (error) {
      if (error.code === '23505') throw dbConflict('Ce bureau possède déjà un observateur actif.');
      throw error;
    }
    if (parsed.data.active === false) await db.from('user_sessions').update({ revoked_at: new Date().toISOString() }).eq('user_id', id).is('revoked_at', null);
    await db.from('audit_logs').insert({ regional_office_id: appUser.regional_office_id, user_id: appUser.id, action: 'USER_UPDATED', entity_type: 'user', entity_id: id, metadata: patch });
    return { ok: true, user: data };
  });

  app.post('/users/:id/reset-password', async (request, reply) => {
    const { appUser, db } = await requireAppUser(request, ['REGIONAL_ADMIN']);
    const parsed = resetPasswordSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const id = (request.params as { id: string }).id;
    const { data: target } = await db.from('users').select('id').eq('id', id).eq('regional_office_id', appUser.regional_office_id).maybeSingle();
    if (!target) return reply.code(404).send({ error: 'USER_NOT_FOUND' });
    const passwordHash = await hash(parsed.data.password, 12);
    const now = new Date().toISOString();
    await db.from('users').update({ password_hash: passwordHash, must_change_password: true, password_changed_at: now, updated_at: now }).eq('id', id);
    await db.from('user_sessions').update({ revoked_at: now }).eq('user_id', id).is('revoked_at', null);
    await db.from('audit_logs').insert({ regional_office_id: appUser.regional_office_id, user_id: appUser.id, action: 'PASSWORD_RESET_BY_ADMIN', entity_type: 'user', entity_id: id });
    return { ok: true };
  });

  app.post('/import-observers', async (request, reply) => {
    const { appUser, db } = await requireAppUser(request, ['REGIONAL_ADMIN']);
    const parsed = importObserversSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });

    const results: Array<Record<string, unknown>> = [];
    for (const row of parsed.data.rows) {
      try {
        const code = normalizeCode(row.bureauCode);
        let { data: bureau } = await db.from('local_bureaus').select('id,code,name,active').eq('regional_office_id', appUser.regional_office_id).eq('code', code).maybeSingle();
        if (!bureau) {
          const created = await db.from('local_bureaus').insert({ regional_office_id: appUser.regional_office_id, code, name: row.bureauName, address: row.bureauAddress || null, active: true }).select('id,code,name,active').single();
          if (created.error) throw created.error;
          bureau = created.data;
        }
        if (!bureau.active) throw new Error('Bureau local inactif');

        const { data: assigned } = await db.from('users').select('id,full_name').eq('local_bureau_id', bureau.id).eq('role', 'OBSERVER').eq('active', true).maybeSingle();
        if (assigned) {
          results.push({ bureauCode: code, username: row.username, observerName: row.observerName, status: 'SKIPPED', message: `Bureau déjà affecté à ${assigned.full_name}` });
          continue;
        }

        const passwordHash = await hash(row.password, 12);
        const inserted = await db.from('users').insert({
          regional_office_id: appUser.regional_office_id,
          username: normalizeUsername(row.username),
          password_hash: passwordHash,
          full_name: row.observerName,
          email: row.email || null,
          phone: row.phone || null,
          role: 'OBSERVER',
          local_bureau_id: bureau.id,
          active: true,
          must_change_password: true,
          created_by: appUser.id
        }).select('id,username').single();
        if (inserted.error) throw inserted.error;
        await db.from('audit_logs').insert({ regional_office_id: appUser.regional_office_id, user_id: appUser.id, action: 'OBSERVER_IMPORTED', entity_type: 'user', entity_id: inserted.data.id, metadata: { username: inserted.data.username, bureau_code: code } });
        results.push({ bureauCode: code, username: inserted.data.username, observerName: row.observerName, status: 'CREATED' });
      } catch (error) {
        results.push({ bureauCode: row.bureauCode, username: row.username, observerName: row.observerName, status: 'ERROR', message: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return {
      ok: true,
      created: results.filter(r => r.status === 'CREATED').length,
      skipped: results.filter(r => r.status === 'SKIPPED').length,
      errors: results.filter(r => r.status === 'ERROR').length,
      results
    };
  });
};
