// Eigene Rückfrage statt window.confirm(): Safari auf iPad/iPhone kann Seiten die Dialoge verbieten („Dialoge nicht mehr anzeigen“), dann liefert confirm() immer „false“ und nichts passiert.
export function askConfirm(text, okLabel = 'Ja') {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog'); dlg.className = 'ask-dlg';
    const p = document.createElement('p'); p.textContent = text;
    const row = document.createElement('div'); row.className = 'rowf';
    const ok = document.createElement('button'); ok.textContent = okLabel; ok.className = 'ask-ok';
    const no = document.createElement('button'); no.textContent = 'Abbrechen';
    row.append(ok, no); dlg.append(p, row); document.body.append(dlg);
    let done = false; const end = (v) => { if (done) return; done = true; try { dlg.close(); } catch { /* egal */ } dlg.remove(); resolve(v); };
    ok.addEventListener('click', () => end(true)); no.addEventListener('click', () => end(false)); dlg.addEventListener('cancel', () => end(false)); dlg.addEventListener('close', () => end(false));
    try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); }
    no.focus();
  });
}
