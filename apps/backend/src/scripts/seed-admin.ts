import 'dotenv/config';
import { hash } from 'bcryptjs';
import { db } from '../lib/db.js';

const username = (process.env.ADMIN_USERNAME ?? '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? '';
const fullName = (process.env.ADMIN_FULL_NAME ?? 'Administrateur régional').trim();
const officeName = (process.env.REGIONAL_OFFICE_NAME ?? 'Bureau régional de monitoring').trim();
const regionLabel = (process.env.REGION_LABEL ?? '').trim() || null;

if (!/^[A-Za-z0-9._-]{3,60}$/.test(username)) throw new Error('ADMIN_USERNAME invalide (3-60 caractères: lettres/chiffres/._-)');
if (password.length < 8) throw new Error('ADMIN_PASSWORD doit contenir au moins 8 caractères');

let { data: office, error: officeReadError } = await db.from('regional_offices').select('id,name').eq('active', true).limit(1).maybeSingle();
if (officeReadError) throw officeReadError;
if (!office) {
  const created = await db.from('regional_offices').insert({ name: officeName, region_label: regionLabel, active: true }).select('id,name').single();
  if (created.error) throw created.error;
  office = created.data;
}
await db.from('regional_settings').upsert({ regional_office_id: office.id, election_mode: 'PREPARATION', orange_minutes: 5, red_minutes: 15 }, { onConflict: 'regional_office_id' });

const { data: existing } = await db.from('users').select('id,username').eq('username', username).maybeSingle();
if (existing) throw new Error(`Le username ${username} existe déjà.`);

const passwordHash = await hash(password, 12);
const { data: admin, error } = await db.from('users').insert({
  regional_office_id: office.id,
  username,
  password_hash: passwordHash,
  full_name: fullName,
  role: 'REGIONAL_ADMIN',
  local_bureau_id: null,
  active: true,
  must_change_password: false,
  password_changed_at: new Date().toISOString()
}).select('id,username,full_name,role').single();
if (error) throw error;

await db.from('audit_logs').insert({ regional_office_id: office.id, user_id: admin.id, action: 'INITIAL_ADMIN_CREATED', entity_type: 'user', entity_id: admin.id, metadata: { username: admin.username } });
console.log('Administrateur régional créé avec succès:');
console.log({ office: office.name, username: admin.username, fullName: admin.full_name, role: admin.role });
