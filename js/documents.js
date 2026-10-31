// Dokumenter: dialog for å legge til fil, og åpning av lagrede filer.

import { DOC_KINDS } from './model.js';
import { esc } from './ui.js';

const MAX_BYTES = 50 * 1024 * 1024;

// Viser dialogen «Legg til dokument». Gir { file, title, kind } eller null.
export function addDocumentDialog(policy) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dialog';
    dlg.setAttribute('aria-labelledby', 'doc-dlg-title');
    dlg.innerHTML = `
    <form novalidate>
      <h2 id="doc-dlg-title">Legg til dokument</h2>
      <p class="small">${esc(policy.company ? `${policy.name} – ${policy.company}` : policy.name)}</p>

      <div class="field">
        <label class="file-pick">
          <input type="file" name="file" accept="application/pdf,image/*" class="visually-hidden">
          <span class="btn wide" aria-hidden="true">📎 Velg fil</span>
          <span class="visually-hidden">Velg fil (PDF eller bilde)</span>
        </label>
        <p class="hint" data-file-name>PDF eller bilde. På iPhone kan du velge fra Filer, iCloud eller ta bilde.</p>
      </div>

      <div class="field">
        <label for="doc-title">Tittel</label>
        <input id="doc-title" name="title" type="text" autocomplete="off" placeholder="F.eks. Polise 2026">
      </div>

      <div class="field">
        <label for="doc-kind">Type dokument</label>
        <select id="doc-kind" name="kind">
          ${DOC_KINDS.map((k) => `<option value="${esc(k.key)}">${esc(k.label)}</option>`).join('')}
        </select>
      </div>

      <p class="error" data-error hidden></p>

      <div class="dialog-actions">
        <button type="button" class="btn" value="cancel">Avbryt</button>
        <button type="submit" class="btn dark">Lagre</button>
      </div>
    </form>`;
    document.body.append(dlg);

    const form = dlg.querySelector('form');
    const fileInput = form.elements.file;
    const titleInput = form.elements.title;
    const errorEl = form.querySelector('[data-error]');
    let titleTouched = false;
    let result = null;

    const showError = (msg) => { errorEl.textContent = msg; errorEl.hidden = !msg; };

    titleInput.addEventListener('input', () => { titleTouched = true; });
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      showError('');
      if (!file) return;
      form.querySelector('[data-file-name]').textContent = `Valgt: ${file.name}`;
      if (!titleTouched || !titleInput.value) {
        titleInput.value = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      }
    });

    form.addEventListener('click', (e) => {
      if (e.target.closest('button[value="cancel"]')) dlg.close();
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const file = fileInput.files[0];
      if (!file) { showError('Velg en fil først.'); return; }
      if (!/^(application\/pdf|image\/)/.test(file.type) && !/\.(pdf|jpe?g|png|heic|heif|gif|webp)$/i.test(file.name)) {
        showError('Bare PDF-filer og bilder kan lagres.');
        return;
      }
      if (file.size > MAX_BYTES) { showError('Filen er for stor (maks 50 MB).'); return; }
      result = {
        file,
        title: titleInput.value.trim() || file.name,
        kind: form.elements.kind.value,
      };
      dlg.close();
    });

    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    dlg.showModal();
    fileInput.focus();
  });
}

// Appen er lagt på hjemskjermen på iPhone/iPad (egen app uten Safari-ramme).
export const isIosStandalone = () => window.navigator.standalone === true;

// Åpner en lagret fil i ny fane via URL.createObjectURL. iOS viser PDF-en i sin egen visning.
// Fra hjemskjerm-appen på iPhone kan nye faner ikke vise filer fra appen, så der
// vises filen i appens egen visning, med «Del / lagre» for å åpne den i Filer, Bøker o.l.
export async function openDocument(ref, getFile, toast) {
  if (isIosStandalone()) {
    try {
      const blob = await getFile(ref.blobKey);
      if (!blob) throw new Error('Fant ikke filen');
      showViewer(ref, blob.type || !ref.type ? blob : new Blob([blob], { type: ref.type }), toast);
    } catch (err) {
      console.error(err);
      toast('Kunne ikke åpne dokumentet.', { error: true });
    }
    return;
  }

  // Fanen må åpnes med en gang (i selve trykket), ellers stopper nettleseren den som popup.
  const win = window.open('', '_blank');
  try {
    const blob = await getFile(ref.blobKey);
    if (!blob) throw new Error('Fant ikke filen');
    const typed = blob.type || !ref.type ? blob : new Blob([blob], { type: ref.type });
    const url = URL.createObjectURL(typed);
    if (win) {
      win.location.href = url;
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
  } catch (err) {
    console.error(err);
    win?.close();
    toast('Kunne ikke åpne dokumentet.', { error: true });
  }
}

// Fullskjermvisning av et dokument inne i appen.
function showViewer(ref, blob, toast) {
  const url = URL.createObjectURL(blob);
  const isImg = (blob.type || '').startsWith('image/');
  const ext = isImg ? '.jpg' : '.pdf';
  const name = (ref.fileName || ref.title || 'dokument').replace(/\.[^.]+$/, '') + ext;
  const file = new File([blob], name, { type: blob.type || (isImg ? 'image/jpeg' : 'application/pdf') });

  const dlg = document.createElement('dialog');
  dlg.className = 'viewer';
  dlg.setAttribute('aria-label', ref.title || 'Dokument');
  dlg.innerHTML = `
    <div class="viewer-bar">
      <button type="button" class="btn" data-v="close">✕ Lukk</button>
      <b class="viewer-title">${esc(ref.title || '')}</b>
      <button type="button" class="btn dark" data-v="share">📤 Del / lagre</button>
    </div>
    <div class="viewer-body">
      ${isImg ? `<img src="${url}" alt="${esc(ref.title || 'Bilde')}">` : `<iframe src="${url}" title="${esc(ref.title || 'PDF')}"></iframe>`}
    </div>`;
  document.body.append(dlg);
  dlg.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    if (b.dataset.v === 'close') dlg.close();
    else if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: ref.title || name }); } catch { /* avbrutt */ }
    } else {
      toast('Deling støttes ikke her.', { error: true });
    }
  });
  dlg.addEventListener('close', () => { dlg.remove(); URL.revokeObjectURL(url); });
  dlg.showModal();
}
