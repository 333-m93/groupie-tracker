# groupie-tracker (serveur minimal)

Ce dépôt contient un serveur Go minimal qui expose quelques endpoints REST pour démarrer le projet.

Endpoints disponibles:

- `GET /` : message texte d'accueil
- `GET /health` : retourne `{ "status": "ok" }`
- `GET /artists` : retourne un tableau JSON d'artistes (vide pour l'instant)
- `POST /events` : accepte un JSON `{ "action": "...", "data": {...} }` et renvoie un accusé de réception

Exécuter le serveur (PowerShell):

```powershell
go run .
```

Tester manuellement (exemples curl):

```powershell
curl http://localhost:8080/health

curl http://localhost:8080/artists

curl -X POST http://localhost:8080/events -H "Content-Type: application/json" -d '{"action":"ping","data":{"msg":"bonjour"}}'
```

