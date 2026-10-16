// Englisch: Das Spiel ist auf Deutsch geschrieben. Hier wird die Oberfläche (Menüs, Knöpfe, Fenster, Hinweise) per Wörterbuch ins Englische übersetzt.
// Namen von Gebäuden, Upgrades und Erfolgen sowie Chat-Texte bleiben bewusst deutsch (über 400.000 Einträge).
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };

// Ganze Texte (nach trim) -> Übersetzung
const EXACT = {
  'Keks-Imperium': 'Cookie Empire', 'Dein': 'Your',
  '📊 Statistik': '📊 Statistics', '🏆 Erfolge': '🏆 Achievements', '🪽 Aufstieg': '🪽 Ascension', '💬 Chat': '💬 Chat', '☁️ Anmelden': '☁️ Log in', '📅 Aufgaben': '📅 Tasks', '🏰 Gilde': '🏰 Guild', '📊 Umfragen': '📊 Polls', '⏳ Zeitkristalle': '⏳ Time crystals', '♾️ Mega-Upgrades': '♾️ Mega upgrades', '🔊 Sound-Shop': '🔊 Sound shop', '🎨 Skins': '🎨 Skins', '🎁 Geschenk': '🎁 Gift', '🛡️ Admin': '🛡️ Admin', '⚙️ Optionen': '⚙️ Options',
  '🤖 Auto-Kauf: aus': '🤖 Auto-buy: off', '🤖 Auto-Kauf: an': '🤖 Auto-buy: on', '🤖 Auto-Kauf an': '🤖 Auto-buy on', '🤖 Auto-Kauf aus': '🤖 Auto-buy off',
  'Kekse': 'Cookies', 'pro Sekunde:': 'per second:', 'Klick:': 'Click:', 'Ein Keks pro Tag hält den Doktor fern.': 'A cookie a day keeps the doctor away.',
  'Upgrades': 'Upgrades', 'Alle kaufen': 'Buy all', 'Alle': 'All', 'Gebäude': 'Buildings', 'Klick': 'Click', 'Global': 'Global', 'Synergie': 'Synergy', 'Gold': 'Gold', 'Himmlisch': 'Heavenly',
  'Noch keine Upgrades verfügbar – kauf Gebäude und backe mehr Kekse!': 'No upgrades available yet – buy buildings and bake more cookies!',
  'Rechtsklick: verkaufen (50 %)': 'Right-click: sell (50 %)', 'Gesamt: 0/s': 'Total: 0/s',
  'Du wurdest gebannt': 'You have been banned', 'Dein Konto wurde von einem Admin gesperrt.': 'Your account was suspended by an admin.', 'Du kannst nicht mehr spielen und dich nicht abmelden.': 'You can no longer play or log out.', '📨 Einspruch senden': '📨 Send appeal',
  '☁️ Anmeldung & Rangliste': '☁️ Login & leaderboard', 'Name': 'Name', 'Setup-Code': 'Setup code', '🆕 Konto erstellen': '🆕 Create account', '🔑 Anmelden': '🔑 Log in', 'Ohne Anmeldung spielen': 'Play without logging in', '🏆 Rangliste': '🏆 Leaderboard', '❌ Server nicht erreichbar': '❌ Server unreachable',
  'Neu hier?': 'New here?', 'Schon ein Konto?': 'Already have an account?',
  'Kekse auf der Bank': 'Cookies in the bank', 'Gebacken (diese Runde)': 'Baked (this run)', 'Gebacken (insgesamt)': 'Baked (all time)', 'Kekse pro Sekunde': 'Cookies per second', 'Klickwert': 'Click value', 'Klicks': 'Clicks', 'Goldene Kekse geklickt': 'Golden cookies clicked', 'Erfolge': 'Achievements', 'Aufstiege': 'Ascensions', 'Singularität': 'Singularity', 'noch nicht gekauft': 'not bought yet', 'Himmelschips': 'Heavenly chips', 'Spielzeit': 'Play time', 'Offline-Ertrag': 'Offline yield',
  '📈 Verlauf': '📈 History', 'Noch zu wenig Daten – es wird jede Minute ein Messpunkt gespeichert. Schau in ein paar Minuten wieder vorbei.': 'Not enough data yet – a data point is saved every minute. Check back in a few minutes.',
  'Jeder Erfolg gibt +0,2 % auf deine Produktion.': 'Every achievement gives +0.2 % production.',
  'Chips gesamt': 'Chips total', 'Chips verfügbar': 'Chips available', 'Chips beim Aufstieg': 'Chips on ascension', 'Zeitkristalle beim Aufstieg': 'Time crystals on ascension', '🪽 Jetzt aufsteigen': '🪽 Ascend now',
  'Name deiner Bäckerei': 'Your bakery name', '🌓 Design wechseln': '🌓 Switch theme', '💾 Jetzt speichern': '💾 Save now', '🔔 Sound testen': '🔔 Test sound', 'Lautstärke': 'Volume', 'Spielstand exportieren / importieren': 'Export / import save', '📲 Als App installieren': '📲 Install as app', '⌨️ Tastenkürzel': '⌨️ Keyboard shortcuts',
  'Keks klicken (halten = schnell)': 'Click the cookie (hold = fast)', 'Leertaste': 'Space', 'Auto-Kauf an/aus': 'Toggle auto-buy', 'Alle bezahlbaren Upgrades kaufen': 'Buy all affordable upgrades', 'Statistik': 'Statistics', 'Mega-Upgrades': 'Mega upgrades', 'Optionen': 'Options', 'Fenster schließen': 'Close window',
  '⬆️ Exportieren': '⬆️ Export', '⬇️ Importieren': '⬇️ Import', '🗑️ Alles löschen': '🗑️ Delete everything',
  '📅 Tägliche Aufgaben': '📅 Daily tasks', '🔥 Serie': '🔥 Streak', '🎁 Belohnung je Aufgabe': '🎁 Reward per task', '🎁 Abholen': '🎁 Claim',
  'Upgrades gekauft (normale + Mega-Stufen)': 'Upgrades bought (normal + mega levels)', '🔒 gesperrt': '🔒 locked', 'Noch keine Reihe freigeschaltet. Kaufe Gebäude!': 'No series unlocked yet. Buy buildings!',
  'Klang-Pakete': 'Sound packs', '🔊 Klänge': '🔊 Sounds', '🎵 Musik': '🎵 Music', 'Klassisch': 'Classic', 'AKTIV': 'ACTIVE', '✔ Aktiv': '✔ Active', 'Aktiv': 'Active', '▶ Hören': '▶ Listen', 'Zen-Garten': 'Zen garden', 'Weltraum': 'Space', 'Episch': 'Epic',
  '🎨 Keks-Skins': '🎨 Cookie skins', '🎁 Geschenk senden': '🎁 Send gift',
  'Allgemein': 'General', '🌍 Allgemeiner Chat (für alle)': '🌍 General chat (everyone)', 'Noch keine Nachrichten. Schreib die erste! 👋': 'No messages yet. Write the first one! 👋',
  '⏳ Zeitkristalle': '⏳ Time crystals', 'Zeitsprung: 1 Stunde Produktion': 'Time warp: 1 hour of production', 'Großer Zeitsprung: 24 Stunden Produktion': 'Big time warp: 24 hours of production', '3 goldene Kekse rufen': 'Summon 3 golden cookies', 'Raserei (77 s)': 'Frenzy (77 s)', 'Klick-Raserei ×777 (13 s)': 'Click frenzy ×777 (13 s)',
  'Gespeichert ✔': 'Saved ✔', 'Importiert ✔': 'Imported ✔', '❌ Ungültiger Code': '❌ Invalid code', 'Zurückgesetzt': 'Reset', 'Nichts bezahlbar': 'Nothing affordable',
  '🏰 Gilden': '🏰 Guilds', '🏆 Gilden-Rangliste': '🏆 Guild leaderboard', '👥 Mitglieder': '👥 Members', '💬 Gilden-Chat': '💬 Guild chat', 'Senden': 'Send', 'Beitreten': 'Join', 'Voll': 'Full', 'Entfernen': 'Remove', '🏰 Gründen': '🏰 Found', '➕ Eigene Gilde gründen': '➕ Found your own guild', '🚪 Gilde verlassen': '🚪 Leave guild',
  'Kürzel (2–4)': 'Tag (2–4)', 'Noch keine Gilden – gründe die erste!': 'No guilds yet – found the first one!', 'Noch keine Nachrichten.': 'No messages yet.',
  '🛠️ Wartungsarbeiten': '🛠️ Maintenance', '🌐 Sprache': '🌐 Language',
};
// Teiltexte (länger zuerst angewendet)
const PARTS = [
  ['iPhone/iPad (Safari): Teilen-Symbol → „Zum Home-Bildschirm“. Android/Chrome: Menü → „App installieren“. Dann startet das Spiel wie eine App im Vollbild.', 'iPhone/iPad (Safari): Share icon → “Add to Home Screen”. Android/Chrome: menu → “Install app”. The game then launches full screen like an app.'],
  ['Melde dich unter „☁️ Anmelden“ an, um anderen Spielern Kekse zu schenken.', 'Log in via “☁️ Log in” to gift cookies to other players.'],
  ['Melde dich unter „☁️ Anmelden“ an, um an Umfragen teilzunehmen.', 'Log in via “☁️ Log in” to take part in polls.'],
  ['Melde dich unter „☁️ Anmelden“ an, um mitzuschreiben und private Chats zu führen. Lesen kann jeder.', 'Log in via “☁️ Log in” to write and have private chats. Everyone can read.'],
  ['Melde dich an (☁️), um einer Gilde beizutreten oder eine zu gründen.', 'Log in (☁️) to join or found a guild.'],
  ['Du bekommst sie bei jedem Aufstieg (1 + eine Stelle je 10× so vielen Himmelschips).', 'You get them on every ascension (1 + one per 10× as many heavenly chips).'],
  ['Schaffst du alle drei, gibt es einen Bonus (3-fache Belohnung) und 3 goldene Kekse. Jeden Tag ohne Pause erhöht die Serie die Belohnung um 1', 'Finish all three for a bonus (triple reward) and 3 golden cookies. Every day without a break raises the reward by 1'],
  ['Chips = ³√(Gesamt-Kekse / 1 Billion). Himmlische Upgrades findest du im Upgrade-Filter „Himmlisch“.', 'Chips = ∛(total cookies / 1 trillion). Find heavenly upgrades under the “Heavenly” upgrade filter.'],
  ['Beim Aufstieg setzt du Kekse, Gebäude und normale Upgrades zurück und erhältst', 'When you ascend you reset cookies, buildings and normal upgrades and get'],
  ['und schaltet himmlische Upgrades frei (die bleiben für immer).', 'and unlock heavenly upgrades (they stay forever).'],
  ['Jeder Chip gibt dauerhaft', 'Each chip permanently gives'],
  ['Schalte neue Kekse über Erfolge und Fortschritt frei und tippe auf einen, um ihn zu benutzen', 'Unlock new cookies through achievements and progress and tap one to use it'],
  ['Kaufe sie einmal für Kekse, sie bleiben beim Aufstieg erhalten.', 'Buy them once with cookies; they stay when you ascend.'],
  ['Gib deinen', 'Enter your'], ['(2–16 Zeichen) und ein', '(2–16 characters) and a'], ['(mindestens 4 Zeichen) ein.', '(at least 4 characters).'],
  ['Tippe auf „Konto erstellen“.', 'Tap “Create account”.'], ['Tippe auf „Anmelden“, dein Fortschritt wird geladen.', 'Tap “Log in” and your progress will be loaded.'],
  ['Jedes erzeugt ca.', 'Each produces about'], ['Kekse/s', 'cookies/s'],
  ['Wissenschaftler zählen Krümel. Ergebnis: viele.', 'Scientists are counting crumbs. Result: many.'],
  ['Jeder Chip gibt dauerhaft', 'Each chip permanently gives'],
  ['Cloud-Speicherung, Chat und Geschenke pausieren. Du kannst weiterspielen.', 'Cloud saving, chat and gifts are paused. You can keep playing.'],
  ['Wartungsarbeiten –', 'Maintenance –'],
];
// Sätze mit Zahlen
const RULES = [
  [/^(.+) \/ (.+) gekauft · (.+) verfügbar$/, '$1 / $2 bought · $3 available'],
  [/^Mehr anzeigen \((\d+) weitere\)$/, 'Show more ($1 more)'],
  [/^(\d+) Tage in Folge$/, '$1 days in a row'],
  [/^Fange (\d+) goldene Kekse$/, 'Catch $1 golden cookies'], [/^Klicke (\d+)× auf den Keks$/, 'Click the cookie $1×'], [/^Kaufe (\d+) Gebäude$/, 'Buy $1 buildings'],
  [/^(\d+) Mitglieder · zusammen (.+) Kekse$/, '$1 members · together $2 cookies'], [/^Gründer: (.+)$/, 'Founder: $1'],
  [/^(.+) frei \/ (.+) gesamt$/, '$1 free / $2 total'], [/^🔒 (\d+) weitere Reihen gesperrt$/, '🔒 $1 more series locked'],
  [/^⏳ (\d+) Zeitkristalle$/, '⏳ $1 time crystals'], [/^🏆 Erfolge \((.+)\)$/, '🏆 Achievements ($1)'],
  [/^(.*)Partikel: an$/, '$1Particles: on'], [/^(.*)Partikel: aus$/, '$1Particles: off'], [/^(.*)Sound: an$/, '$1Sound: on'], [/^(.*)Sound: aus$/, '$1Sound: off'],
  [/^(.*)Musik: an$/, '$1Music: on'], [/^(.*)Musik: aus$/, '$1Music: off'], [/^(.*)Keks-Regen: an$/, '$1Cookie rain: on'], [/^(.*)Keks-Regen: aus$/, '$1Cookie rain: off'], [/^(.*)Boost-Anzeige: an$/, '$1Boost display: on'], [/^(.*)Boost-Anzeige: aus$/, '$1Boost display: off'],
  [/^Stufe (\d+) \(Produktion hoch (.+)\)$/, 'Level $1 (production to the power of $2)'],
  [/^(.+) Himmelschips verdient$/, '$1 heavenly chips earned'],
  [/^🏰 (.+) \[(.+)\]$/, '🏰 $1 [$2]'],
];
PARTS.sort((a, b) => b[0].length - a[0].length);
const ATTRS = ['title', 'placeholder', 'aria-label'];
const cache = new Map();
const letters = /[A-Za-zÄÖÜäöüß]{3}/;
function tr(text) {
  const t = text.trim(); if (!t || !letters.test(t)) return text;
  let r = cache.get(t);
  if (r === undefined) {
    r = EXACT[t];
    if (r === undefined) { r = t; for (const [re, rep] of RULES) if (re.test(r)) { r = r.replace(re, rep); break; } if (r === t) for (const [de, en] of PARTS) if (r.includes(de)) r = r.split(de).join(en); }
    if (cache.size > 3000) cache.clear(); cache.set(t, r);
  }
  return r === t ? text : text.replace(t, r);
}
const SKIP = '[data-noi18n],script,style,textarea,input,#cookies,#cps,#clickVal,#bakeryName,.cm-t,.gchat,.nm,.co,.ow';
let obs = null; let lang = ls.get('cc_lang') === 'en' ? 'en' : 'de';
const orig = new WeakMap(); // Textknoten -> Originaltext (zum Zurückschalten)
function walk(root) {
  if (root.nodeType === 3) { fixText(root); return; }
  if (root.nodeType !== 1 || root.matches(SKIP)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; const list = [];
  while ((n = w.nextNode())) list.push(n);
  for (const t of list) fixText(t);
  for (const el of [root, ...root.querySelectorAll('[title],[placeholder],[aria-label]')]) fixAttrs(el);
}
function fixText(n) {
  if (n.parentElement && n.parentElement.closest(SKIP)) return;
  const cur = n.textContent; const known = orig.get(n);
  if (known !== undefined && cur === known.out) return; // schon übersetzt
  const out = tr(cur); if (out !== cur) { orig.set(n, { src: cur, out }); n.textContent = out; }
}
function fixAttrs(el) {
  if (el.closest && el.closest(SKIP) && el.id !== 'banScreen') { /* Eingabefelder: nur Platzhalter übersetzen */ }
  for (const a of ATTRS) { const v = el.getAttribute && el.getAttribute(a); if (v) { const out = tr(v); if (out !== v) { if (!el.__src) el.__src = {}; el.__src[a] = v; el.setAttribute(a, out); } } }
}
function start() {
  if (obs) return; walk(document.body);
  obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'childList') m.addedNodes.forEach((n) => walk(n));
      else if (m.type === 'characterData') fixText(m.target);
      else if (m.type === 'attributes') fixAttrs(m.target);
    }
  });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
export const i18n = {
  get lang() { return lang; },
  init() { document.documentElement.lang = lang; if (lang === 'en') start(); },
  set(l) { ls.set('cc_lang', l === 'en' ? 'en' : 'de'); location.reload(); }, // Neu laden: sauberer Wechsel, ohne dass Originaltexte verloren gehen
  t(s) { return lang === 'en' ? tr(s) : s; },
};
