# Database V4

## Core model

```text
regional_offices
  -> regional_settings
  -> local_bureaus
       -> users (one active OBSERVER max per bureau)
       -> participation_counters
       -> participation_events
       -> observer_presence
       -> bureau_result_submissions
            -> bureau_result_values
            -> result_corrections
```

## Participation

`participation_counters` and `participation_events` concern only the VOTING phase: number of people counted at the local bureau.

## Results

COUNTING uses `bureau_result_submissions` + `bureau_result_values`.

Tracked categories are stored in `result_categories`:

- PAM
- PI
- RNI
- PJD
- USFP
- MP
- REJECTED (Rejetés / non comptabilisés)

No total of these seven categories is stored because other parties may exist outside the application's tracking scope.

`confirm_bureau_results` validates and writes all seven values atomically in one PostgreSQL transaction.
