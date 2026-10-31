// Påminnelser: fornyelser, årlig tilbud og innboregister.

import {
  TYPES, WARN_OPTIONS, QUOTE_DAYS, policiesOfType, earliestRenewal, renewalList, daysUntil,
  daysText, formatDate, formatDayMonth, addDays, yearProgress, typeInfo, isQuoteChecked,
  quoteDue, monthsSince, inventoryDue, reminderCount, formatKr,
} from '../model.js';
import { esc, subHeader, setExpanded } from '../ui.js';
import { buildIcs, downloadIcs } from '../ics.js';

const BYTT_URL = 'https://www.bytt.no';

export function render(root, ctx) {
  const { state } = ctx;
  const n = reminderCount(state);

  root.innerHTML = `
  ${subHeader({
    title: 'Påminnelser',
    sub: n === 0 ? 'Ingenting krever handling nå' : n === 1 ? '1 ting trenger oppmerksomhet' : `${n} ting trenger oppmerksomhet`,
    cls: 'rem',
  })}
  <main class="content">
    ${renewalsCard(state)}
    ${quoteCard(state)}
    ${inventoryCard(state)}
    <p class="note">Innboregisteret med bilder og kvitteringer lagres kun på denne enheten.</p>
  </main>`;

  for (const el of root.querySelectorAll('.card[data-box]')) {
    const box = el.dataset.box;
    if (state.openReminders.has(box)) setExpanded(el, true, { animate: false });
    el.addEventListener('click', (e) => {
      if (e.target.closest('.body')) return; // innholdet har egne knapper og avkrysning
      const open = !el.classList.contains('open');
      if (open) state.openReminders.add(box); else state.openReminders.delete(box);
      setExpanded(el, open);
    });
  }

  const main = root.querySelector('main');
  main.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action } = btn.dataset;
    if (action === 'warn') {
      await ctx.actions.saveSettings({ warnDays: Number(btn.dataset.days) });
      ctx.rerender();
    } else if (action === 'ics') {
      const withDate = state.policies.filter((p) => p.renewalDate);
      if (!withDate.length) {
        ctx.toast('Ingen forsikringer har fornyelsesdato ennå. Legg den inn under «Rediger».');
        return;
      }
      const outcome = await downloadIcs(buildIcs(withDate, state.settings.warnDays));
      if (outcome === 'downloaded') ctx.toast('Kalenderfilen er laget. Åpne den for å legge datoene i kalenderen.', { ms: 6000 });
    } else if (action === 'bytt') {
      window.open(BYTT_URL, '_blank', 'noopener');
    } else if (action === 'inventory') {
      ctx.navigate('#/innbo');
    } else if (action === 'add-item') {
      ctx.navigate('#/innbo?ny=1');
    }
  });

  main.addEventListener('change', async (e) => {
    const cb = e.target.closest('input[data-quote]');
    if (!cb) return;
    try {
      await ctx.actions.setQuoteChecked(cb.dataset.quote, cb.checked);
      ctx.rerender();
    } catch (err) {
      console.error(err);
      cb.checked = !cb.checked;
      ctx.toast('Kunne ikke lagre avkrysningen. Prøv igjen.', { error: true });
    }
  });
}

// ---------- Felles boks ----------

function box({ key, icon, title, summary, pct = 0, barCls = '', body, actions = '' }) {
  return `
  <article class="card" data-box="${key}">
    <button class="card-toggle" id="toggle-${key}" aria-expanded="false" aria-controls="body-${key}">
      <span class="head">
        <span class="icon e" aria-hidden="true">${icon}</span>
        <span class="meta">
          <span class="t"><span class="name">${esc(title)}</span></span>
          <span class="p">${esc(summary)}</span>
        </span>
        <span class="chev" aria-hidden="true"><svg viewBox="0 0 14 14"><path d="M2.5 5l4.5 4.5L11.5 5" fill="none" stroke="#163f35" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      </span>
      <span class="bar" aria-hidden="true"><i class="${barCls}" style="width:${Math.round(pct * 100)}%"></i></span>
    </button>
    <div class="body" id="body-${key}" role="region" aria-labelledby="toggle-${key}" inert>
      <div class="rows">${body}</div>
      ${actions ? `<div class="actions">${actions}</div>` : ''}
    </div>
  </article>`;
}

function label(p) {
  const t = typeInfo(p.type);
  const siblings = p._siblings > 1;
  return siblings && p.company ? `${t.label} – ${p.company}` : t.label;
}

// ---------- 1. Fornyelser ----------

function renewalsCard(state) {
  const warnDays = state.settings.warnDays;
  const counts = Object.fromEntries(TYPES.map((t) => [t.key, policiesOfType(state.policies, t.key).length]));
  const list = renewalList(state.policies, warnDays).map((r) => ({ ...r, policy: { ...r.policy, _siblings: counts[r.policy.type] } }));
  const next = list.find((r) => r.days !== null);

  let summary = 'Ingen fornyelsesdatoer lagt inn';
  if (next) {
    summary = next.days < 0
      ? `${label(next.policy)}: fornyelsen er passert`
      : `${label(next.policy)} fornyes ${daysText(next.days)}`;
  }
  const barCls = next?.status === 'over' ? 'over' : next?.status === 'warn' ? 'warn' : '';
  const pct = next ? (next.days < 0 ? 1 : yearProgress(next.policy.renewalDate)) : 0;

  const rows = list.map((r) => {
    const pill = r.days === null
      ? '<b class="pill muted">Ikke satt</b>'
      : `<b class="pill ${r.status === 'over' ? 'r' : r.status === 'warn' ? 'w' : ''}">${esc(r.days < 0 ? 'Passert' : r.days === 0 ? 'I dag' : `${r.days} dager`)}</b>`;
    return `
    <div class="li">
      <span class="li-name">${esc(r.policy.name || label(r.policy))}</span>
      <span class="li-date">${esc(formatDate(r.policy.renewalDate))}</span>
      ${pill}
    </div>`;
  }).join('');

  return box({
    key: 'fornyelser',
    icon: '🔔',
    title: 'Fornyelser',
    summary,
    pct,
    barCls,
    body: `
      <div class="list">${rows || '<p class="small">Ingen forsikringer registrert.</p>'}</div>
      <p class="lbl" id="warn-lbl">Varsle meg før forfall</p>
      <div class="chips" role="group" aria-labelledby="warn-lbl">
        ${WARN_OPTIONS.map((d) => `<button class="chip ${d === warnDays ? 'on' : ''}" data-action="warn" data-days="${d}" aria-pressed="${d === warnDays}">${d} dager</button>`).join('')}
      </div>
      <p class="small">Varselet vises her og som merke på knappen nederst. Legg datoene i kalenderen for å få varsel også når appen er lukket (iPhone og PC).</p>`,
    actions: '<button class="btn" data-action="ics">📅 Legg i kalender</button>',
  });
}

// ---------- 2. Årlig tilbud ----------

function quoteCard(state) {
  const types = TYPES.filter((t) => policiesOfType(state.policies, t.key).length);
  const due = quoteDue(state.policies, state.quoteChecks);
  const checkedCount = types.filter((t) => isQuoteChecked(state.quoteChecks, state.policies, t.key)).length;

  // Neste type som ikke er sjekket, med frist 6 uker før fornyelse.
  const upcoming = types
    .filter((t) => !isQuoteChecked(state.quoteChecks, state.policies, t.key))
    .map((t) => ({ t, date: earliestRenewal(policiesOfType(state.policies, t.key)) }))
    .filter((x) => x.date && daysUntil(x.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  let summary;
  if (due.length) {
    const t = typeInfo(due[0]);
    summary = `Hent tilbud nå – ${t.label.toLowerCase()} fornyes ${daysText(daysUntil(earliestRenewal(policiesOfType(state.policies, t.key))))}`;
  } else if (upcoming) {
    summary = `${upcoming.t.label}: sammenlign før ${formatDayMonth(addDays(upcoming.date, -QUOTE_DAYS))}`;
  } else if (types.length && checkedCount === types.length) {
    summary = 'Alt er sjekket for i år ✓';
  } else {
    summary = 'Legg inn fornyelsesdatoer for å få påminnelse';
  }

  const rows = types.map((t) => {
    const date = earliestRenewal(policiesOfType(state.policies, t.key));
    const checked = isQuoteChecked(state.quoteChecks, state.policies, t.key);
    const deadline = date ? `Frist ${formatDate(ymd(addDays(date, -QUOTE_DAYS)))}` : 'Ingen dato';
    const isDue = due.includes(t.key);
    return `
    <label class="li check">
      <span class="li-name">${esc(t.title)}</span>
      <span class="li-date ${isDue ? 'due-now' : ''}">${esc(isDue ? 'Nå!' : deadline)}</span>
      <input type="checkbox" data-quote="${t.key}" ${checked ? 'checked' : ''} aria-label="Tilbud hentet for ${esc(t.title.toLowerCase())}">
    </label>`;
  }).join('');

  return box({
    key: 'tilbud',
    icon: '⚖️',
    title: 'Årlig tilbud',
    summary,
    pct: types.length ? checkedCount / types.length : 0,
    barCls: due.length ? 'warn' : '',
    body: `
      <p class="small">Hent tilbud fra andre selskaper ca. 6 uker før hver fornyelse. Kryss av når det er gjort. Avkrysningen nullstilles når nytt forsikringsår starter.</p>
      <div class="list">${rows || '<p class="small">Ingen forsikringer registrert.</p>'}</div>`,
    actions: '<button class="btn dark" data-action="bytt">🔗 Åpne bytt.no</button>',
  });
}

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ---------- 3. Innboregister ----------

function inventoryCard(state) {
  const rooms = state.inventory?.rooms || [];
  const items = state.inventory?.items || [];
  const months = monthsSince(state.inventoryUpdatedAt);
  const summary = months === null
    ? 'Ikke startet ennå'
    : months === 0 ? 'Sist oppdatert denne måneden' : `Sist oppdatert for ${months} mnd siden`;

  const innbo = policiesOfType(state.policies, 'innbo')[0];
  const sumInsured = innbo?.fields?.sumInsured || 0;
  const registered = items.reduce((s, i) => s + (Number(i.value) || 0), 0);
  const ratio = sumInsured ? Math.min(1, registered / sumInsured) : 0;

  const roomRows = rooms.map((r) => {
    const its = items.filter((i) => i.roomId === r.id);
    if (!its.length) return '';
    const sum = its.reduce((s, i) => s + (Number(i.value) || 0), 0);
    return `<div class="li"><span class="li-name">${esc(r.name)}</span><span class="li-date">${its.length} ${its.length === 1 ? 'gjenstand' : 'gjenstander'}</span><b>${esc(formatKr(sum))}</b></div>`;
  }).join('');

  return box({
    key: 'innbo',
    icon: '🛋️',
    title: 'Innboregister',
    summary,
    pct: months === null ? 0 : Math.min(1, months / 12),
    barCls: inventoryDue(state.inventoryUpdatedAt) ? 'warn' : '',
    body: `
      <div class="list">${roomRows || '<p class="small">Ingen gjenstander registrert ennå. Et register med bilder og kvitteringer gjør det mye enklere ved innbrudd eller brann.</p>'}</div>
      <p class="lbl">Registrert verdi mot forsikringssum</p>
      <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="${sumInsured}" aria-valuenow="${registered}" aria-label="Registrert verdi"><i style="width:${Math.round(ratio * 100)}%"></i></div>
      <p class="small">${sumInsured
        ? `${esc(formatKr(registered))} registrert av ${esc(formatKr(sumInsured))} forsikringssum`
        : `${esc(formatKr(registered))} registrert. Legg inn forsikringssum på innbopolisen for å sammenligne.`}</p>
      <p class="small">Lagres kun på denne enheten.</p>`,
    actions: '<button class="btn dark" data-action="add-item">＋ Legg til gjenstand</button><button class="btn" data-action="inventory">Åpne innboregister</button>',
  });
}
