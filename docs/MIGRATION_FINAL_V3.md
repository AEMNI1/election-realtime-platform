# Migration V2 -> Final V3

## Avant migration

Cette migration est volontairement destructive pour les données métier/test de la V2, car les anciens utilisateurs étaient liés à `auth.users` et ne possèdent pas de `password_hash` applicatif récupérable.

Faire un backup si des données V2 doivent être conservées.

## Ordre

Dans Supabase SQL Editor :

1. `0005_final_custom_auth.sql`
2. `0006_final_security_realtime.sql`

Ne créez plus aucun utilisateur dans Supabase Authentication.

## Après migration

Créer le premier administrateur avec :

```powershell
npm run seed:admin --workspace @election/backend
```

Puis tout se fait depuis `Dashboard > Administration` :

- ajout bureau local ;
- création observateur ;
- affectation unique observateur/bureau ;
- import CSV/XLSX ;
- activation/désactivation ;
- reset mot de passe.
