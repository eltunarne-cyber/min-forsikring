// Små felles hjelpere for visningene.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const ICONS = {
  bil: '<svg viewBox="0 0 24 24" fill="#ffd57a" aria-hidden="true"><path d="M5 11l1.6-4.2A2 2 0 0 1 8.5 5.5h7a2 2 0 0 1 1.9 1.3L19 11v7a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><circle cx="8" cy="14" r="1.4" fill="#163f35"/><circle cx="16" cy="14" r="1.4" fill="#163f35"/></svg>',
  hus: '<svg viewBox="0 0 24 24" fill="#e9806b" aria-hidden="true"><path d="M12 3l9 8h-2v9h-5v-6h-4v6H5v-9H3z"/></svg>',
  innbo: '<svg viewBox="0 0 24 24" fill="#f3a1b5" aria-hidden="true"><path d="M4 11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4H4zM3 15h18v3h-2v2h-2v-2H7v2H5v-2H3z"/></svg>',
  reise: '<svg viewBox="0 0 24 24" fill="#6fcfa8" aria-hidden="true"><path d="M21 15.5v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V8.5l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5z"/></svg>',
  chevron: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 5l4.5 4.5L11.5 5" fill="none" stroke="#163f35" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

let toastTimer;
export function toast(message, { error = false, ms = 3500 } = {}) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('error', error);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// Felles toppfelt for undersider (Påminnelser, KI, osv.)
export function subHeader({ title, sub = '', cls = '', backHref = '#/', backText = 'Oversikt' }) {
  return `
  <header class="top ${cls}">
    <div class="top-inner">
      <a class="back" href="${esc(backHref)}">← ${esc(backText)}</a>
      <h2 tabindex="-1" data-focus>${esc(title)}</h2>
      ${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
    </div>
  </header>`;
}

// Åpne/lukke med myk høydeanimasjon. Kroppen er `inert` når den er lukket.
export function setExpanded(card, open, { animate = true } = {}) {
  const toggle = card.querySelector('.card-toggle');
  const body = card.querySelector('.body');
  toggle.setAttribute('aria-expanded', String(open));
  card.classList.toggle('open', open);
  body.inert = !open;
  const reduce = !animate || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    body.style.maxHeight = open ? 'none' : '0px';
    return;
  }
  if (open) {
    body.style.maxHeight = body.scrollHeight + 'px';
    const done = (e) => {
      if (e && e.target !== body) return;
      if (card.classList.contains('open')) body.style.maxHeight = 'none';
      body.removeEventListener('transitionend', done);
    };
    body.addEventListener('transitionend', done);
    setTimeout(done, 400); // reserve hvis transitionend ikke kommer
  } else {
    body.style.maxHeight = body.scrollHeight + 'px';
    body.offsetHeight; // tving reflow før animasjonen til 0
    body.style.maxHeight = '0px';
  }
}

// Appens egen bekreftelsesdialog (i stedet for confirm()). Gir true/false.
export function confirmDialog({ title, message = '', confirmText = 'OK', cancelText = 'Avbryt', danger = false }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dialog';
    dlg.setAttribute('aria-labelledby', 'dlg-title');
    dlg.innerHTML = `
      <h2 id="dlg-title">${esc(title)}</h2>
      ${message ? `<p>${esc(message)}</p>` : ''}
      <div class="dialog-actions">
        <button type="button" class="btn" value="cancel">${esc(cancelText)}</button>
        <button type="button" class="btn ${danger ? 'danger' : 'dark'}" value="ok">${esc(confirmText)}</button>
      </div>`;
    document.body.append(dlg);
    let result = false;
    dlg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) { result = b.value === 'ok'; dlg.close(); }
    });
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    dlg.showModal();
    dlg.querySelector('button[value="cancel"]').focus();
  });
}

// Beløp: «6950» → «6 950». Tom tekst gir tom tekst.
export function formatAmountInput(value) {
  const n = parseAmount(value);
  return n === null ? '' : new Intl.NumberFormat('nb-NO').format(n);
}

// Tolker tekst som heltall (fjerner mellomrom, «kr» osv.). Tom tekst → null.
export function parseAmount(value) {
  const digits = String(value ?? '').replace(/[^\d]/g, '');
  return digits === '' ? null : Number(digits);
}

// Dialog med ett tekstfelt (f.eks. navn på rom). Gir teksten, eller null ved Avbryt.
export function promptDialog({ title, label, value = '', confirmText = 'Lagre' }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dialog';
    dlg.setAttribute('aria-labelledby', 'prompt-title');
    dlg.innerHTML = `
    <form novalidate>
      <h2 id="prompt-title">${esc(title)}</h2>
      <div class="field">
        <label for="prompt-input">${esc(label)}</label>
        <input id="prompt-input" name="text" type="text" value="${esc(value)}" autocomplete="off">
      </div>
      <p class="error" hidden>Skriv et navn.</p>
      <div class="dialog-actions">
        <button type="button" class="btn" value="cancel">Avbryt</button>
        <button type="submit" class="btn dark">${esc(confirmText)}</button>
      </div>
    </form>`;
    document.body.append(dlg);
    const form = dlg.querySelector('form');
    let result = null;
    form.addEventListener('click', (e) => { if (e.target.closest('button[value="cancel"]')) dlg.close(); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = form.elements.text.value.trim();
      if (!text) { form.querySelector('.error').hidden = false; return; }
      result = text;
      dlg.close();
    });
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    dlg.showModal();
    form.elements.text.select();
  });
}
