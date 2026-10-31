// Datamodell, typedefinisjoner, eksempeldata og beregninger.

export const TYPES = [
  { key: 'bil', label: 'Bil', title: 'Bilforsikring', color: '#ffd57a' },
  { key: 'hus', label: 'Hus', title: 'Husforsikring', color: '#e9806b' },
  { key: 'innbo', label: 'Innbo', title: 'Innboforsikring', color: '#f3a1b5' },
  { key: 'reise', label: 'Reise', title: 'Reiseforsikring', color: '#6fcfa8' },
];

export const typeInfo = (key) => TYPES.find((t) => t.key === key);

export const APP_VERSION = '1.0.0';

export const DEFAULT_SETTINGS = {
  warnDays: 30,
  docHelpSeen: false, // hjelpeteksten om å hente poliser fra Min side er vist
  updatedAt: null,
};

// Typespesifikke felt. `kind` styrer visning (og redigering i steg 2).
// `summary: true` vises i detaljtabellen når feltet har verdi.
// `important: true` vises alltid, også når feltet er tomt («Ikke fylt ut»).
export const FIELD_DEFS = {
  bil: [
    { key: 'regNo', label: 'Registreringsnummer', kind: 'text', summary: true },
    { key: 'carModel', label: 'Bilmerke/modell', kind: 'text', summary: true },
    { key: 'bonus', label: 'Bonus', kind: 'percent', summary: true },
    { key: 'mileage', label: 'Kjørelengde', kind: 'kmYear', summary: true },
    { key: 'youngDriver', label: 'Yngste fører under 23', kind: 'yesno', summary: true },
    { key: 'rentalCar', label: 'Leiebil', kind: 'yesno', summary: true },
    { key: 'roadside', label: 'Veihjelp', kind: 'yesno', summary: true },
  ],
  hus: [
    { key: 'address', label: 'Adresse', kind: 'text', summary: true },
    { key: 'buildYear', label: 'Byggeår', kind: 'year', summary: true },
    { key: 'area', label: 'Areal', kind: 'm2', summary: true },
    { key: 'form', label: 'Forsikringsform', kind: 'select', options: ['Fullverdi', 'Førsterisiko'], summary: true },
    { key: 'outbuildings', label: 'Tilleggsbygg', kind: 'text', summary: true },
    { key: 'rot', label: 'Sopp/råte', kind: 'yesno', summary: true },
    { key: 'pests', label: 'Skadedyr', kind: 'yesno', summary: true },
  ],
  innbo: [
    { key: 'sumInsured', label: 'Forsikringssum', kind: 'kr', summary: true, important: true },
    { key: 'valuables', label: 'Enkeltgjenstander over grensen', kind: 'list', summary: true },
    { key: 'bicycle', label: 'Sykkel', kind: 'text', summary: true },
    { key: 'jewelry', label: 'Smykker', kind: 'text', summary: true },
  ],
  reise: [
    { key: 'area', label: 'Dekningsområde', kind: 'select', options: ['Norden', 'Europa', 'Verden'], summary: true, important: true },
    { key: 'maxDays', label: 'Maks varighet per reise', kind: 'days', summary: true, important: true },
    { key: 'covered', label: 'Hvem er dekket', kind: 'multi', options: ['Meg', 'Ektefelle', 'Barn'], summary: true },
    { key: 'ageLimit', label: 'Aldersbegrensning', kind: 'text', summary: true },
    { key: 'activation', label: 'Aktiveringsvilkår', kind: 'textarea', summary: true, important: true },
    { key: 'cancellation', label: 'Avbestilling', kind: 'yesno', summary: true },
    { key: 'cancellationAmount', label: 'Avbestilling, beløp', kind: 'kr', summary: true },
    { key: 'baggage', label: 'Bagasje', kind: 'kr', summary: true },
    { key: 'emergencyPhone', label: 'Medisinsk nødnummer', kind: 'tel', important: true },
    { key: 'cardLast4', label: 'Kortets siste 4 siffer', kind: 'last4', summary: true },
  ],
};

// Norske forsikringsselskaper og kortutstedere. Lenken er selskapets forside,
// der brukeren finner innlogging til «Min side». Brukeren kan endre lenken.
export const COMPANIES = [
  { name: 'If', url: 'https://www.if.no' },
  { name: 'Gjensidige', url: 'https://www.gjensidige.no' },
  { name: 'Tryg', url: 'https://www.tryg.no' },
  { name: 'Fremtind (SpareBank 1/DNB)', url: 'https://www.fremtind.no' },
  { name: 'Storebrand', url: 'https://www.storebrand.no' },
  { name: 'Frende', url: 'https://www.frende.no' },
  { name: 'Codan', url: 'https://www.codan.no' },
  { name: 'Eika', url: 'https://www.eika.no' },
  { name: 'KLP', url: 'https://www.klp.no' },
  { name: 'Bank Norwegian', url: 'https://www.banknorwegian.no' },
  { name: 'Nordea', url: 'https://www.nordea.no' },
];

export const companyUrl = (name) => COMPANIES.find((c) => c.name === name)?.url || '';

// Lenken «Min side» bruker: egen lenke hvis den er lagt inn, ellers selskapets forside.
export const myPageUrlOf = (p) => p.myPageUrl || companyUrl(p.company);

export const DOC_KINDS = [
  { key: 'polise', label: 'Polise' },
  { key: 'vilkår', label: 'Vilkår' },
  { key: 'forsikringsbevis', label: 'Forsikringsbevis' },
  { key: 'annet', label: 'Annet' },
];
export const docKindLabel = (key) => DOC_KINDS.find((k) => k.key === key)?.label || 'Annet';

export function formatBytes(n) {
  if (!n) return '';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))}\u00a0kB`;
  return `${(n / 1024 / 1024).toLocaleString('nb-NO', { maximumFractionDigits: 1 })}\u00a0MB`;
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function newPolicy(type, extra = {}) {
  return {
    id: uuid(),
    type,
    name: typeInfo(type)?.title ?? '',
    company: '',
    myPageUrl: '',
    policyNumber: '',
    annualPremium: null,
    premiumNote: '',
    renewalDate: '',
    deductible: null,
    coverage: '',
    fields: {},
    notes: '',
    documents: [],
    isExample: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

// Eksempeldata ved første oppstart (seksjon 11). Brukeren erstatter dem selv.
export function createExampleData() {
  const ex = { isExample: true };
  const cardTravelFields = () => ({
    area: '', maxDays: null, covered: [], ageLimit: '', activation: '',
    cancellation: null, cancellationAmount: null, baggage: null, emergencyPhone: '', cardLast4: '',
  });
  const list = [
    newPolicy('bil', {
      ...ex,
      coverage: 'Fullkasko',
      annualPremium: 6950,
      renewalDate: '2027-01-01',
      deductible: 6000,
      policyNumber: '123 456 789',
      fields: { bonus: 75, mileage: 16000 },
    }),
    newPolicy('hus', {
      ...ex,
      coverage: 'Fullverdi',
      annualPremium: 9800,
      renewalDate: '2027-05-15',
      deductible: 8000,
      policyNumber: '123 456 790',
      fields: { area: 180, form: 'Fullverdi' },
    }),
    newPolicy('innbo', {
      ...ex,
      annualPremium: 4120,
      renewalDate: '2027-05-15',
      deductible: 4000,
      policyNumber: '123 456 791',
      fields: { sumInsured: 1500000 },
    }),
    newPolicy('reise', {
      ...ex,
      name: 'Reise – Bank Norwegian-kort',
      company: 'Bank Norwegian',
      premiumNote: 'Inkludert i kredittkortet',
      fields: cardTravelFields(),
    }),
    newPolicy('reise', {
      ...ex,
      name: 'Reise – Nordea-kort',
      company: 'Nordea',
      premiumNote: 'Inkludert i kredittkortet',
      fields: cardTravelFields(),
    }),
  ];
  // Faste ID-er, slik at eksempeldataene på begge telefonene er «samme» polise.
  // Da blir det ikke dobbelt opp når ektefellene deler og slår sammen data.
  const ids = ['eksempel-bil', 'eksempel-hus', 'eksempel-innbo', 'eksempel-reise-bank-norwegian', 'eksempel-reise-nordea'];
  // Fast rekkefølge (Bank Norwegian før Nordea) selv om alle lages samme millisekund.
  // Gammel tidsstempel, slik at alt brukeren selv har lagret regnes som nyere.
  const t0 = Date.UTC(2026, 0, 1);
  list.forEach((p, i) => { p.id = ids[i]; p.createdAt = p.updatedAt = new Date(t0 + i).toISOString(); });
  return list;
}

// ---------- Formatering ----------

const nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
export const formatNumber = (n) => nf.format(n);
export const formatKr = (n) => nf.format(n ?? 0) + ' kr';

export function formatDate(iso) {
  const d = parseDate(iso);
  if (!d) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

const isEmpty = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

export function formatField(def, value) {
  if (isEmpty(value)) return '';
  switch (def.kind) {
    case 'kr': return formatKr(Number(value));
    case 'percent': return `${formatNumber(Number(value))} %`;
    case 'kmYear': return `${formatNumber(Number(value))} km/år`;
    case 'm2': return `${formatNumber(Number(value))} m²`;
    case 'days': return `Inntil ${formatNumber(Number(value))} dager`;
    case 'yesno': return value ? 'Ja' : 'Nei';
    case 'multi': return value.join(', ');
    case 'list': return value.length === 1 ? '1 gjenstand' : `${value.length} gjenstander`;
    case 'last4': return `•••• ${value}`;
    default: return String(value);
  }
}

// ---------- Datoer og beregninger ----------

export function parseDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysUntil(iso, now = today()) {
  const d = parseDate(iso);
  if (!d) return null;
  return Math.round((d - now) / 86400000);
}

// Andel av forsikringsåret som har gått (12 måneder bakover fra fornyelsesdato), 0–1.
export function yearProgress(iso, now = today()) {
  const end = parseDate(iso);
  if (!end) return 0;
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 1);
  const p = (now - start) / (end - start);
  return Math.min(1, Math.max(0, p));
}

// 'ok' (grønn), 'warn' (oransje), 'over' (rød), eller null uten dato.
export function renewalStatus(iso, warnDays, now = today()) {
  const days = daysUntil(iso, now);
  if (days === null) return null;
  if (days < 0) return 'over';
  if (days < warnDays) return 'warn';
  return 'ok';
}

// Polisene i en type, i den rekkefølgen de ble lagt inn.
export const policiesOfType = (policies, type) => policies
  .filter((p) => p.type === type)
  .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

export const premiumOf = (p) => (typeof p.annualPremium === 'number' && p.annualPremium > 0 ? p.annualPremium : 0);

export const totalPremium = (policies) => policies.reduce((sum, p) => sum + premiumOf(p), 0);

export function earliestRenewal(policies) {
  const dates = policies.map((p) => p.renewalDate).filter((d) => parseDate(d));
  dates.sort();
  return dates[0] || '';
}

// Rader til detaljtabellen for én polise.
// opts.showCompany: vis selskap som egen rad. opts.multi: polisen er én av flere i typen.
export function describePolicy(p, { showCompany = true, multi = false } = {}) {
  const rows = [];
  if (showCompany) rows.push({ label: 'Selskap', value: p.company || '', emptyText: 'Ikke valgt' });
  if (multi) {
    rows.push({
      label: 'Premie',
      value: premiumOf(p) ? `${formatKr(p.annualPremium)} / år` : (p.premiumNote || ''),
      emptyText: 'Ikke fylt ut',
    });
    rows.push({ label: 'Fornyes', value: formatDate(p.renewalDate), emptyText: 'Ikke satt', hideEmpty: true });
  } else if (!premiumOf(p) && p.premiumNote) {
    rows.push({ label: 'Premie', value: p.premiumNote });
  }
  if (p.coverage) rows.push({ label: 'Dekning', value: p.coverage });
  if (p.deductible !== null && p.deductible !== undefined && p.deductible !== '') {
    rows.push({ label: 'Egenandel', value: formatKr(Number(p.deductible)) });
  }
  for (const def of FIELD_DEFS[p.type] || []) {
    const value = formatField(def, p.fields?.[def.key]);
    // Felt uten `summary` (f.eks. nødnummer) vises på egen måte når de har verdi.
    if (!def.summary && (value || !def.important)) continue;
    if (value || def.important) rows.push({ label: def.label, value, emptyText: 'Ikke fylt ut' });
  }
  if (p.policyNumber) rows.push({ label: 'Polisenr.', value: p.policyNumber });
  return rows.filter((r) => r.value || !r.hideEmpty);
}

// ---------- Påminnelser ----------

export const WARN_OPTIONS = [14, 30, 60, 90];
export const QUOTE_DAYS = 42;          // hent tilbud ca. 6 uker før fornyelse
export const INVENTORY_MAX_MONTHS = 12; // innboregisteret bør oppdateres minst årlig

export function addDays(iso, days) {
  const d = parseDate(iso);
  if (!d) return null;
  d.setDate(d.getDate() + days);
  return d;
}

const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
export const formatDayMonth = (d) => `${d.getDate()}. ${MONTHS[d.getMonth()]}`;

// «om 63 dager», «i dag», «i morgen», «passert for 3 dager siden»
export function daysText(days) {
  if (days === null) return '';
  if (days === 0) return 'i dag';
  if (days === 1) return 'i morgen';
  if (days > 1) return `om ${days} dager`;
  return days === -1 ? 'passert i går' : `passert for ${-days} dager siden`;
}

// Alle poliser sortert etter fornyelsesdato (uten dato til slutt).
export function renewalList(policies, warnDays, now = today()) {
  return policies
    .map((p) => ({ policy: p, days: daysUntil(p.renewalDate, now), status: renewalStatus(p.renewalDate, warnDays, now) }))
    .sort((a, b) => (a.days ?? Infinity) - (b.days ?? Infinity));
}

// Nøkkel for «forsikringsåret» en avkrysning gjelder. Når fornyelsesdatoen endres
// (nytt forsikringsår), passer ikke nøkkelen lenger, og avkrysningen nullstilles.
export function quoteYearKey(policies, type, now = today()) {
  const date = earliestRenewal(policiesOfType(policies, type));
  return date || `år-${now.getFullYear()}`;
}

export function isQuoteChecked(quoteChecks, policies, type) {
  return quoteChecks?.[type]?.key === quoteYearKey(policies, type);
}

// Typer der det er under 6 uker til fornyelse og tilbud ikke er krysset av.
export function quoteDue(policies, quoteChecks, now = today()) {
  return TYPES.filter((t) => {
    const date = earliestRenewal(policiesOfType(policies, t.key));
    const days = daysUntil(date, now);
    return days !== null && days >= 0 && days < QUOTE_DAYS && !isQuoteChecked(quoteChecks, policies, t.key);
  }).map((t) => t.key);
}

export function monthsSince(iso, now = new Date()) {
  if (!iso) return null;
  const d = new Date(iso);
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()) - (now.getDate() < d.getDate() ? 1 : 0);
}

export function inventoryDue(inventoryUpdatedAt) {
  const m = monthsSince(inventoryUpdatedAt);
  return m !== null && m >= INVENTORY_MAX_MONTHS;
}

// Antall påminnelser som krever handling (tellemerket på bunnknappen).
export function reminderCount({ policies, settings, quoteChecks, inventoryUpdatedAt }) {
  const renewals = renewalList(policies, settings.warnDays).filter((r) => r.status === 'warn' || r.status === 'over').length;
  return renewals + quoteDue(policies, quoteChecks).length + (inventoryDue(inventoryUpdatedAt) ? 1 : 0);
}

// ---------- Innboregister ----------

export const DEFAULT_ROOMS = ['Stue', 'Kjøkken', 'Soverom', 'Bad', 'Kontor', 'Bod/garasje'];

export function defaultRooms() {
  const t0 = Date.UTC(2026, 0, 1);
  // Faste ID-er (som eksempeldataene), slik at «Stue» er samme rom på begge telefonene.
  return DEFAULT_ROOMS.map((name, i) => ({
    id: 'rom-' + name.toLowerCase().replace(/[^a-zæøå]+/g, '-'),
    name,
    order: i,
    createdAt: new Date(t0 + i).toISOString(),
    updatedAt: new Date(t0 + i).toISOString(),
  }));
}

export const sortRooms = (rooms) => [...rooms].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt || '').localeCompare(b.createdAt || ''));

export const itemsValue = (items) => items.reduce((s, i) => s + (Number(i.value) || 0), 0);
