# Election Day Runbook

## 1. PREPARATION

- Vérifier Supabase, backend `/health` et frontend.
- Vérifier qu'un `public.users` OBSERVER actif est affecté à chaque bureau local.
- Faire connecter tous les observateurs.
- Vérifier les heartbeats dans `/dashboard/participation`.
- Tester un scénario hors connexion puis reconnexion.

## 2. VOTING

Depuis `/dashboard/control`, passer en `VOTING`.

- Les boutons +1/-1 deviennent actifs.
- Surveiller les totaux et les dernières présences.
- Traiter les bureaux inactifs sans considérer automatiquement qu'absence d'incrément = absence d'observateur.

## 3. COUNTING

Après clôture du scrutin, passer en `COUNTING`.

- La participation est désactivée.
- Le champ résultat du parti devient actif chez chaque observateur.
- Chaque confirmation apparaît immédiatement dans la constellation.
- Traiter les demandes de correction depuis le dashboard résultats.

## 4. COMPLETED

Quand tous les résultats sont reçus et les corrections traitées :

- Vérifier le total final régional interne.
- Passer en `COMPLETED`.
- Conserver les exports/audits et une sauvegarde de la base.

Les données restent internes au parti et ne constituent pas une proclamation officielle.
