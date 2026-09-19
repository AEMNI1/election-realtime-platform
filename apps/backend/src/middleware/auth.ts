import type { FastifyRequest } from 'fastify';
import { db } from '../lib/db.js';

export type AppRole = 'OBSERVER' | 'REGIONAL_ADMIN';
export type AppUser = {
  id: string;
  regional_office_id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: AppRole;
  local_bureau_id: string | null;
  active: boolean;
  must_change_password: boolean;
};

type TokenPayload = { sub: string; sid: string; typ: 'access' };

function httpError(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode });
}

export async function requireAppUser(request: FastifyRequest, allowedRoles?: AppRole[]) {
  let token: TokenPayload;
  try {
    token = await request.jwtVerify<TokenPayload>();
  } catch {
    throw httpError(401, 'Unauthorized');
  }

  if (!token?.sub || !token?.sid || token.typ !== 'access') throw httpError(401, 'Unauthorized');

  const { data: session, error: sessionError } = await db
    .from('user_sessions')
    .select('id,user_id,expires_at,revoked_at')
    .eq('id', token.sid)
    .eq('user_id', token.sub)
    .maybeSingle();

  if (sessionError || !session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
    throw httpError(401, 'Session expirée');
  }

  const { data: appUser, error: userError } = await db
    .from('users')
    .select('id,regional_office_id,username,full_name,email,phone,role,local_bureau_id,active,must_change_password')
    .eq('id', token.sub)
    .eq('active', true)
    .maybeSingle();

  if (userError || !appUser) throw httpError(401, 'Compte inactif ou introuvable');
  if (allowedRoles && !allowedRoles.includes(appUser.role as AppRole)) throw httpError(403, 'Forbidden');

  return { appUser: appUser as AppUser, sessionId: session.id, db };
}
