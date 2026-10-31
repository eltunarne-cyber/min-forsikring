// Kalenderfil (.ics) med én hendelse per fornyelse og alarm før forfall.
// Kan åpnes i Kalender på iPhone og i Outlook/Google på PC.

import { parseDate, typeInfo, QUOTE_DAYS } from './model.js';

const ALARM_HOUR = 9; // alarmen kommer kl. 09.00

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// Tekst i ICS må escapes, og linjer brettes ved 75 byte.
const escText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let cur = '';
  let curBytes = 0;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (curBytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

// Alarm `days` dager før en heldagshendelse, kl. ALARM_HOUR.
// Heldagshendelsen starter kl. 00.00, så kl. 09 «days» dager før er (days−1) dager og (24−9) timer før.
function trigger(days) {
  return `-P${days - 1}DT${24 - ALARM_HOUR}H`;
}

function alarm(days, text) {
  return ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escText(text)}`, `TRIGGER:${trigger(days)}`, 'END:VALARM'];
}

export function buildIcs(policies, warnDays) {
  const now = new Date();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Min Forsikring//NO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Forsikring – fornyelser',
  ];
  for (const p of policies) {
    const date = parseDate(p.renewalDate);
    if (!date) continue;
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    const title = p.company ? `${p.name} (${p.company})` : p.name || typeInfo(p.type)?.title;
    const desc = [
      `${title} fornyes i dag.`,
      p.policyNumber ? `Polisenr.: ${p.policyNumber}` : '',
      'Husk å sammenligne pris, f.eks. på bytt.no, ca. 6 uker før.',
      'Laget med appen Min Forsikring.',
    ].filter(Boolean).join('\n');
    lines.push(
      'BEGIN:VEVENT',
      // Samme UID for samme polise og dato, slik at en ny import oppdaterer i stedet for å lage duplikat.
      `UID:${p.id}-${p.renewalDate}@min-forsikring`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${ymd(date)}`,
      `DTEND;VALUE=DATE:${ymd(end)}`,
      `SUMMARY:${escText(`Fornyelse: ${title}`)}`,
      `DESCRIPTION:${escText(desc)}`,
      'TRANSP:TRANSPARENT',
      ...alarm(warnDays, `${title} fornyes om ${warnDays} dager`),
      ...(warnDays < QUOTE_DAYS ? alarm(QUOTE_DAYS, `Hent tilbud: ${title} fornyes om 6 uker`) : []),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

// Last ned kalenderfilen. iPhone (Safari) spør da om hendelsene skal legges i Kalender.
// Fra hjemskjerm-appen på iPhone brukes Del-menyen i stedet, siden nedlasting der er upålitelig.
export async function downloadIcs(text, fileName = 'forsikring-fornyelser.ics') {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  if (window.navigator.standalone === true) {
    const file = new File([blob], fileName, { type: 'text/calendar' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Fornyelser' });
        return 'shared';
      } catch (err) {
        if (err.name === 'AbortError') return 'cancelled';
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
  return 'downloaded';
}
