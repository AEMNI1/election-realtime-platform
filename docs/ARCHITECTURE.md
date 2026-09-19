# Architecture finale

```text
REGIONAL_ADMIN
  -> crée N bureaux locaux
  -> chaque bureau local -> 0 ou 1 OBSERVER actif

OBSERVER
  -> participation atomique
  -> heartbeat
  -> résultat final du parti
  -> demande de correction

Fastify
  -> Username/Password
  -> bcrypt
  -> JWT + user_sessions
  -> RBAC
  -> Supabase service role
  -> PostgreSQL RPC atomiques
  -> Supabase Realtime server-side
  -> WebSocket refresh events

Dashboard régional
  -> participation
  -> présence
  -> résultats/constellation
  -> corrections
  -> contrôle des phases
  -> administration
```

Le frontend ne possède pas de Supabase Auth ni de Supabase Data API client.
