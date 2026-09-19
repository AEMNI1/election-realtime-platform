# Sécurité

- Login : `username + password` uniquement.
- Mot de passe : bcrypt cost 12, jamais stocké en clair.
- Verrouillage temporaire après échecs de connexion répétés.
- JWT signé par le backend + session serveur révocable (`user_sessions`).
- RBAC : `OBSERVER`, `REGIONAL_ADMIN`.
- Un observateur ne peut agir que sur le bureau indiqué dans `public.users.local_bureau_id`.
- Les RPC PostgreSQL revalident rôle, compte actif, bureau et phase de l'élection.
- Un index partiel PostgreSQL interdit deux observateurs actifs sur le même bureau.
- `SUPABASE_SERVICE_ROLE_KEY` n'existe que côté backend.
- RLS activé ; aucun accès direct `anon`/`authenticated` aux tables métier.
- Realtime Supabase est consommé côté serveur puis transformé en simples notifications de refresh WebSocket.
