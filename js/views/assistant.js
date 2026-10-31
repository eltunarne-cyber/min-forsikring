// KI-assistent v1: spørsmålsbygger. Lager en tekst brukeren kopierer inn i Claude.

import { esc, subHeader } from '../ui.js';
import { TOPICS, EXAMPLES, buildPrompt } from '../prompt.js';
import { assistantProvider } from '../assistant-provider.js';

const CLAUDE_URL = 'https://claude.ai';

export function render(root, ctx) {
  const { state } = ctx;
  // Valg og tekst huskes mens appen er åpen.
  state.assistant ??= { topic: '', question: '', result: null };
  const a = state.assistant;

  root.innerHTML = `
  ${subHeader({ title: 'KI-assistent', sub: 'Spør om dekning, hull og egenandeler', cls: 'ai' })}
  <main class="content">
    <div class="panel">
      <h3>Hva lurer du på?</h3>
      <p class="small">Velg et tema, eller skriv et eget spørsmål.</p>
      <div class="grid" role="group" aria-label="Tema">
        ${TOPICS.map((t) => `
        <button class="topic ${a.topic === t.key ? 'on' : ''}" data-topic="${t.key}" aria-pressed="${a.topic === t.key}">
          <span aria-hidden="true">${t.icon}</span> ${esc(t.title)}<small>${esc(t.desc)}</small>
        </button>`).join('')}
      </div>

      <label class="visually-hidden" for="ai-q">Ditt spørsmål</label>
      <textarea id="ai-q" class="ai-q" rows="4" placeholder="F.eks. Jeg var i en bilulykke i går. Hva er jeg dekket for?">${esc(a.question)}</textarea>
      <p class="lbl" id="ex-lbl">Eksempler</p>
      <div class="ex-chips" role="group" aria-labelledby="ex-lbl">
        ${EXAMPLES.map((e, i) => `<button class="chip" data-example="${i}">${esc(e.label)}</button>`).join('')}
      </div>
      <p class="error" data-error hidden></p>
      <div class="actions" style="padding:12px 0 0">
        <button class="btn dark" data-action="build">✨ Lag spørsmål til Claude</button>
      </div>

      <div data-out ${a.result ? '' : 'hidden'}>
        ${resultHtml(a.result)}
      </div>
    </div>
    <p class="note">Versjon 1: Teksten limes inn i Claude. Senere kan svaret komme direkte her.</p>
  </main>`;

  const main = root.querySelector('main');
  const textarea = main.querySelector('#ai-q');
  const out = main.querySelector('[data-out]');
  const errorEl = main.querySelector('[data-error]');

  textarea.addEventListener('input', () => {
    a.question = textarea.value;
    errorEl.hidden = true;
  });

  main.addEventListener('click', async (e) => {
    const topicBtn = e.target.closest('[data-topic]');
    if (topicBtn) {
      // Trykk på valgt tema igjen fjerner valget.
      a.topic = a.topic === topicBtn.dataset.topic ? '' : topicBtn.dataset.topic;
      for (const b of main.querySelectorAll('[data-topic]')) {
        const on = b.dataset.topic === a.topic;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
      }
      errorEl.hidden = true;
      return;
    }
    const ex = e.target.closest('[data-example]');
    if (ex) {
      textarea.value = a.question = EXAMPLES[Number(ex.dataset.example)].text;
      errorEl.hidden = true;
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'build') {
      if (!a.topic && !textarea.value.trim()) {
        errorEl.textContent = 'Velg et tema eller skriv et spørsmål først.';
        errorEl.hidden = false;
        return;
      }
      const prompt = buildPrompt({
        policies: state.policies,
        inventory: state.inventory,
        topicKey: a.topic,
        question: textarea.value,
      });
      a.result = await assistantProvider.run(prompt);
      out.innerHTML = resultHtml(a.result);
      out.hidden = false;
      out.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    } else if (btn.dataset.action === 'copy') {
      const ok = await copyText(a.result.text);
      ctx.toast(ok ? 'Kopiert! Åpne Claude og lim inn teksten.' : 'Kunne ikke kopiere. Merk teksten og kopier den selv.', { error: !ok });
    }
  });
}

function resultHtml(result) {
  if (!result) return '';
  if (result.kind === 'answer') {
    // Versjon 2: svar direkte fra Claude.
    return `<p class="lbl">Svar fra Claude</p><div class="prompt answer">${esc(result.text)}</div>`;
  }
  return `
    <p class="lbl">Ferdig tekst – med polisedataene deres</p>
    <div class="prompt" tabindex="0" aria-label="Ferdig tekst til Claude">${esc(result.text)}</div>
    <p class="small" style="margin-top:6px">Teksten inneholder ikke polisenummer, kortnummer eller personnummer.</p>
    <div class="actions" style="padding:10px 0 0">
      <button class="btn" data-action="copy">📋 Kopier</button>
      <a class="btn dark" href="${CLAUDE_URL}" target="_blank" rel="noopener">↗ Åpne Claude</a>
    </div>`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Reserve for eldre nettlesere: kopier via et skjult tekstfelt.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}
