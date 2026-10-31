# Min Forsikring

En enkel app for å holde orden på bil-, hus-, innbo- og reiseforsikring. Den kan legges på hjemskjermen på iPhone, og den virker også i nettleser på PC.

- Alle data lagres **bare på enheten** (i nettleserens egen database). Det finnes ingen server, ingen innlogging og ingen sporing.
- Når appen har vært åpnet én gang, virker den også uten nett.

---

## 1. Teste på PC

1. Dobbeltklikk **«Start Min Forsikring»** (`Start Min Forsikring.bat`) i denne mappen.
2. Nettleseren åpner **http://localhost:8080**. La det svarte vinduet stå åpent mens du tester.

Har du Python, kan du også kjøre `py -m http.server 8080` i mappen.

## 2. Publisere på GitHub Pages (gratis)

En app som skal ligge på hjemskjermen, må ha en **https**-adresse. GitHub Pages gir det gratis.

1. Lag en konto på **https://github.com** hvis du ikke har en.
2. Trykk **«+» → «New repository»**.
   - Navn: `min-forsikring`
   - Velg **Public**. Det er bare *programmet* som blir offentlig. Forsikringsdataene ligger aldri på GitHub.
   - Trykk **«Create repository»**.
3. Trykk **«uploading an existing file»**, eller **«Add file» → «Upload files»**.
4. Dra **alt innholdet i denne mappen** inn i nettleservinduet: filene og mappene `css`, `js`, `fonts` og `icons`. Trykk **«Commit changes»**.
   - Ikke last opp eksportfiler (`min-forsikring-ÅÅÅÅ-MM-DD.json`). De inneholder dataene deres.
5. Gå til **«Settings» → «Pages»**.
   - Under «Build and deployment» velger du **Source: Deploy from a branch**.
   - Velg **Branch: `main`** og mappen **`/ (root)`**, og trykk **«Save»**.
6. Etter 1–2 minutter ligger appen på **`https://<brukernavn>.github.io/min-forsikring/`**. Adressen vises øverst på Pages-siden.

## 3. Legge appen på hjemskjermen (iPhone)

Gjør dette på begge telefonene:

1. Åpne adressen i **Safari**. Det må være Safari, ikke Chrome.
2. Trykk **Del-knappen**, firkanten med pil opp, nederst på skjermen.
3. Bla ned og velg **«Legg til på Hjem-skjerm»**, og trykk **«Legg til»**.
4. Åpne appen fra hjemskjermen. Den åpnes uten Safari-ramme.
5. Åpne appen én gang mens telefonen er på nett. Etter det virker den også uten nett.

**PC:** i Chrome eller Edge kan du trykke installer-ikonet i adressefeltet.

## 4. Dele data mellom ektefellene

Dataene ligger på hver telefon. Slik får dere de samme dataene:

1. Telefon A: **⚙️ → «📤 Del med ektefelle / ta sikkerhetskopi»** og send filen med Meldinger, Mail eller AirDrop.
2. Telefon B: lagre filen i Filer. Gå så til **⚙️ → «📥 Importer fil»**, velg filen og trykk **«Slå sammen»**.

Ta gjerne en sikkerhetskopi av og til. Appen minner om det når det har gått over 3 måneder.

> **Viktig:** Hvis appen slettes fra hjemskjermen, slettes også dataene på den telefonen. Ta en sikkerhetskopi først.

## 5. Oppdatere appen senere

1. Endre filene.
2. Øk versjonsnummeret både i `service-worker.js` (`CACHE = 'min-forsikring-v1.0.1'`) og i `js/model.js` (`APP_VERSION`).
3. Last opp de endrede filene til GitHub på samme måte som over.
4. Åpne appen. Den henter den nye versjonen og sier fra. Lukk appen og åpne den igjen.

## Filer

| Fil / mappe | Innhold |
|---|---|
| `index.html` | Selve siden |
| `manifest.webmanifest` | Navn, farger og ikoner for hjemskjermen |
| `service-worker.js` | Lagrer app-filene slik at appen virker uten nett |
| `css/app.css` | Utseende (fra `skisse.html`) |
| `js/` | Programkoden: `app.js` (oppstart og navigasjon), `db.js` (lagring), `model.js` (data og beregninger), `views/` (skjermene) |
| `fonts/` | Fonten Nunito (lisens: SIL Open Font License, se `OFL.txt`) |
| `icons/` | App-ikoner |
| `SPEC.md`, `skisse.html` | Spesifikasjon og godkjent skisse (brukes ikke av appen) |
| `Start Min Forsikring.bat`, `start-server.ps1` | Lokal testserver for Windows (brukes ikke av appen) |
