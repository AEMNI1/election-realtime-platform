import type { FastifyPluginAsync } from 'fastify';
import { compare, hash } from 'bcryptjs';
import { changePasswordSchema, loginSchema } from '@election/shared';
import { db } from '../lib/db.js';
import { requireAppUser } from '../middleware/auth.js';

const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });

    const username = parsed.data.username.toLowerCase();
    const { data: user, error } = await db
      .from('users')
      .select('id,regional_office_id,username,password_hash,full_name,email,phone,role,local_bureau_id,active,must_change_password,failed_login_count,locked_until')
      .eq('username', username)
      .maybeSingle();

    const invalid = () => reply.code(401).send({ error: 'INVALID_CREDENTIALS', message: 'Username ou mot de passe incorrect.' });
    if (error || !user || !user.active) return invalid();

    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) return invalid();

    const ok = await compare(parsed.data.password, user.password_hash);
    if (!ok) {
      const nextFailures = (user.failed_login_count ?? 0) + 1;
      const lockUntil = nextFailures >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
      await db.from('users').update({ failed_login_count: nextFailures >= LOCK_AFTER ? 0 : nextFailures, locked_until: lockUntil, updated_at: new Date().toISOString() }).eq('id', user.id);
      return invalid();
    }

    const ttlHours = Math.max(1, Math.min(24, Number(process.env.TOKEN_TTL_HOURS ?? 12)));
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60_000).toISOString();
    const { data: session, error: sessionError } = await db.from('user_sessions').insert({
      user_id: user.id,
      expires_at: expiresAt,
      user_agent: request.headers['user-agent'] ?? null
    }).select('id').single();
    if (sessionError || !session) throw sessionError ?? new Error('Session creation failed');

    const accessToken = app.jwt.sign({ sub: user.id, sid: session.id, typ: 'access' }, { expiresIn: `${ttlHours}h` });
    const now = new Date().toISOString();
    await Promise.all([
      db.from('users').update({ failed_login_count: 0, locked_until: null, last_login_at: now, updated_at: now }).eq('id', user.id),
      db.from('audit_logs').insert({ regional_office_id: user.regional_office_id, user_id: user.id, action: 'LOGIN', entity_type: 'user', entity_id: user.id, metadata: { username: user.username } })
    ]);

    return {
      accessToken,
      expiresAt,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        local_bureau_id: user.local_bureau_id,
        active: user.active,
        must_change_password: user.must_change_password
      }
    };
  });

  app.post('/logout', async (request) => {
    const { appUser, sessionId } = await requireAppUser(request);
    const now = new Date().toISOString();
    await Promise.all([
      db.from('user_sessions').update({ revoked_at: now }).eq('id', sessionId),
      db.from('audit_logs').insert({ regional_office_id: appUser.regional_office_id, user_id: appUser.id, action: 'LOGOUT', entity_type: 'user', entity_id: appUser.id })
    ]);
    return { ok: true };
  });

  app.post('/change-password', async (request, reply) => {
    const { appUser } = await requireAppUser(request);
    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });

    const { data: row } = await db.from('users').select('password_hash').eq('id', appUser.id).single();
    if (!row || !(await compare(parsed.data.currentPassword, row.password_hash))) {
      return reply.code(400).send({ error: 'CURRENT_PASSWORD_INVALID', message: 'Mot de passe actuel incorrect.' });
    }
    if (parsed.data.currentPassword === parsed.data.newPassword) {
      return reply.code(400).send({ error: 'PASSWORD_UNCHANGED', message: 'Le nouveau mot de passe doit être différent.' });
    }

    const passwordHash = await hash(parsed.data.newPassword, 12);
    const now = new Date().toISOString();
    await db.from('users').update({ password_hash: passwordHash, must_change_password: false, password_changed_at: now, updated_at: now }).eq('id', appUser.id);
    await db.from('user_sessions').update({ revoked_at: now }).eq('user_id', appUser.id).is('revoked_at', null);
    await db.from('audit_logs').insert({ regional_office_id: appUser.regional_office_id, user_id: appUser.id, action: 'PASSWORD_CHANGED', entity_type: 'user', entity_id: appUser.id });
    return { ok: true, reloginRequired: true };
  });
};
