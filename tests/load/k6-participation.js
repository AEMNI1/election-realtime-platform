// k6 run -e API_URL=http://localhost:4000 -e CREDENTIALS_FILE=credentials.json tests/load/k6-participation.js
// credentials.json: [{"username":"observer001","password":"Temp-2026!"}, ...]
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const credentials = new SharedArray('credentials', () => JSON.parse(open(__ENV.CREDENTIALS_FILE || './credentials.json')));
export const options = { vus: Math.min(credentials.length, 500), iterations: 10000, maxRedirects: 0 };

function login(cred) {
  const res = http.post(`${__ENV.API_URL}/api/auth/login`, JSON.stringify(cred), { headers: { 'content-type': 'application/json' } });
  check(res, { 'login 200': r => r.status === 200 });
  return res.json('accessToken');
}

export function setup() {
  return credentials.map(c => ({ token: login(c) }));
}

export default function (data) {
  const index = (__VU - 1) % data.length;
  const token = data[index].token;
  const me = http.get(`${__ENV.API_URL}/api/me`, { headers: { authorization: `Bearer ${token}` } });
  check(me, { 'me 200': r => r.status === 200 });
  const bureauId = me.json('bureau.id');
  const body = JSON.stringify({ localBureauId: bureauId, delta: 1, operationUuid: crypto.randomUUID(), deviceId: `k6-${__VU}` });
  const res = http.post(`${__ENV.API_URL}/api/participation/confirm`, body, { headers: { 'content-type':'application/json', authorization:`Bearer ${token}` } });
  check(res, { 'participation 200': r => r.status === 200 });
  sleep(0.05);
}
