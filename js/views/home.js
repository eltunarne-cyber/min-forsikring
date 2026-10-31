// Forsiden: total årspremie og fire bokser (Bil, Hus, Innbo, Reise).

import {
  TYPES, policiesOfType, totalPremium, premiumOf, earliestRenewal,
  formatKr, formatDate, yearProgress, renewalStatus, describePolicy,
  myPageUrlOf, docKindLabel, formatBytes,
} from '../model.js';
import { esc, ICONS, setExpanded, confirmDialog } from '../ui.js';
import { addDocumentDialog, openDocument } from '../documents.js';

export function render(root, ctx) {
  const { state } = ctx;
  const { policies } = state;
  const hasExample = policies.some((p) => p.isExample);

  root.innerHTML = `
  <header class="top">
    <div class="top-inner">
      <div class="top-row">
        <h1 class="brand" tabindex="-1" data-focus>Min Forsikring</h1>
        <a class="icon-btn" href="#/innstillinger" aria-label="Innstillinger"><span aria-hidden="true">⚙️</span></a>
      </div>
      <p class="total">Total årspremie<b>${formatKr(totalPremium(policies))}</b></p>
    </div>
  </header>
  <main class="content">
    ${TYPES.map((t) => card(t, policiesOfType(policies, t.key), state)).join('')}
  </main>
  ${hasExample ? '<p class="note">Eksempeldata – bytt ut med deres egne. Trykk på en boks for å åpne og lukke den.</p>' : ''}`;

  for (const el of root.querySelectorAll('.card[data-type]')) {
    const type = el.dataset.type;
    if (state.openTypes.has(type)) setExpanded(el, true, { animate: false });

    // Hele boksen kan trykkes for å åpne/lukke – unntatt knapper, lenker og dokumentlisten.
    el.addEventListener('click', (e) => {
      if (e.target.closest('.body a, .body button, .docs')) return;
      const open = !el.classList.contains('open');
      if (open) state.openTypes.add(type); else state.openTypes.delete(type);
      setExpanded(el, open);
    });
  }

  for (const el of root.querySelectorAll('.card-empty')) {
    el.addEventListener('click', () => ctx.navigate(`#/rediger/ny?type=${el.dataset.type}`));
  }

  // Lytteren legges på <main>, som lages på nytt ved hver visning (ikke på #app).
  root.querySelector('main').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    handleAction(btn, ctx, root);
  });
}

async function handleAction(btn, ctx, root) {
  const { state, actions, toast } = ctx;
  const { action, id, type, doc } = btn.dataset;
  const policy = state.policies.find((x) => x.id === id);

  if (action === 'edit') ctx.navigate(`#/rediger/${id}`);
  else if (action === 'add') ctx.navigate(`#/rediger/ny?type=${type}`);
  else if (action === 'mypage') {
    const url = policy && myPageUrlOf(policy);
    if (url) window.open(url, '_blank', 'noopener');
    else toast('Ingen lenke til Min side er lagt inn ennå. Velg selskap under «Rediger».');
  } else if (action === 'docs') {
    if (state.openDocs.has(id)) state.openDocs.delete(id); else state.openDocs.add(id);
    refreshPolicy(root, state, id);
  } else if (action === 'help-ok') {
    await actions.saveSettings({ docHelpSeen: true });
    for (const p of state.policies) refreshPolicy(root, state, p.id);
  } else if (action === 'add-doc') {
    const result = await addDocumentDialog(policy);
    if (!result) return;
    try {
      await actions.addDocument(id, result.file, result);
      state.openDocs.add(id);
      for (const p of state.policies) refreshPolicy(root, state, p.id); // hjelpeteksten forsvinner overalt
      toast('Dokumentet er lagret.');
    } catch (err) {
      console.error(err);
      toast('Kunne ikke lagre dokumentet – er lagringen full?', { error: true, ms: 6000 });
    }
  } else if (action === 'open-doc') {
    const ref = policy.documents.find((d) => d.id === doc);
    openDocument(ref, actions.getFile, toast);
  } else if (action === 'delete-doc') {
    const ref = policy.documents.find((d) => d.id === doc);
    const ok = await confirmDialog({
      title: 'Slette dokumentet?',
      message: `«${ref.title}» blir slettet fra denne enheten.`,
      confirmText: 'Slett',
      danger: true,
    });
    if (!ok) return;
    try {
      await actions.deleteDocument(id, doc);
      refreshPolicy(root, state, id);
      toast('Dokumentet er slettet.');
    } catch (err) {
      console.error(err);
      toast('Kunne ikke slette dokumentet. Prøv igjen.', { error: true });
    }
  }
}

// Tegn én polise-seksjon på nytt uten å tegne hele siden (beholder åpne bokser og rulleposisjon).
function refreshPolicy(root, state, id) {
  const section = root.querySelector(`section.policy[data-policy="${id}"]`);
  const policy = state.policies.find((x) => x.id === id);
  if (!section || !policy) return;
  const focusedAction = document.activeElement?.closest?.(`section.policy[data-policy="${id}"]`)
    ? document.activeElement.dataset.action : null;
  const body = section.closest('.body');
  section.outerHTML = policySection(policy, section.dataset.multi === '1', state);
  // Innholdet kan ha blitt høyere – la den åpne boksen vokse med.
  if (body?.closest('.card.open')) body.style.maxHeight = 'none';
  if (focusedAction) {
    root.querySelector(`section.policy[data-policy="${id}"] [data-action="${focusedAction}"]`)?.focus();
  }
}

function card(type, list, state) {
  const icon = `<span class="icon">${ICONS[type.key]}</span>`;

  if (list.length === 0) {
    return `
    <article class="card">
      <button class="card-toggle card-empty" data-type="${type.key}">
        <span class="head">
          ${icon}
          <span class="meta">
            <span class="t"><span class="name">${esc(type.title)}</span></span>
            <span class="p">Ikke registrert – trykk for å legge inn</span>
          </span>
        </span>
      </button>
    </article>`;
  }

  const sum = list.reduce((s, p) => s + premiumOf(p), 0);
  const allCard = sum === 0 && list.every((p) => p.premiumNote);
  const premiumText = sum > 0 ? `${formatKr(sum)} / år` : allCard ? 'Inkludert i kredittkort' : 'Premie ikke fylt ut';

  const renewal = earliestRenewal(list);
  const status = renewalStatus(renewal, state.settings.warnDays);
  const pct = status === 'over' ? 100 : Math.round(yearProgress(renewal) * 100);
  const isExample = list.some((p) => p.isExample);
  const multi = list.length > 1;

  const bodyId = `body-${type.key}`;
  const toggleId = `toggle-${type.key}`;

  return `
  <article class="card" data-type="${type.key}">
    <button class="card-toggle" id="${toggleId}" aria-expanded="false" aria-controls="${bodyId}">
      <span class="head">
        ${icon}
        <span class="meta">
          <span class="t"><span class="name">${esc(type.title)}</span>${isExample ? '<span class="tag">Eksempel</span>' : ''}</span>
          <span class="p">${esc(premiumText)}</span>
        </span>
        <span class="chev" aria-hidden="true">${ICONS.chevron}</span>
      </span>
      <span class="due"><span>Forfall</span><span>${renewal ? formatDate(renewal) + (status === 'over' ? ' (passert)' : '') : 'Ikke satt'}</span></span>
      <span class="bar" aria-hidden="true"><i class="${status || ''}" style="width:${pct}%"></i></span>
    </button>
    <div class="body" id="${bodyId}" role="region" aria-labelledby="${toggleId}" inert>
      ${list.map((p) => policySection(p, multi, state)).join('')}
      ${type.key === 'reise' ? `
      <div class="actions">
        <button class="btn" data-action="add" data-type="${type.key}">＋ Legg til polise</button>
      </div>` : ''}
    </div>
  </article>`;
}

function policySection(p, multi, state) {
  const heading = multi ? (p.company || p.name) : '';
  const rows = describePolicy(p, { showCompany: !multi || !p.company, multi });
  const phone = p.type === 'reise' ? p.fields?.emergencyPhone : '';
  const docs = p.documents || [];
  const docsOpen = state.openDocs.has(p.id);
  const hasLink = Boolean(myPageUrlOf(p));

  return `
  <section class="policy" data-policy="${p.id}" data-multi="${multi ? 1 : 0}">
    ${heading ? `<h3 class="policy-title">${esc(heading)}</h3>` : ''}
    <div class="rows">
      ${rows.map((r) => `<div class="row"><span>${esc(r.label)}</span>${r.value ? `<b>${esc(r.value)}</b>` : `<b class="empty">${esc(r.emptyText)}</b>`}</div>`).join('')}
    </div>
    ${phone ? `
    <a class="phone" href="tel:${esc(phone.replace(/[^\d+]/g, ''))}">
      <span><small>Medisinsk nødnummer</small><b>${esc(phone)}</b></span><span aria-hidden="true">📞</span>
    </a>` : ''}
    <div class="actions">
      <button class="btn" data-action="docs" data-id="${p.id}" aria-expanded="${docsOpen}" aria-controls="docs-${p.id}">📄 Dokumenter (${docs.length})</button>
      <button class="btn" data-action="mypage" data-id="${p.id}" ${hasLink ? '' : 'aria-disabled="true"'}>🔗 Min side</button>
      <button class="btn dark" data-action="edit" data-id="${p.id}">✏️ Rediger</button>
    </div>
    <div class="docs" id="docs-${p.id}" ${docsOpen ? '' : 'hidden'}>
      ${state.settings.docHelpSeen ? '' : `
      <div class="help">
        <p><b>Slik henter du polisen fra selskapet:</b></p>
        <ol>
          <li>Trykk «🔗 Min side» og logg inn hos selskapet.</li>
          <li>Last ned polisen eller vilkårene (PDF).</li>
          <li>Kom tilbake hit og trykk «＋ Legg til dokument».</li>
        </ol>
        <button class="btn" data-action="help-ok" data-id="${p.id}">Skjønner</button>
      </div>`}
      ${docs.length ? `
      <ul class="doc-list">
        ${docs.map((d) => `
        <li>
          <button class="doc" data-action="open-doc" data-id="${p.id}" data-doc="${d.id}">
            <span class="doc-icon" aria-hidden="true">${(d.type || '').startsWith('image/') ? '🖼️' : '📄'}</span>
            <span class="doc-text">
              <b>${esc(d.title)}</b>
              <small>${esc([docKindLabel(d.kind), formatBytes(d.size), formatDate(d.addedAt.slice(0, 10))].filter(Boolean).join(' · '))}</small>
            </span>
          </button>
          <button class="btn icon-only" data-action="delete-doc" data-id="${p.id}" data-doc="${d.id}" aria-label="Slett ${esc(d.title)}">🗑️</button>
        </li>`).join('')}
      </ul>` : '<p class="small">Ingen dokumenter lagret ennå.</p>'}
      <button class="btn dark wide" data-action="add-doc" data-id="${p.id}">＋ Legg til dokument</button>
    </div>
  </section>`;
}
