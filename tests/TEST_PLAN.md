# Test plan

## Functional

1. Observer A sees only bureau A.
2. Observer B cannot call RPC for bureau A.
3. +1 +1 +1 then Confirm gives exactly +3.
4. Same `operationUuid` twice is counted once.
5. Delta that would make count negative is rejected.
6. Offline participation is queued and sent once after reconnection.
7. Heartbeat distinguishes connected observer from no participation event.
8. Result field is disabled before `COUNTING`.
9. Result confirmation locks the field.
10. Confirmed result appears in regional constellation without refresh.
11. Correction request is visible to regional admin and original value remains auditable.
12. `COMPLETED` blocks normal participation/result submission.

## Security / RLS

- Anonymous role has no table/RPC access.
- Observer cannot select another bureau's counters, presence, result or events.
- Regional admin can read all local bureaux.
- No direct INSERT/UPDATE policy exists on critical tables.
- Service Role key is server-only.

## Concurrency / load

Staging target:

- 500 simultaneous observers.
- 10,000 participation operations.
- repeated UUID retries.
- intermittent network failures and reconnects.
- monitor PostgreSQL locks, API latency, Realtime delivery and error rate.

Expected invariant: no lost increment and no double-counted `operationUuid`.
