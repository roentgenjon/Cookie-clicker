# 🍪 Keks-Imperium

Cookie Clicker mit **10.000 Upgrades**, 15 Gebäuden, goldenen Keksen, 184 Erfolgen, Aufstieg (Himmelschips),
Offline-Ertrag, Cloud-Speicherstand und Rangliste. Frontend auf **GitHub Pages**, Datenbank auf **Cloudflare (Worker + KV)**.

## Upgrades (genau 10.000)
| Art | Anzahl |
|---|---|
| Gebäude-Stufen | 2.850 |
| Klick-Upgrades | 1.500 |
| Globale Produktion | 2.500 |
| Synergien (Gebäude ⇄ Gebäude) | 1.050 |
| Goldene Kekse | 850 |
| Himmlische Upgrades (kosten Chips, bleiben nach Aufstieg) | 1.250 |

## Einrichtung
1. **Cloudflare Worker deployen** – im GitHub-Repo unter *Settings → Secrets and variables → Actions* anlegen:
   `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID`, dann Workflow „Deploy Cloudflare Worker“ starten
   (oder lokal: `cd worker && npx wrangler deploy`). Die KV-Datenbank `SAVES` wird automatisch angelegt.
2. Die ausgegebene Worker-URL (`https://cookie-clicker-api.<subdomain>.workers.dev`) in `config.js` bei `API_URL` eintragen.
3. **GitHub Pages**: *Settings → Pages → Source: GitHub Actions*. Der Workflow „Deploy GitHub Pages“ veröffentlicht die Seite.

> API-Tokens gehören **nie** ins Repo oder in `config.js` – nur als GitHub-Secret bzw. Umgebungsvariable.

## Lokal testen
```
node tests/check.mjs && node tests/engine.mjs
python3 -m http.server 8000   # dann http://localhost:8000
```
