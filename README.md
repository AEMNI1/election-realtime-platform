# Election Realtime Platform — V4

Application métier temps réel pour un bureau régional qui supervise des bureaux locaux.

## Règles métier

- Un `REGIONAL_ADMIN` crée les bureaux locaux et les utilisateurs.
- Un bureau local peut avoir au maximum **un observateur actif**.
- Les utilisateurs sont dans `public.users` uniquement.
- Connexion : **Username + Password** ; mot de passe stocké sous forme `password_hash` bcrypt.
- Aucun compte Supabase Auth n'est créé pour les observateurs/admins.
- Le téléphone de l'observateur est visible dans les dashboards **Participation** et **Résultats** afin que le bureau régional puisse l'appeler.

## VOTING et COUNTING sont indépendants

### VOTING

Suit uniquement le nombre de personnes comptabilisées/entrées dans le bureau local : `+1 / -1 / CONFIRMER`.

### COUNTING

L'observateur saisit en une seule transmission les résultats ciblés :

- PAM
- PI
- RNI
- PJD
- USFP
- MP
- Rejetés / non comptabilisés

D'autres partis pouvant exister hors périmètre, **aucun total global de ces sept valeurs n'est affiché ni comparé à la participation**.

Le dashboard régional affiche sept cercles temps réel, un par parti/catégorie.

## Architecture

```text
Utilisateur
  -> Next.js frontend
  -> Fastify API (JWT application)
  -> Supabase PostgreSQL (service role backend uniquement)
  -> Supabase Realtime côté backend
  -> WebSocket Fastify authentifié
  -> dashboards temps réel
```

## Migration depuis V3.0.1

Les migrations V3 `0005` et `0006` étant déjà appliquées, exécuter seulement :

`supabase/migrations/0007_v4_multicategory_results.sql`

Cette migration conserve :

- utilisateurs et mots de passe ;
- bureaux locaux ;
- participation ;
- présence ;
- sessions et audit.

Elle remplace seulement l'ancien modèle de résultat unique.

Pour un projet Supabase totalement neuf, exécuter `supabase/FINAL_SCHEMA.sql`.

## Démarrage

```powershell
npm install
npm run dev:backend
```

Dans un second terminal :

```powershell
npm run dev:frontend
```

Frontend : `http://localhost:3000`
Backend health : `http://localhost:4000/health`

## Scénario de test V4

1. `REGIONAL_ADMIN` crée un bureau local et lui affecte un observateur avec téléphone.
2. Passer en `VOTING`.
3. L'observateur incrémente la participation ; le dashboard Participation affiche aussi son téléphone.
4. Passer en `COUNTING`.
5. L'observateur saisit PAM, PI, RNI, PJD, USFP, MP et Rejetés, puis confirme une seule fois.
6. Le dashboard Résultats affiche les sept cercles mis à jour et le téléphone des observateurs n'ayant pas encore transmis.
7. Aucun total global des sept résultats n'est calculé.
