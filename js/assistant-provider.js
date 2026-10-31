// KI-leverandør for KI-assistenten («sløyfen»).
//
// Visningen kaller alltid `assistantProvider.run(prompt)` og viser resultatet:
//   { kind: 'prompt', text }  – v1: ferdig tekst som brukeren kopierer inn i Claude
//   { kind: 'answer', text }  – v2: svar fra Claude som vises direkte i appen
//
// Versjon 2 (ikke bygget): legg til en leverandør her som sender teksten til
// Claude API med brukerens egen API-nøkkel (lagret lokalt i innstillingene),
// og returnerer { kind: 'answer', text }. Velg den i `assistantProvider`.
// Visningen trenger ikke skrives om.

const clipboardProvider = {
  id: 'clipboard',
  label: 'Kopier til Claude',
  async run(prompt) {
    return { kind: 'prompt', text: prompt };
  },
};

export const providers = { clipboard: clipboardProvider };

export const assistantProvider = providers.clipboard;
