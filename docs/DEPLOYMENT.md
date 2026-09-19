# Déploiement

## Supabase

Utilisé pour : PostgreSQL, sauvegardes, RPC PostgreSQL et Realtime server-side.

Le backend requiert :

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (ou clé secrète serveur compatible)

Aucune clé Supabase n'est requise dans le frontend.

## Backend Render

Variables :

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
TOKEN_TTL_HOURS=12
FRONTEND_ORIGIN=https://votre-frontend.vercel.app
BACKEND_PORT=4000
```

Build :

```text
npm install && npm run build --workspace @election/backend
```

Start :

```text
npm run start --workspace @election/backend
```

Le service doit supporter WebSocket sur `/ws`.

## Frontend Vercel

Variables :

```env
NEXT_PUBLIC_API_URL=https://votre-api.onrender.com
NEXT_PUBLIC_WS_URL=wss://votre-api.onrender.com
```

Build :

```text
npm install && npm run build --workspace @election/frontend
```
