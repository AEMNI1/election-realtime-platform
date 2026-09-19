# Load test

Préparer un environnement staging en mode `VOTING` avec jusqu'à 500 observateurs et un fichier `credentials.json` :

```json
[
  {"username":"observer001","password":"Temp-2026!"},
  {"username":"observer002","password":"Temp-2026!"}
]
```

Puis :

```bash
k6 run -e API_URL=http://localhost:4000 -e CREDENTIALS_FILE=credentials.json tests/load/k6-participation.js
```

Le scénario cible 10 000 confirmations avec jusqu'à 500 VUs.
