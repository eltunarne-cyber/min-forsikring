// Innboregister: rom, gjenstander, bilder og kvitteringer.
// Ruter: #/innbo, #/innbo/<gjenstand-id>, #/innbo/ny?rom=<rom-id>

import { policiesOfType, formatKr, uuid, itemsValue } from '../model.js';
import { esc, subHeader, setExpanded, confirmDialog, promptDialog, formatAmountInput, parseAmount } from '../ui.js';
import { compressImage, isImage, isPdf } from '../images.js';
import { openDocument } from '../documents.js';

const ROOM_ICONS = { Stue: '🛋️', Kjøkken: '🍳', Soverom: '🛏️', Bad: '🛁', Kontor: '💻', 'Bod/garasje': '🧰' };
const roomIcon = (name) => ROOM_ICONS[name] || '📦';

// Objekt-URL-er for miniatyrbilder. Frigjøres hver gang visningen tegnes på nytt.
let thumbUrls = [];
function releaseThumbs() {
  thumbUrls.forEach((u) => URL.revokeObjectURL(u));
  thumbUrls = [];
}

export function render(root, ctx) {
  const { state, query, params } = ctx;
  if (query.get('ny')) { location.replace('#/innbo/ny'); return; }
  if (!state.openRooms) state.openRooms = new Set();
  releaseThumbs();

  renderList(root, ctx);
  if (params[0]) openItemSheet(root, ctx, params[0]);
}

// ---------- Liste over rom ----------

function renderList(root, ctx) {
  const { state } = ctx;
  const { rooms, items } = state.inventory;
  const total = itemsValue(items);
  const innbo = policiesOfType(state.policies, 'innbo')[0];
  const sumInsured = innbo?.fields?.sumInsured || 0;
  const ratio = sumInsured ? Math.min(1, total / sumInsured) : 0;

  root.innerHTML = `
  ${subHeader({
    title: 'Innboregister',
    sub: `${items.length} ${items.length === 1 ? 'gjenstand' : 'gjenstander'} · ${formatKr(total)}`,
    cls: 'rem',
    backHref: '#/paminnelser',
    backText: 'Påminnelser',
  })}
  <main class="content">
    <div class="panel">
      <p class="lbl" style="margin-top:0">Registrert verdi mot forsikringssum</p>
      <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="${sumInsured}" aria-valuenow="${total}" aria-label="Registrert verdi"><i style="width:${Math.round(ratio * 100)}%"></i></div>
      <p class="small">${sumInsured
        ? `${esc(formatKr(total))} registrert av ${esc(formatKr(sumInsured))} forsikringssum`
        : `${esc(formatKr(total))} registrert. Legg inn forsikringssum på innbopolisen for å sammenligne.`}</p>
      <p class="small" style="margin-top:6px">Lagres kun på denne enheten.</p>
      <div class="actions" style="padding:12px 0 0">
        <button class="btn dark" data-action="new-item">＋ Legg til gjenstand</button>
      </div>
    </div>

    ${rooms.map((r) => roomCard(r, items.filter((i) => i.roomId === r.id), state)).join('')}

    <button class="btn wide" data-action="new-room">＋ Nytt rom</button>
  </main>`;

  for (const el of root.querySelectorAll('.card[data-room]')) {
    const id = el.dataset.room;
    if (state.openRooms.has(id)) setExpanded(el, true, { animate: false });
    el.addEventListener('click', (e) => {
      if (e.target.closest('.body')) return;
      const open = !el.classList.contains('open');
      if (open) state.openRooms.add(id); else state.openRooms.delete(id);
      setExpanded(el, open);
    });
  }

  root.querySelector('main').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) handleListAction(btn, ctx);
  });

  loadThumbs(root, ctx);
}

function roomCard(room, items, state) {
  const sum = itemsValue(items);
  const sorted = [...items].sort((a, b) => (b.value || 0) - (a.value || 0));
  return `
  <article class="card" data-room="${room.id}">
    <button class="card-toggle" id="toggle-room-${room.id}" aria-expanded="false" aria-controls="body-room-${room.id}">
      <span class="head">
        <span class="icon e" aria-hidden="true">${roomIcon(room.name)}</span>
        <span class="meta">
          <span class="t"><span class="name">${esc(room.name)}</span></span>
          <span class="p">${items.length ? `${items.length} ${items.length === 1 ? 'gjenstand' : 'gjenstander'} · ${esc(formatKr(sum))}` : 'Ingen gjenstander'}</span>
        </span>
        <span class="chev" aria-hidden="true"><svg viewBox="0 0 14 14"><path d="M2.5 5l4.5 4.5L11.5 5" fill="none" stroke="#163f35" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      </span>
    </button>
    <div class="body" id="body-room-${room.id}" role="region" aria-labelledby="toggle-room-${room.id}" inert>
      ${items.length ? `
      <ul class="item-list">
        ${sorted.map((i) => `
        <li>
          <a class="item" href="#/innbo/${i.id}">
            <span class="thumb" data-thumb="${esc(i.photoKey || '')}" aria-hidden="true">📦</span>
            <span class="item-text">
              <b>${esc(i.name)}</b>
              <small>${esc([i.year ? `Kjøpt ${i.year}` : '', i.receiptKey ? '🧾 Kvittering' : ''].filter(Boolean).join(' · ') || 'Trykk for å endre')}</small>
            </span>
            <span class="item-value">${i.value ? esc(formatKr(i.value)) : '–'}</span>
          </a>
        </li>`).join('')}
      </ul>` : '<p class="small room-empty">Ingen gjenstander i dette rommet ennå.</p>'}
      <div class="actions">
        <button class="btn dark" data-action="new-item" data-room="${room.id}">＋ Legg til her</button>
        <button class="btn" data-action="rename-room" data-room="${room.id}">✏️ Gi nytt navn</button>
        <button class="btn" data-action="delete-room" data-room="${room.id}">🗑️ Slett rom</button>
      </div>
    </div>
  </article>`;
}

async function loadThumbs(root, ctx) {
  for (const el of root.querySelectorAll('[data-thumb]')) {
    const key = el.dataset.thumb;
    if (!key) continue;
    try {
      const blob = await ctx.actions.getFile(key);
      if (!blob || !el.isConnected) continue;
      const url = URL.createObjectURL(blob);
      thumbUrls.push(url);
      el.innerHTML = `<img src="${url}" alt="">`;
    } catch (err) {
      console.error(err);
    }
  }
}

async function handleListAction(btn, ctx) {
  const { state, actions, toast } = ctx;
  const { action, room } = btn.dataset;
  const r = state.inventory.rooms.find((x) => x.id === room);
  try {
    if (action === 'new-item') {
      ctx.navigate(room ? `#/innbo/ny?rom=${room}` : '#/innbo/ny');
    } else if (action === 'new-room') {
      const name = await promptDialog({ title: 'Nytt rom', label: 'Navn på rommet', confirmText: 'Legg til' });
      if (!name) return;
      const order = Math.max(-1, ...state.inventory.rooms.map((x) => x.order ?? 0)) + 1;
      const saved = await actions.saveRoom({ id: uuid(), name, order, createdAt: new Date().toISOString() });
      state.openRooms.add(saved.id);
      ctx.rerender();
    } else if (action === 'rename-room') {
      const name = await promptDialog({ title: 'Gi nytt navn', label: 'Navn på rommet', value: r.name });
      if (!name || name === r.name) return;
      await actions.saveRoom({ ...r, name });
      ctx.rerender();
    } else if (action === 'delete-room') {
      const n = state.inventory.items.filter((i) => i.roomId === room).length;
      const ok = await confirmDialog({
        title: `Slette «${r.name}»?`,
        message: n
          ? `Rommet har ${n} ${n === 1 ? 'gjenstand' : 'gjenstander'}. De blir slettet sammen med bilder og kvitteringer. Dette kan ikke angres.`
          : 'Rommet er tomt.',
        confirmText: 'Slett',
        danger: true,
      });
      if (!ok) return;
      await actions.deleteRoom(room);
      toast('Rommet er slettet.');
      ctx.rerender();
    }
  } catch (err) {
    console.error(err);
    toast('Kunne ikke lagre endringen – er lagringen full?', { error: true });
  }
}

// ---------- Ark for én gjenstand ----------

function openItemSheet(root, ctx, id) {
  const { state, query, actions, toast } = ctx;
  const isNew = id === 'ny';
  const rooms = state.inventory.rooms;
  let item = state.inventory.items.find((x) => x.id === id);
  if (!isNew && !item) {
    toast('Fant ikke gjenstanden.', { error: true });
    location.replace('#/innbo');
    return;
  }
  if (isNew) {
    const roomId = rooms.some((r) => r.id === query.get('rom')) ? query.get('rom') : rooms[0]?.id || '';
    item = { id: uuid(), roomId, name: '', value: null, year: null, note: '', photoKey: '', receiptKey: '', createdAt: new Date().toISOString() };
  }

  // Listen ligger under arket, men er skjult for skjermleser og tastatur.
  const under = document.createElement('div');
  under.inert = true;
  under.setAttribute('aria-hidden', 'true');
  under.append(...root.childNodes);
  under.querySelectorAll('[data-focus]').forEach((el) => el.removeAttribute('data-focus'));
  root.append(under);
  document.body.classList.add('sheet-open');

  // Filer som er valgt, men ikke lagret ennå: undefined = uendret, null = fjernet, Blob = ny.
  const pending = { photo: undefined, receipt: undefined };
  let previewUrl = null;

  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', 'sheet-title');
  sheet.innerHTML = `
  <form class="sheet-form" novalidate>
    <header class="sheet-head">
      <div class="sheet-head-inner">
        <p class="sheet-kicker">Innboregister</p>
        <h2 id="sheet-title" tabindex="-1" data-focus>${isNew ? 'Ny gjenstand' : 'Rediger gjenstand'}</h2>
      </div>
    </header>
    <div class="sheet-body">
      <fieldset class="group">
        <legend>Gjenstand</legend>
        <div class="field">
          <label for="it-name">Navn</label>
          <input id="it-name" name="name" type="text" value="${esc(item.name)}" placeholder="F.eks. TV, sofa, maleri" autocomplete="off">
        </div>
        <div class="field">
          <label for="it-room">Rom</label>
          <select id="it-room" name="roomId">
            ${rooms.map((r) => `<option value="${r.id}" ${r.id === item.roomId ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="it-value">Verdi</label>
          <div class="with-suffix">
            <input id="it-value" name="value" data-amount type="text" inputmode="numeric" value="${esc(item.value ? formatAmountInput(item.value) : '')}" autocomplete="off" aria-describedby="it-value-hint">
            <span aria-hidden="true">kr</span>
          </div>
          <p class="hint" id="it-value-hint">Hva det ville kostet å kjøpe tilsvarende nytt i dag.</p>
        </div>
        <div class="field">
          <label for="it-year">Kjøpsår</label>
          <input id="it-year" name="year" type="text" inputmode="numeric" maxlength="4" value="${esc(item.year ?? '')}" autocomplete="off">
        </div>
        <div class="field">
          <label for="it-note">Merknad</label>
          <textarea id="it-note" name="note" rows="3" placeholder="F.eks. modell, serienummer eller hvor den er kjøpt">${esc(item.note || '')}</textarea>
        </div>
      </fieldset>

      <fieldset class="group">
        <legend>Bilde</legend>
        <div class="photo-box" data-photo-box>
          <div class="photo-preview" data-photo-preview>${item.photoKey ? '' : '<span aria-hidden="true">📷</span>'}</div>
          <div class="file-actions">
            <label class="file-pick">
              <input type="file" name="photo" accept="image/*" class="visually-hidden">
              <span class="btn dark wide" aria-hidden="true">📷 Ta eller velg bilde</span>
              <span class="visually-hidden">Ta eller velg bilde</span>
            </label>
            <button type="button" class="btn wide" data-act="remove-photo" ${item.photoKey ? '' : 'hidden'}>Fjern bilde</button>
          </div>
        </div>
        <p class="hint" data-photo-status>Bildet gjøres mindre før det lagres.</p>
      </fieldset>

      <fieldset class="group">
        <legend>Kvittering</legend>
        <p class="small" data-receipt-name>${item.receiptKey ? `🧾 ${esc(item.receiptName || 'Kvittering')}` : 'Ingen kvittering lagt inn.'}</p>
        <div class="file-actions" style="margin-top:10px">
          <label class="file-pick">
            <input type="file" name="receipt" accept="image/*,application/pdf" class="visually-hidden">
            <span class="btn wide" aria-hidden="true">🧾 Legg til kvittering (bilde eller PDF)</span>
            <span class="visually-hidden">Legg til kvittering, bilde eller PDF</span>
          </label>
          <button type="button" class="btn wide" data-act="open-receipt" ${item.receiptKey ? '' : 'hidden'}>Åpne kvittering</button>
          <button type="button" class="btn wide" data-act="remove-receipt" ${item.receiptKey ? '' : 'hidden'}>Fjern kvittering</button>
        </div>
      </fieldset>

      <p class="note">Lagres kun på denne enheten.</p>
      ${isNew ? '' : '<button type="button" class="btn danger-outline wide" data-act="delete">🗑️ Slett gjenstand</button>'}
    </div>
    <footer class="sheet-foot">
      <div class="sheet-foot-inner">
        <button type="button" class="btn" data-act="cancel">Avbryt</button>
        <button type="submit" class="btn dark">Lagre</button>
      </div>
    </footer>
  </form>`;
  root.append(sheet);

  const form = sheet.querySelector('form');
  const preview = form.querySelector('[data-photo-preview]');
  const photoStatus = form.querySelector('[data-photo-status]');
  const receiptName = form.querySelector('[data-receipt-name]');
  const btnRemovePhoto = form.querySelector('[data-act="remove-photo"]');
  const btnOpenReceipt = form.querySelector('[data-act="open-receipt"]');
  const btnRemoveReceipt = form.querySelector('[data-act="remove-receipt"]');
  let busy = false;

  function showPreview(blob) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = blob ? URL.createObjectURL(blob) : null;
    preview.innerHTML = previewUrl ? `<img src="${previewUrl}" alt="Bilde av gjenstanden">` : '<span aria-hidden="true">📷</span>';
  }
  if (item.photoKey) actions.getFile(item.photoKey).then((b) => b && showPreview(b)).catch(console.error);

  const collect = () => ({
    name: form.elements.name.value.trim(),
    roomId: form.elements.roomId.value,
    value: parseAmount(form.elements.value.value),
    year: parseAmount(form.elements.year.value),
    note: form.elements.note.value.trim(),
  });
  const initial = JSON.stringify(collect());
  const dirty = () => JSON.stringify(collect()) !== initial || pending.photo !== undefined || pending.receipt !== undefined;

  let closing = false;
  function close() {
    closing = true;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    document.body.classList.remove('sheet-open');
    ctx.back();
  }
  async function cancel() {
    if (dirty()) {
      const ok = await confirmDialog({
        title: 'Forkaste endringene?',
        message: 'Endringene du har gjort blir ikke lagret.',
        confirmText: 'Forkast',
        cancelText: 'Fortsett å redigere',
      });
      if (!ok) return;
    }
    close();
  }

  form.addEventListener('focusout', (e) => {
    if (e.target.matches('[data-amount]')) e.target.value = formatAmountInput(e.target.value);
  });
  form.addEventListener('input', (e) => {
    const field = e.target.closest('.field');
    if (field?.classList.contains('invalid')) {
      field.classList.remove('invalid');
      field.querySelector('.error')?.remove();
    }
  });

  form.elements.photo.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!isImage(file)) { photoStatus.textContent = 'Velg et bilde (JPEG, PNG eller HEIC).'; return; }
    busy = true;
    photoStatus.textContent = 'Behandler bildet …';
    try {
      const blob = await compressImage(file);
      pending.photo = blob;
      showPreview(blob);
      btnRemovePhoto.hidden = false;
      photoStatus.textContent = `Bildet er klart (${Math.round(blob.size / 1024)} kB). Trykk Lagre.`;
    } catch (err) {
      console.error(err);
      photoStatus.textContent = 'Kunne ikke lese bildet. Prøv et annet bilde.';
    } finally {
      busy = false;
    }
  });

  form.elements.receipt.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    busy = true;
    try {
      if (isPdf(file)) {
        pending.receipt = file;
      } else if (isImage(file)) {
        receiptName.textContent = 'Behandler bildet …';
        const blob = await compressImage(file);
        pending.receipt = new File([blob], (file.name || 'kvittering').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
      } else {
        receiptName.textContent = 'Bare bilder og PDF-filer kan brukes som kvittering.';
        return;
      }
      receiptName.textContent = `🧾 ${pending.receipt.name} (ikke lagret ennå)`;
      btnRemoveReceipt.hidden = false;
      btnOpenReceipt.hidden = true;
    } catch (err) {
      console.error(err);
      receiptName.textContent = 'Kunne ikke lese filen. Prøv en annen.';
    } finally {
      busy = false;
    }
  });

  form.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'cancel') cancel();
    else if (act === 'remove-photo') {
      pending.photo = item.photoKey ? null : undefined;
      showPreview(null);
      btnRemovePhoto.hidden = true;
      photoStatus.textContent = 'Bildet fjernes når du trykker Lagre.';
    } else if (act === 'remove-receipt') {
      pending.receipt = item.receiptKey ? null : undefined;
      receiptName.textContent = item.receiptKey ? 'Kvitteringen fjernes når du trykker Lagre.' : 'Ingen kvittering lagt inn.';
      btnRemoveReceipt.hidden = true;
      btnOpenReceipt.hidden = true;
    } else if (act === 'open-receipt') {
      openDocument({ blobKey: item.receiptKey, type: item.receiptType }, actions.getFile, toast);
    } else if (act === 'delete') {
      const ok = await confirmDialog({
        title: 'Slette gjenstanden?',
        message: `«${item.name}» blir slettet sammen med bilde og kvittering. Dette kan ikke angres.`,
        confirmText: 'Slett',
        danger: true,
      });
      if (!ok) return;
      try {
        await actions.deleteItem(item.id);
        toast('Gjenstanden er slettet.');
        close();
      } catch (err) {
        console.error(err);
        toast('Kunne ikke slette gjenstanden. Prøv igjen.', { error: true });
      }
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) { toast('Vent litt – bildet behandles.'); return; }
    const data = collect();
    const nameField = form.elements.name.closest('.field');
    nameField.querySelector('.error')?.remove();
    nameField.classList.remove('invalid');
    if (!data.name) {
      nameField.classList.add('invalid');
      nameField.insertAdjacentHTML('beforeend', '<p class="error" role="alert">Skriv hva gjenstanden er.</p>');
      form.elements.name.focus();
      return;
    }
    if (!data.roomId) { toast('Lag et rom først.', { error: true }); return; }
    try {
      await actions.saveItem({ ...item, ...data }, pending);
      state.openRooms.add(data.roomId);
      toast('Gjenstanden er lagret.');
      close();
    } catch (err) {
      console.error(err);
      toast('Kunne ikke lagre gjenstanden – er lagringen full?', { error: true, ms: 6000 });
    }
  });

  sheet.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { e.preventDefault(); cancel(); }
  });
  window.addEventListener('hashchange', function onLeave() {
    window.removeEventListener('hashchange', onLeave);
    if (!closing) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      document.body.classList.remove('sheet-open');
    }
  });
}
