# AGENTS.md — Election Realtime Platform Final V3

## Non-negotiable business rules

1. Authentication is application-owned: `Username + Password` only.
2. Do not create per-user Supabase Auth accounts.
3. Business users live in `public.users`.
4. Never store or log plaintext passwords; only bcrypt `password_hash` in DB.
5. Roles: `OBSERVER`, `REGIONAL_ADMIN`.
6. REGIONAL_ADMIN may create local bureaux.
7. Each active local bureau may have at most one active OBSERVER.
8. OBSERVER bureau assignment comes from `public.users.local_bureau_id`; client-supplied bureau id is never authority.
9. Participation writes must remain atomic and idempotent with `operation_uuid`.
10. Results are immutable after confirmation except through the audited correction workflow.
11. No voter personal data may be collected.
12. Internal results must never be described as official election results.
13. Supabase service/secret key is backend-only.
14. Browser accesses business data only through Fastify API + application JWT.
15. Realtime: Supabase server-side subscription -> backend authenticated WebSocket -> frontend refresh.

## Election phases

- PREPARATION: connection tests only.
- VOTING: participation counter active.
- COUNTING: result entry active; participation closed.
- COMPLETED: normal writes locked.
