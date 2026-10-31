// Innstillinger: deling med ektefelle, sikkerhetskopi, varseltid og sletting av data.

import { APP_VERSION, WARN_OPTIONS, formatDate, formatBytes, monthsSince } from '../model.js';
import { esc, subHeader, confirmDialog } from '../ui.js';
import { buildExport, shareOrDownload, readImportFile, diffImport, filesSize } from '../backup.js';

const BACKUP_REMIND_MONTHS = 3;

export function render(root, ctx) {
  const { state } = ctx;
  const months = monthsSince(state.lastExportAt);
  const exportText = state.lastExportAt
    ? `Sist delt eller sikkerhetskopiert: ${formatDate(state.lastExportAt.slice(0, 10))}`
    : 'Ikke delt eller sikkerhetskopiert fra denne enheten ennå.';
  const remind = months === null || months >= BACKUP_REMIND_MONTHS;
  const examples = state.policies.filter((p) => p.isExample).length;

  root.innerHTML = `
  ${subHeader({ title: 'Innstillinger', sub: 'Deling, sikkerhetskopi og data' })}
  <main class="content">
    <section class="panel" aria-labelledby="s-share">
      <h3 id="s-share">Deling med ektefelle</h3>
      <p class="small">Dataene lagres bare på denne enheten. For å få de samme dataene på den andre telefonen: del en fil herfra, og importer den der.</p>
      <p class="info ${remind ? 'warn' : ''}">${esc(exportText)}${remind && state.lastExportAt ? ' Det er over 3 måneder siden – ta gjerne en ny.' : ''}</p>
      <div class="stack">
        <button class="btn dark wide" data-action="export">📤 Del med ektefelle / ta sikkerhetskopi</button>
        <label class="file-pick">
          <input type="file" name="import" accept="application/json,.json" class="visually-hidden">
          <span class="btn wide" aria-hidden="true">📥 Importer fil</span>
          <span class="visually-hidden">Importer fil fra ektefelle eller sikkerhetskopi</span>
        </label>
      </div>
    </section>

    <section class="panel" aria-labelledby="s-warn">
      <h3 id="s-warn">Varsle meg før forfall</h3>
      <p class="small">Hvor lenge før fornyelsen påminnelsen skal komme.</p>
      <div class="chips" role="group" aria-labelledby="s-warn">
        ${WARN_OPTIONS.map((d) => `<button class="chip ${d === state.settings.warnDays ? 'on' : ''}" data-action="warn" data-days="${d}" aria-pressed="${d === state.settings.warnDays}">${d} dager</button>`).join('')}
      </div>
    </section>

    <section class="panel" aria-labelledby="s-data">
      <h3 id="s-data">Data på denne enheten</h3>
      <p class="small" data-usage>Beregner lagringsplass …</p>
      <div class="stack">
        <button class="btn wide" data-action="clear-examples" ${examples ? '' : 'aria-disabled="true"'}>🧹 Tøm eksempeldata${examples ? ` (${examples})` : ''}</button>
        <button class="btn danger-outline wide" data-action="delete-all">🗑️ Slett alle data</button>
      </div>
    </section>

    <section class="panel" aria-labelledby="s-about">
      <h3 id="s-about">Om appen</h3>
      <p class="small"><b>Legg appen på hjemskjermen (iPhone):</b> åpne appen i Safari, trykk Del-knappen <span aria-hidden="true">(firkant med pil opp)</span> og velg «Legg til på Hjem-skjerm».</p>
      <p class="small" style="margin-top:8px"><b>PC:</b> i Chrome eller Edge kan du trykke installer-ikonet i adressefeltet.</p>
      <p class="small" style="margin-top:8px">Ingen innlogging, ingen server og ingen sporing. Alt lagres lokalt på enheten.</p>
      <p class="small" style="margin-top:8px">Versjon ${esc(APP_VERSION)}</p>
    </section>
  </main>`;

  showUsage(root);

  const main = root.querySelector('main');
  main.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    try {
      if (action === 'warn') {
        await ctx.actions.saveSettings({ warnDays: Number(btn.dataset.days) });
        ctx.rerender();
      } else if (action === 'export') {
        await exportFlow(ctx);
      } else if (action === 'clear-examples') {
        if (!examples) { ctx.toast('Det finnes ingen eksempeldata.'); return; }
        const ok = await confirmDialog({
          title: 'Tømme eksempeldata?',
          message: `${examples} ${examples === 1 ? 'polise' : 'poliser'} merket «Eksempel» blir slettet. Poliser du har lagret selv, beholdes.`,
          confirmText: 'Tøm',
          danger: true,
        });
        if (!ok) return;
        await ctx.actions.clearExamples();
        ctx.toast('Eksempeldataene er fjernet.');
        ctx.rerender();
      } else if (action === 'delete-all') {
        const first = await confirmDialog({
          title: 'Slette alle data?',
          message: 'Alle forsikringer, dokumenter, innboregister og innstillinger blir slettet fra denne enheten.',
          confirmText: 'Fortsett',
          danger: true,
        });
        if (!first) return;
        const second = await confirmDialog({
          title: 'Er du helt sikker?',
          message: 'Dette kan ikke angres. Ta gjerne en sikkerhetskopi først.',
          confirmText: 'Ja, slett alt',
          danger: true,
        });
        if (!second) return;
        await ctx.actions.deleteAll();
        ctx.toast('Alle data er slettet.');
        ctx.navigate('#/');
      }
    } catch (err) {
      console.error(err);
      ctx.toast('Noe gikk galt. Prøv igjen.', { error: true });
    }
  });

  main.querySelector('input[name="import"]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) await importFlow(ctx, file);
  });
}

async function showUsage(root) {
  const el = root.querySelector('[data-usage]');
  try {
    const est = await navigator.storage?.estimate?.();
    const persisted = await navigator.storage?.persisted?.();
    if (!el.isConnected) return;
    const used = est?.usage ? `Appen bruker ca. ${formatBytes(est.usage)}.` : '';
    el.textContent = [used, persisted ? 'Lagringen er satt som varig.' : ''].filter(Boolean).join(' ') || 'Alt lagres lokalt på denne enheten.';
  } catch {
    el.textContent = 'Alt lagres lokalt på denne enheten.';
  }
}

// ---------- Eksport ----------

async function exportFlow(ctx) {
  const { state, actions, toast } = ctx;
  const size = await filesSize(state);
  const canShare = typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [new File(['{}'], 'test.json', { type: 'application/json' })] });

  const choice = await new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dialog';
    dlg.setAttribute('aria-labelledby', 'exp-title');
    dlg.innerHTML = `
      <h2 id="exp-title">Del eller ta sikkerhetskopi</h2>
      <p>Lager én fil med alle forsikringer, innboregister og innstillinger.</p>
      <label class="check-row">
        <input type="checkbox" name="files" ${size ? '' : 'disabled'}>
        <span>Ta med dokumenter og innbobilder${size ? ` (ca. ${esc(formatBytes(Math.round(size * 1.37)))})` : ' (ingen lagret)'}</span>
      </label>
      <p class="small">Uten dokumenter blir filen liten og rask å sende.</p>
      <div class="dialog-actions">
        <button type="button" class="btn" value="cancel">Avbryt</button>
        ${canShare ? '<button type="button" class="btn" value="download">Last ned</button>' : ''}
        <button type="button" class="btn dark" value="${canShare ? 'share' : 'download'}">${canShare ? '📤 Del' : '⬇️ Last ned fil'}</button>
      </div>`;
    document.body.append(dlg);
    let result = null;
    dlg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      result = b.value === 'cancel' ? null : { mode: b.value, includeFiles: dlg.querySelector('input[name="files"]').checked };
      dlg.close();
    });
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    dlg.showModal();
  });
  if (!choice) return;

  const file = await buildExport(state, { includeFiles: choice.includeFiles });
  const outcome = await shareOrDownload(file, { preferDownload: choice.mode === 'download' });
  if (outcome === 'cancelled') return;
  await actions.markExported();
  toast(outcome === 'shared'
    ? 'Filen er delt. Ektefellen åpner den i appen under Innstillinger → Importer fil.'
    : `Filen «${file.name}» er lastet ned.`, { ms: 7000 });
  ctx.rerender();
}

// ---------- Import ----------

async function importFlow(ctx, file) {
  const { state, actions, toast } = ctx;
  let data;
  try {
    data = await readImportFile(file);
  } catch (err) {
    toast(err.message, { error: true, ms: 6000 });
    return;
  }
  const d = diffImport(state, data);
  const lines = [
    d.newPolicies.length ? `${d.newPolicies.length} nye poliser: ${d.newPolicies.map((p) => p.name).join(', ')}` : '',
    d.newerPolicies.length ? `${d.newerPolicies.length} endret (nyere i filen): ${d.newerPolicies.map((p) => p.name).join(', ')}` : '',
    d.olderPolicies.length ? `${d.olderPolicies.length} er eldre i filen enn her` : '',
    d.same ? `${d.same} er like` : '',
    d.onlyLocal.length ? `${d.onlyLocal.length} finnes bare på denne enheten` : '',
    d.newItems || d.newerItems ? `Innbo: ${d.newItems} nye og ${d.newerItems} endrede gjenstander` : '',
    d.fileCount ? `${d.fileCount} dokumenter/bilder er med i filen` : 'Dokumenter og bilder er ikke med i filen',
  ].filter(Boolean);

  const mode = await new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dialog';
    dlg.setAttribute('aria-labelledby', 'imp-title');
    dlg.innerHTML = `
      <h2 id="imp-title">Importer fil</h2>
      <p class="small">Laget ${esc(formatDate((data.exportedAt || '').slice(0, 10)) || 'ukjent dato')}</p>
      <ul class="diff">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      <p><b>Slå sammen:</b> nyeste versjon av hver polise beholdes. <b>Erstatt alt:</b> alt her byttes ut med filen.</p>
      <div class="dialog-actions">
        <button type="button" class="btn" value="cancel">Avbryt</button>
        <button type="button" class="btn" value="replace">Erstatt alt</button>
        <button type="button" class="btn dark" value="merge">Slå sammen</button>
      </div>`;
    document.body.append(dlg);
    let result = null;
    dlg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      result = b.value === 'cancel' ? null : b.value;
      dlg.close();
    });
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    dlg.showModal();
  });
  if (!mode) return;
  if (mode === 'replace') {
    const ok = await confirmDialog({
      title: 'Erstatte alt?',
      message: 'Alt som ligger på denne enheten blir byttet ut med innholdet i filen. Dette kan ikke angres.',
      confirmText: 'Erstatt alt',
      danger: true,
    });
    if (!ok) return;
  }
  try {
    const r = await actions.importData(data, mode);
    toast(mode === 'replace'
      ? `Ferdig. ${r.policies} poliser og ${r.items} gjenstander er importert.`
      : `Ferdig. ${r.policies} poliser og ${r.items} gjenstander er lagt til eller oppdatert.`, { ms: 6000 });
    ctx.rerender();
  } catch (err) {
    console.error(err);
    toast('Kunne ikke importere filen – er lagringen full?', { error: true, ms: 6000 });
  }
}
