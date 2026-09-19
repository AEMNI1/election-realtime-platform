import type { FastifyInstance } from 'fastify';
import { db } from './db.js';

export type RealtimeTopic = 'participation' | 'presence' | 'results' | 'settings' | 'admin';

type SocketLike = { readyState: number; send(data: string): void; close(code?: number, reason?: string): void; on(event: string, handler: (...args: any[]) => void): void };
type Client = { socket: SocketLike; userId: string; role: 'OBSERVER' | 'REGIONAL_ADMIN' };

export class RealtimeHub {
  private clients = new Set<Client>();
  private started = false;

  add(client: Client) { this.clients.add(client); }
  remove(socket: SocketLike) { for (const c of this.clients) if (c.socket === socket) this.clients.delete(c); }

  broadcast(topic: RealtimeTopic) {
    const body = JSON.stringify({ type: 'REFRESH', topic, at: new Date().toISOString() });
    for (const client of this.clients) {
      if (client.socket.readyState === 1) client.socket.send(body);
    }
  }

  async start() {
    if (this.started) return;
    this.started = true;
    const channel = db.channel('backend-election-changes');
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participation_counters' }, () => this.broadcast('participation'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'observer_presence' }, () => this.broadcast('presence'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bureau_result_submissions' }, () => this.broadcast('results'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bureau_result_values' }, () => this.broadcast('results'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'result_corrections' }, () => this.broadcast('results'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'regional_settings' }, () => this.broadcast('settings'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'local_bureaus' }, () => this.broadcast('admin'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => this.broadcast('admin'))
      .subscribe(status => {
        if (status !== 'SUBSCRIBED') console.warn('[realtime] Supabase status:', status);
      });
  }
}

export const realtimeHub = new RealtimeHub();

export function registerRealtimeRoute(app: FastifyInstance) {
  app.get('/ws', { websocket: true }, (socket) => {
    let authenticated = false;
    const timer = setTimeout(() => { if (!authenticated) socket.close(4401, 'Authentication timeout'); }, 10_000);

    socket.on('message', async (raw: unknown) => {
  try {
    const text = Buffer.isBuffer(raw)
      ? raw.toString('utf8')
      : String(raw);

    const message = JSON.parse(text);

    // suite de ton code...
  } catch (error) {
    console.error('WebSocket message error:', error);
  }
});

    socket.on('close', () => { clearTimeout(timer); realtimeHub.remove(socket as SocketLike); });
    socket.on('error', () => { clearTimeout(timer); realtimeHub.remove(socket as SocketLike); });
  });
}
