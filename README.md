# 🍪 Keks-Imperium

Cookie Clicker mit **400.000 Upgrades**, 15 Gebäuden, goldenen Keksen, 184 Erfolgen, Aufstieg (Himmelschips),
Offline-Ertrag, Cloud-Speicherstand und Rangliste. Frontend auf **GitHub Pages**, Datenbank auf **Cloudflare (Worker + KV)**.

## Upgrades (genau 400.000)
| Art | Anzahl |
|---|---|
| Gebäude-Stufen (7.600 je Gebäude) | 114.000 |
| Klick-Upgrades | 60.000 |
| Globale Produktion | 100.000 |
| Synergien (Gebäude ⇄ Gebäude, 200 Stufen) | 42.000 |
| Goldene Kekse | 34.000 |
| Himmlische Upgrades (kosten Chips, bleiben nach Aufstieg) | 50.000 |

Technik: Die Upgrades liegen als kompakte Typed Arrays vor (Namen/Texte werden erst bei Bedarf erzeugt),
Spielstände speichern die Käufe lauflängenkodiert.

## Weitere Funktionen
- 💬 Chat für alle Spieler (Moderation durch Admins: löschen, stumm schalten, leeren)
- 🔊 Sound und 🌧️ Keks-Regen (in den Optionen abschaltbar)
- 🏆 Rangliste nach Gesamt-Keksen, Kekse pro Sekunde und Aufstiegen, mit eigenem Platz
- 📅 Tägliche Aufgaben mit Serie und Tagesbonus
- 🛒 Item-Shop: 11 Items (+15 % bis +1000 % je Stück, Eistee-Flasche), beliebig oft kaufbar (Preis +12 % je Stück), bleiben beim Aufstieg
- 🎨 14 freischaltbare Keks-Skins
- 🎁 Geschenke zwischen Spielern (max. 50 % des Vorrats, 5 pro Tag)
- 🛡️ Admin-Panel: Sterne spawnen, Boosts, Geben, Upgrades, Nachrichten, Zeitplan, Admins ernennen, sperren/stumm/zurücksetzen/löschen

## Datenbank
Der Worker speichert alles in **Cloudflare D1** (SQLite, kostenlos 100.000 Schreibvorgänge/Tag). Die frühere KV-Datenbank
(nur 1.000 Schreibvorgänge/Tag im Gratis-Plan) wurde beim ersten Start automatisch nach D1 übernommen und dient nur noch als Sicherung.

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
