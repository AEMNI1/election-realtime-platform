import { getAccessToken } from './auth';

export type RealtimeTopic = 'participation' | 'presence' | 'results' | 'settings' | 'admin';

export function subscribeRealtime(onRefresh: (topic: RealtimeTopic) => void) {
  let stopped = false;
  let socket: WebSocket | null = null;
  let retry: number | undefined;
  let attempts = 0;

  const base = process.env.NEXT_PUBLIC_WS_URL || (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/^http/, 'ws');

  function connect() {
    if (stopped || !base) return;
    const token = getAccessToken();
    if (!token) return;
    socket = new WebSocket(`${base}/ws`);
    socket.onopen = () => {
      attempts = 0;
      socket?.send(JSON.stringify({ type: 'AUTH', token }));
    };
    socket.onmessage = event => {
      try {
        const message = JSON.parse(String(event.data));
        if (message?.type === 'REFRESH' && message?.topic) onRefresh(message.topic as RealtimeTopic);
      } catch { /* ignore malformed server events */ }
    };
    socket.onclose = () => {
      if (stopped) return;
      attempts += 1;
      const delay = Math.min(10_000, 1000 * Math.max(1, attempts));
      retry = window.setTimeout(connect, delay);
    };
    socket.onerror = () => socket?.close();
  }

  connect();
  return () => {
    stopped = true;
    if (retry) window.clearTimeout(retry);
    socket?.close();
  };
}
