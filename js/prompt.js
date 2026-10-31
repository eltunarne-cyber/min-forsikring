// Bygger teksten til Claude ut fra polisene (seksjon 9 i SPEC.md).

import {
  TYPES, FIELD_DEFS, policiesOfType, premiumOf, formatKr, formatDate, formatField, itemsValue,
} from './model.js';

export const TOPICS = [
  { key: 'hull', icon: '🕳️', title: 'Hull', desc: 'Hva er jeg ikke dekket for?' },
  { key: 'dobbel', icon: '🔁', title: 'Dobbeltdekning', desc: 'Betaler jeg to ganger?' },
  { key: 'egenandel', icon: '💰', title: 'Egenandel', desc: 'Lønner det seg å heve den?' },
  { key: 'unntak', icon: '🚫', title: 'Unntak', desc: 'Viktige begrensninger' },
];

export const EXAMPLES = [
  { label: 'Bilulykke – hva dekkes?', text: 'Jeg var i en bilulykke i går. Hva er jeg dekket for?' },
  { label: 'Mistet mobilen på ferie', text: 'Jeg mistet mobilen på ferie i Spania. Hvilken forsikring dekker dette, og hva blir egenandelen?' },
  { label: 'Vannlekkasje på badet', text: 'Vi har fått vannlekkasje på badet. Hva dekker hus- og innboforsikringen?' },
];

// Felt som aldri tas med: kortnummer, nødnummer (uinteressant for spørsmålet).
const SKIP_FIELDS = new Set(['cardLast4', 'emergencyPhone']);

// Fjern lange tallrekker som kan være kortnummer (13–19 siffer) eller personnummer (11 siffer).
export function scrub(text) {
  return String(text).replace(/\d(?:[\s.-]?\d){10,}/g, '[fjernet]');
}

function fieldText(def, value) {
  if (def.kind === 'list') {
    if (!value?.length) return '';
    const list = value.map((v) => (v.value ? `${v.name} (${formatKr(v.value)})` : v.name)).join(', ');
    return `${def.label.toLowerCase()}: ${list}`;
  }
  const v = formatField(def, value);
  if (!v) return '';
  return `${def.label.toLowerCase()} ${v}`;
}

export function policyLine(p) {
  const type = TYPES.find((t) => t.key === p.type);
  const parts = [];
  if (premiumOf(p)) parts.push(`${formatKr(p.annualPremium)}/år`);
  else if (p.premiumNote) parts.push(p.premiumNote.charAt(0).toLowerCase() + p.premiumNote.slice(1));
  if (p.renewalDate) parts.push(`fornyes ${formatDate(p.renewalDate)}`);
  if (p.coverage) parts.push(`dekning ${p.coverage}`);
  if (p.deductible) parts.push(`egenandel ${formatKr(p.deductible)}`);
  for (const def of FIELD_DEFS[p.type] || []) {
    if (SKIP_FIELDS.has(def.key)) continue;
    const t = fieldText(def, p.fields?.[def.key]);
    if (t) parts.push(t);
  }
  let note = '';
  if (p.type === 'reise' && ['area', 'maxDays', 'activation'].some((k) => !p.fields?.[k])) {
    note = ' (vilkårene for kortet er ikke fylt ut ennå)';
  }
  const who = p.company || 'selskap ikke oppgitt';
  return scrub(`• ${type.label} – ${who}: ${parts.join(', ') || 'ingen detaljer registrert'}${note}`);
}

// Ekstra merknader for temaet «Dobbeltdekning».
function doubleCoverNotes(policies) {
  const notes = [];
  const travel = policiesOfType(policies, 'reise');
  const cards = travel.map((p) => p.company).filter(Boolean);
  if (cards.length >= 2) {
    notes.push(`Merk: Vi har reiseforsikring via ${cards.length === 2 ? 'to' : cards.length} kredittkort (${cards.slice(0, -1).join(', ')} og ${cards.at(-1)}). Overlapper disse, og trenger vi begge?`);
  } else {
    notes.push(`Merk: Vi har reiseforsikring via kredittkort${cards.length ? ` (${cards[0]})` : ''}.`);
  }
  const innbo = policiesOfType(policies, 'innbo').length > 0;
  if (innbo && travel.some((p) => p.fields?.baggage)) {
    notes.push('Både innboforsikringen og reiseforsikringen dekker bagasje. Hvilken bør vi bruke, og betaler vi dobbelt?');
  }
  return notes;
}

export function buildPrompt({ policies, inventory, topicKey, question }) {
  const topic = TOPICS.find((t) => t.key === topicKey);
  const lines = ['Du er en norsk forsikringsrådgiver. Her er våre forsikringer (gift par, pensjonister, Oslo):'];

  for (const t of TYPES) {
    for (const p of policiesOfType(policies, t.key)) lines.push(policyLine(p));
  }

  const items = inventory?.items || [];
  if (items.length) {
    lines.push(`Innboregister: ${items.length} gjenstander registrert, til sammen ${formatKr(itemsValue(items))}.`);
  }

  if (topic) {
    lines.push('', `Tema: ${topic.title} – ${topic.desc}`);
    if (topic.key === 'dobbel') lines.push(...doubleCoverNotes(policies));
  }

  const q = scrub((question || '').trim()) || (topic ? topic.desc : '');
  lines.push('', `Spørsmål: ${q}`);
  lines.push('', 'Svar kort og konkret på norsk. Si hva som sannsynligvis dekkes, hva som ikke dekkes, hvilken egenandel som gjelder, og hva jeg bør sjekke i vilkårene eller spørre selskapet om.');
  return lines.join('\n');
}
