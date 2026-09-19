# Backup and archival strategy

## Before election day

- Export configuration: regional office, local bureaux and `public.users` metadata.
- Take a Supabase database backup/snapshot according to the selected project plan.
- Keep the observer import source securely offline.

## During election day

- Do not run destructive migrations.
- Monitor database health, storage and API errors.
- Periodically export participation/results/audit from the regional dashboards as an operational copy.

## After completion

- Set `ELECTION_MODE=COMPLETED`.
- Export participation, results and audit.
- Take a final database backup.
- Restrict operational access and retain according to the organisation's retention policy.
