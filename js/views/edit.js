// Rediger forsikring: fullskjerm-ark som glir opp over oversikten.
// Ruter: #/rediger/<id> og #/rediger/ny?type=<type>

import { FIELD_DEFS, TYPES, COMPANIES, typeInfo, newPolicy, companyUrl } from '../model.js';
import { esc, confirmDialog, formatAmountInput, parseAmount } from '../ui.js';

// Enhet som vises etter tallfelt.
const SUFFIX = { kr: 'kr', percent: '%', kmYear: 'km/år', m2: 'm²', days: 'dager' };

export function render(root, ctx) {
  const { state, params, query } = ctx;
  const id = params[0];
  const isNew = id === 'ny';
  let policy;
  if (isNew) {
    const type = TYPES.some((t) => t.key === query.get('type')) ? query.get('type') : 'bil';
    policy = newPolicy(type);
  } else {
    policy = state.policies.find((p) => p.id === id);
    if (!policy) {
      ctx.toast('Fant ikke forsikringen.', { error: true });
      ctx.navigate('#/');
      return;
    }
  }
  const type = typeInfo(policy.type);

  // Oversikten ligger under arket, men er skjult for skjermleser og tastatur.
  ctx.home.render(root, ctx);
  const under = document.createElement('div');
  under.inert = true;
  under.setAttribute('aria-hidden', 'true');
  under.append(...root.childNodes);
  under.querySelectorAll('[data-focus]').forEach((el) => el.removeAttribute('data-focus'));
  root.append(under);
  document.body.classList.add('sheet-open');

  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', 'sheet-title');
  sheet.innerHTML = `
  <form class="sheet-form" novalidate>
    <header class="sheet-head">
      <div class="sheet-head-inner">
        <p class="sheet-kicker">${esc(type.title)}</p>
        <h2 id="sheet-title" tabindex="-1" data-focus>${isNew ? 'Ny polise' : 'Rediger polise'}</h2>
      </div>
    </header>

    <div class="sheet-body">
      <fieldset class="group">
        <legend>Generelt</legend>
        ${textField('name', 'Navn på polisen', policy.name, { hint: 'F.eks. «Bilforsikring» eller «Reise – Nordea-kort»' })}
        ${companyField(policy.company)}
        ${textField('myPageUrl', 'Lenke til Min side', policy.myPageUrl || companyUrl(policy.company), { type: 'url', inputmode: 'url', placeholder: 'https://', hint: 'Fylles ut når du velger selskap. Du kan endre den til selskapets innloggingsside.' })}
        ${textField('policyNumber', 'Polisenummer', policy.policyNumber)}
      </fieldset>

      <fieldset class="group">
        <legend>Pris og vilkår</legend>
        ${amountField('annualPremium', 'Årspremie', policy.annualPremium, 'kr', { hint: 'La stå tomt hvis forsikringen er inkludert i kredittkortet.' })}
        ${textField('premiumNote', 'Merknad om premie', policy.premiumNote, { placeholder: 'F.eks. Inkludert i kredittkortet' })}
        ${textField('renewalDate', 'Fornyelsesdato', policy.renewalDate, { type: 'date' })}
        ${amountField('deductible', 'Egenandel', policy.deductible, 'kr')}
        ${textField('coverage', 'Dekning', policy.coverage, { placeholder: coveragePlaceholder(policy.type) })}
      </fieldset>

      <fieldset class="group">
        <legend>${esc(type.label)} – detaljer</legend>
        ${FIELD_DEFS[policy.type].map((def) => typeField(def, policy.fields?.[def.key])).join('')}
      </fieldset>

      <fieldset class="group">
        <legend>Notater</legend>
        ${textareaField('notes', 'Egne notater', policy.notes)}
      </fieldset>

      ${isNew ? '' : '<button type="button" class="btn danger-outline wide" data-act="delete">🗑️ Slett polise</button>'}
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
  const initial = JSON.stringify(collect(form, policy));
  let closing = false;

  function close() {
    closing = true;
    document.body.classList.remove('sheet-open');
    ctx.back();
  }

  async function cancel() {
    if (JSON.stringify(collect(form, policy)) !== initial) {
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

  // Valg av selskap fyller ut lenken til Min side, og viser fritekst for «Annet».
  form.elements.companySelect.addEventListener('change', (e) => {
    const name = e.target.value;
    const other = form.querySelector('[data-company-other]');
    other.hidden = name !== 'Annet';
    if (name === 'Annet') form.elements.companyOther.focus();
    const url = form.elements.myPageUrl;
    const known = COMPANIES.some((c) => c.url === url.value.trim());
    if (!url.value.trim() || known) url.value = companyUrl(name);
  });

  // Formater beløp når feltet forlates.
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

  form.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'cancel') cancel();
    else if (act === 'delete') {
      const ok = await confirmDialog({
        title: 'Slette polisen?',
        message: `«${policy.name || type.title}» blir slettet fra denne enheten. Dette kan ikke angres.`,
        confirmText: 'Slett',
        danger: true,
      });
      if (!ok) return;
      try {
        await ctx.actions.deletePolicy(policy.id);
        ctx.toast('Polisen er slettet.');
        close();
      } catch (err) {
        console.error(err);
        ctx.toast('Kunne ikke slette polisen. Prøv igjen.', { error: true });
      }
    } else if (act === 'add-valuable') {
      btn.before(htmlToNode(valuableRow({})));
      btn.previousElementSibling.querySelector('input').focus();
    } else if (act === 'remove-valuable') {
      btn.closest('.valuable').remove();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = collect(form, policy);
    if (!validate(form, data)) return;
    if (!data.name) data.name = type.title;
    try {
      const saved = await ctx.actions.savePolicy({ ...policy, ...data, fields: { ...policy.fields, ...data.fields } });
      state.openTypes.add(saved.type);
      ctx.toast('Lagret.');
      close();
    } catch (err) {
      console.error(err);
      ctx.toast('Kunne ikke lagre – er lagringen full?', { error: true });
    }
  });

  sheet.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { e.preventDefault(); cancel(); }
  });

  // Rydd opp hvis brukeren forlater arket med nettleserens tilbakeknapp.
  window.addEventListener('hashchange', function onLeave() {
    window.removeEventListener('hashchange', onLeave);
    if (!closing) document.body.classList.remove('sheet-open');
  });
}

// ---------- Feltbyggere ----------

let uid = 0;
const nextId = (name) => `f-${name}-${++uid}`;

function wrap(id, label, control, hint) {
  return `
  <div class="field">
    <label for="${id}">${esc(label)}</label>
    ${control}
    ${hint ? `<p class="hint" id="${id}-hint">${esc(hint)}</p>` : ''}
  </div>`;
}

function textField(name, label, value, { type = 'text', hint = '', placeholder = '', inputmode = '', autocomplete = 'off', extra = '' } = {}) {
  const id = nextId(name);
  return wrap(id, label, `<input id="${id}" name="${name}" type="${type}" value="${esc(value ?? '')}"
    ${placeholder ? `placeholder="${esc(placeholder)}"` : ''} ${inputmode ? `inputmode="${inputmode}"` : ''}
    autocomplete="${autocomplete}" ${hint ? `aria-describedby="${id}-hint"` : ''} ${extra}>`, hint);
}

function companyField(company) {
  const id = nextId('company');
  const known = !company || COMPANIES.some((c) => c.name === company);
  const selected = known ? company : 'Annet';
  return `
  <div class="field">
    <label for="${id}">Selskap</label>
    <select id="${id}" name="companySelect">
      <option value="">Velg selskap</option>
      ${COMPANIES.map((c) => `<option ${c.name === selected ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
      <option ${selected === 'Annet' ? 'selected' : ''}>Annet</option>
    </select>
  </div>
  <div class="field" data-company-other ${selected === 'Annet' ? '' : 'hidden'}>
    <label for="${id}-other">Navn på selskap</label>
    <input id="${id}-other" name="companyOther" type="text" value="${esc(known ? '' : company)}" autocomplete="organization">
  </div>`;
}

function amountField(name, label, value, suffix, { hint = '', isField = false } = {}) {
  const id = nextId(name);
  const shown = value === null || value === undefined || value === '' ? '' : formatAmountInput(value);
  return wrap(id, label, `
    <div class="with-suffix">
      <input id="${id}" name="${name}" ${isField ? 'data-field' : ''} data-amount type="text" inputmode="numeric"
        value="${esc(shown)}" autocomplete="off" ${hint ? `aria-describedby="${id}-hint"` : ''}>
      <span aria-hidden="true">${esc(suffix)}</span>
    </div>`, hint);
}

function textareaField(name, label, value, { isField = false, placeholder = '' } = {}) {
  const id = nextId(name);
  return wrap(id, label, `<textarea id="${id}" name="${name}" ${isField ? 'data-field' : ''} rows="3"
    ${placeholder ? `placeholder="${esc(placeholder)}"` : ''}>${esc(value ?? '')}</textarea>`);
}

function typeField(def, value) {
  const name = def.key;
  switch (def.kind) {
    case 'kr': case 'percent': case 'kmYear': case 'm2': case 'days':
      return amountField(name, def.label, value, SUFFIX[def.kind], { isField: true });
    case 'year': {
      const id = nextId(name);
      return wrap(id, def.label, `<input id="${id}" name="${name}" data-field data-amount type="text" inputmode="numeric" maxlength="4" value="${esc(value ?? '')}" autocomplete="off">`);
    }
    case 'tel': {
      const id = nextId(name);
      return wrap(id, def.label, `<input id="${id}" name="${name}" data-field type="tel" inputmode="tel" value="${esc(value ?? '')}" placeholder="+47 …" autocomplete="off" aria-describedby="${id}-hint">`,
        'Står i kortvilkårene. Vises stort, og kan ringes direkte fra appen.');
    }
    case 'last4': {
      const id = nextId(name);
      return wrap(id, def.label, `<input id="${id}" name="${name}" data-field type="text" inputmode="numeric" maxlength="4" value="${esc(value ?? '')}" autocomplete="off" aria-describedby="${id}-hint">`,
        'Valgfritt. Skriv aldri hele kortnummeret.');
    }
    case 'textarea':
      return textareaField(name, def.label, value, {
        isField: true,
        placeholder: def.key === 'activation' ? 'F.eks. «Reisen må være betalt med kortet»' : '',
      });
    case 'select': {
      const id = nextId(name);
      return wrap(id, def.label, `
        <select id="${id}" name="${name}" data-field>
          <option value="">Ikke valgt</option>
          ${def.options.map((o) => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}
        </select>`);
    }
    case 'yesno':
      return choiceGroup(def, [['ja', 'Ja'], ['nei', 'Nei'], ['', 'Vet ikke']],
        value === true ? 'ja' : value === false ? 'nei' : '', 'radio');
    case 'multi':
      return choiceGroup(def, def.options.map((o) => [o, o]), value || [], 'checkbox');
    case 'list':
      return `
      <div class="field" role="group" aria-labelledby="lbl-${name}">
        <p class="label" id="lbl-${name}">${esc(def.label)}</p>
        <p class="hint">F.eks. maleri, smykke eller dyr sykkel som er meldt inn særskilt.</p>
        <div class="valuables" data-list="${name}">
          ${(value || []).map(valuableRow).join('')}
          <button type="button" class="btn" data-act="add-valuable">＋ Legg til gjenstand</button>
        </div>
      </div>`;
    default:
      return textField(name, def.label, value, { extra: 'data-field' });
  }
}

function choiceGroup(def, options, selected, kind) {
  const isSel = (v) => (Array.isArray(selected) ? selected.includes(v) : selected === v);
  return `
  <fieldset class="field choice">
    <legend class="label">${esc(def.label)}</legend>
    <div class="choices">
      ${options.map(([v, label]) => `
      <label class="choice-opt">
        <input type="${kind}" name="${def.key}" value="${esc(v)}" data-field data-kind="${def.kind}" ${isSel(v) ? 'checked' : ''}>
        <span>${esc(label)}</span>
      </label>`).join('')}
    </div>
  </fieldset>`;
}

function valuableRow(item) {
  return `
  <div class="valuable">
    <input type="text" data-v="name" aria-label="Gjenstand" placeholder="Gjenstand" value="${esc(item.name ?? '')}" autocomplete="off">
    <div class="with-suffix">
      <input type="text" data-v="value" data-amount inputmode="numeric" aria-label="Verdi i kroner" placeholder="Verdi" value="${esc(item.value ? formatAmountInput(item.value) : '')}" autocomplete="off">
      <span aria-hidden="true">kr</span>
    </div>
    <button type="button" class="btn icon-only" data-act="remove-valuable" aria-label="Fjern gjenstand">✕</button>
  </div>`;
}

function htmlToNode(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ---------- Les og valider skjemaet ----------

function collect(form, policy) {
  const el = form.elements;
  const str = (n) => el[n].value.trim();
  const fields = {};
  for (const def of FIELD_DEFS[policy.type]) {
    const k = def.key;
    switch (def.kind) {
      case 'kr': case 'percent': case 'kmYear': case 'm2': case 'days': case 'year':
        fields[k] = parseAmount(el[k].value); break;
      case 'yesno': {
        const v = form.querySelector(`input[name="${k}"]:checked`)?.value;
        fields[k] = v === 'ja' ? true : v === 'nei' ? false : null; break;
      }
      case 'multi':
        fields[k] = [...form.querySelectorAll(`input[name="${k}"]:checked`)].map((i) => i.value); break;
      case 'list':
        fields[k] = [...form.querySelectorAll(`[data-list="${k}"] .valuable`)]
          .map((row) => ({
            name: row.querySelector('[data-v="name"]').value.trim(),
            value: parseAmount(row.querySelector('[data-v="value"]').value),
          }))
          .filter((x) => x.name || x.value); break;
      default:
        fields[k] = el[k].value.trim();
    }
  }
  return {
    name: str('name'),
    company: el.companySelect.value === 'Annet' ? str('companyOther') : el.companySelect.value,
    myPageUrl: str('myPageUrl'),
    policyNumber: str('policyNumber'),
    annualPremium: parseAmount(el.annualPremium.value),
    premiumNote: str('premiumNote'),
    renewalDate: str('renewalDate'),
    deductible: parseAmount(el.deductible.value),
    coverage: str('coverage'),
    notes: str('notes'),
    fields,
  };
}

function validate(form, data) {
  const errors = [];
  if (data.myPageUrl && !/^https?:\/\/\S+\.\S+/i.test(data.myPageUrl)) {
    if (/^[\w-]+(\.[\w-]+)+/.test(data.myPageUrl)) data.myPageUrl = 'https://' + data.myPageUrl;
    else errors.push(['myPageUrl', 'Lenken må begynne med https://']);
  }
  const last4 = data.fields.cardLast4;
  if (last4 && !/^\d{4}$/.test(last4)) errors.push(['cardLast4', 'Skriv bare de 4 siste sifrene.']);
  const year = data.fields.buildYear;
  if (year && (year < 1700 || year > new Date().getFullYear() + 1)) errors.push(['buildYear', 'Skriv byggeåret med fire sifre.']);
  if (data.fields.bonus !== undefined && data.fields.bonus > 100) errors.push(['bonus', 'Bonus kan ikke være over 100 %.']);

  for (const [name, msg] of errors) {
    const input = form.elements[name];
    const field = input.closest('.field');
    field.classList.add('invalid');
    field.querySelector('.error')?.remove();
    field.insertAdjacentHTML('beforeend', `<p class="error" role="alert">${esc(msg)}</p>`);
  }
  if (errors.length) {
    form.elements[errors[0][0]].focus();
    return false;
  }
  return true;
}

function coveragePlaceholder(type) {
  return { bil: 'F.eks. Fullkasko', hus: 'F.eks. Fullverdi', innbo: 'F.eks. Super', reise: 'F.eks. Familie, helårs' }[type] || '';
}
