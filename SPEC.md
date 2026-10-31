# Min Forsikring – spesifikasjon for Claude Code

> **Slik bruker du denne filen:** Legg `SPEC.md` og `skisse.html` i en tom prosjektmappe, åpne Claude Code i mappen og skriv:
> *«Les SPEC.md og skisse.html. Bygg appen steg for steg som beskrevet i seksjon 13. Start med steg 1, og stopp etter hvert steg slik at jeg kan teste.»*

---

## 1. Mål

En enkel, oversiktlig mobil-webapp (PWA) for et gift pensjonistpar i Oslo som skal holde orden på fire forsikringstyper: **Bil, Hus, Innbo og Reise**. Appen skal:

- vise alle forsikringer, premier, forfall og nøkkelvilkår på én skjerm
- lagre poliser (PDF) og lenke til selskapenes «Min side»
- minne om fornyelse, årlig tilbudsinnhenting og oppdatering av innboregisteret
- hjelpe brukeren å stille gode spørsmål om dekning til en KI (Claude)
- kunne legges på hjemskjermen på iPhone (iOS Safari) og også fungere i nettleser på PC

Målgruppen er ikke teknisk. **Store trykkflater, tydelig tekst, få valg per skjerm, norsk språk overalt.**

## 2. Teknologi og rammer

- **Ren HTML, CSS og JavaScript** (ES-moduler). Ingen rammeverk og ingen byggesteg. Det skal fungere ved å åpne mappen via en enkel lokal server.
- **PWA:**
  - `manifest.webmanifest` med `name: "Min Forsikring"`, `short_name: "Forsikring"`, `display: "standalone"`, `lang: "nb"`, `theme_color: "#ffd57a"`, `background_color: "#8fb3c4"`, og ikoner i 192, 512 og maskable 512.
  - `service-worker.js` som cacher alle app-filer, slik at appen virker uten nett (cache-first for app-filer, versjonert cache-navn).
  - iOS-spesifikt i `<head>`: `apple-touch-icon` (180×180), `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` = `default`, `apple-mobile-web-app-title`, og `viewport-fit=cover` med `env(safe-area-inset-*)` for hakk og hjemlinje.
- **Lagring lokalt på enheten:**
  - Strukturerte data (poliser, innstillinger, påminnelser, innbo-metadata) lagres i **IndexedDB** via en liten egen wrapper (`db.js`). Ikke bruk localStorage til hoveddata.
  - Filer (PDF-er, bilder, kvitteringer) lagres som `Blob` i en egen IndexedDB-store.
  - Kall `navigator.storage.persist()` ved oppstart for å redusere risikoen for at iOS sletter data.
- **Ingen server, ingen innlogging, ingen sporing.** Eneste eksterne lenker er selskapenes nettsider, bytt.no og claude.ai.
- **Fonten Nunito** (500/700/800) **lagres lokalt** i `/fonts`, slik at appen virker offline. Bruk ikke Google Fonts-CDN i den ferdige appen.
- **Hosting:** GitHub Pages (https kreves for PWA). Lag en kort `README.md` på norsk med publiseringssteg og hvordan man legger appen på hjemskjermen (Safari → Del → «Legg til på Hjem-skjerm»).

### Foreslått filstruktur
```
index.html
manifest.webmanifest
service-worker.js
css/app.css
js/app.js          // oppstart, ruting mellom visninger
js/db.js           // IndexedDB-wrapper
js/model.js        // datamodell, beregninger (sum, dager til forfall)
js/views/home.js
js/views/reminders.js
js/views/assistant.js
js/views/edit.js
js/views/inventory.js
js/views/settings.js
js/ics.js          // kalenderfil-eksport
js/backup.js       // eksport/import
icons/ ...
fonts/ ...
README.md
```

## 3. Design (fasit: `skisse.html`)

`skisse.html` er godkjent av brukeren og er **fasit for utseende, farger, størrelser og oppførsel**. Gjenbruk designverdiene derfra. Eksempeldataene i skissen er bare illustrasjoner.

- **Fargetokens:**
  - `--sky #8fb3c4`
  - `--sun #ffd57a`
  - `--cream #f6f1e4`
  - `--ink #163f35`
  - `--muted #6b7b76`
  - `--green #3fae5a`
  - `--orange #f0962e`
  - `--red #d9534f`
  - ikonfarger: bil `#ffd57a`, hus `#e9806b`, innbo `#f3a1b5`, reise `#6fcfa8`
- **Bakgrunn:** vertikal gradient `var(--sky)` → `#b9cfd6` → `var(--cream)`. Dette er den opprinnelige dusblå fargen, og brukeren har bedt om å beholde den.
- **Toppfelt på forsiden:** gul (`--sun`) med avrundede nedre hjørner (32px). Feltet viser **bare** «MIN FORSIKRING» og «Total årspremie» med stort tall. Det skal **ikke** stå noen linje om neste forfall i toppfeltet.
- **Forsikringsboksene:** full bredde (16px marg mot skjermkant), hvite, radius 20px, myk skygge. Mørkegrønt ikonfelt på 56×56 px med farget ikon. Tittel med store bokstaver (12px, 800), premie under (16px, 700, `--muted`). Til høyre en rund pil som roterer når boksen åpnes. Under står «Forfall» og dato, og en fremdriftslinje. Størrelse og bredde skal være **som i skissen**. Brukeren har testet både mindre og smalere bokser og avvist dem.
- **Selskapsnavn vises ikke** i lukket boks. Det vises som en linje i detaljene når boksen åpnes.
- **Bunnmeny:** fast nederst, hvit, to like store knapper. **🔔 Påminnelser** (bakgrunn `#ffd1c2`, tekst `#7a2e17`, rødt tellemerke) og **✨ KI-assistent** (bakgrunn `#bff0c9`, tekst `#11552a`). Aktiv side markeres med en kantlinje.
- **Undersider** (Påminnelser og KI) har toppfelt i samme farge som knappen sin, «← Oversikt» øverst, stor tittel og en undertittel.
- **Trykkflater** skal være minst 44×44 px. Brødtekst skal være minst 14px. Brukeren skal kunne trykke på hele boksen for å åpne og lukke den.
- **Animasjon:** myk utvidelse (cirka 0,3 s). Respekter `prefers-reduced-motion`.
- Visningen skal se ordentlig ut på PC også: innholdet sentreres med `max-width: 520px`.

## 4. Navigasjon

| Visning | Hvordan man kommer dit |
|---|---|
| **Oversikt** (forside) | Start, «← Oversikt», eller trykk på aktiv bunnknapp en gang til |
| **Påminnelser** | Bunnknapp |
| **KI-assistent** | Bunnknapp |
| **Rediger forsikring** | «✏️ Rediger» i en åpen boks (fullskjerm-ark som glir opp nedenfra) |
| **Innboregister** | Fra påminnelsesboksen «Innboregister» → «Åpne innboregister» |
| **Innstillinger** | Lite ⚙️-ikon øverst til høyre i det gule toppfeltet |

Bruk hash-ruting (`#/`, `#/paminnelser`, `#/ki`, `#/rediger/:id`, `#/innbo`, `#/innstillinger`), slik at tilbakeknappen i nettleseren virker.

## 5. Datamodell

En **forsikringstype** (bil, hus, innbo, reise) kan inneholde **én eller flere poliser**. Paret har én bil, men reiseforsikringen kommer fra **to kredittkort: Bank Norwegian og Nordea**.

```js
Policy {
  id: string,                    // uuid
  type: "bil" | "hus" | "innbo" | "reise",
  name: string,                  // f.eks. "Bilforsikring", "Reise – Bank Norwegian-kort"
  company: string,               // f.eks. "If", "Bank Norwegian", "Nordea"
  myPageUrl: string,             // lenke til selskapets innlogging / Min side
  policyNumber: string,
  annualPremium: number | null,  // kr; 0 eller null for kortforsikring (inkludert i kortet)
  premiumNote: string,           // f.eks. "Inkludert i kredittkortet"
  renewalDate: "YYYY-MM-DD",
  deductible: number | null,     // egenandel, kr
  coverage: string,              // f.eks. "Fullkasko", "Fullverdi", "Familie, helårs"
  fields: { ... },               // typespesifikke felt, se under
  notes: string,
  documents: DocumentRef[],
  updatedAt: ISO-tid
}

DocumentRef { id, policyId, title, kind: "polise"|"vilkår"|"forsikringsbevis"|"annet", fileName, size, addedAt, blobKey }
```

**Typespesifikke felt** (alle valgfrie og redigerbare):

- **Bil:** registreringsnummer, bilmerke/modell, bonus (%), kjørelengde (km/år), yngste fører under 23 (ja/nei), leiebil, veihjelp.
- **Hus:** adresse, byggeår, areal (m²), forsikringsform (fullverdi/førsterisiko), tilleggsbygg, sopp/råte, skadedyr.
- **Innbo:** forsikringssum (kr), enkeltgjenstander over grensen (liste), sykkel, smykker.
- **Reise:**
  - dekningsområde (Norden, Europa, Verden)
  - maks varighet per reise (dager)
  - hvem som er dekket (meg / ektefelle / barn)
  - aldersbegrensning
  - **aktiveringsvilkår**, for eksempel «reisen må være betalt med kortet»
  - avbestilling (ja/nei, beløp)
  - bagasje (beløp)
  - medisinsk nødnummer (vises stort og kan ringes med `tel:`-lenke)
  - kortets siste 4 siffer (valgfritt; aldri hele kortnummeret)

## 6. Forsiden (Oversikt)

- **Total årspremie** er summen av `annualPremium` for alle poliser. Poliser uten premie (kortforsikringer) teller som 0.
- **Fire bokser i fast rekkefølge: Bil, Hus, Innbo, Reise.** Alle er **lukket som standard** hver gang appen åpnes.
- **Lukket boks viser:** ikon, typenavn, samlet årspremie for typen («6 950 kr / år»), og «Forfall» med den tidligste fornyelsesdatoen. For Reise, der begge polisene er kortforsikringer, vises «Inkludert i kredittkort» i stedet for 0 kr.
- **Fremdriftslinje:** andel av forsikringsåret som har gått (12 måneder bakover fra fornyelsesdato). Linjen er **grønn** normalt, **oransje** når det er færre dager igjen enn brukerens varseltid, og **rød** når forfallsdatoen er passert.
- **Åpen boks viser** en detaljtabell: selskap, dekning, egenandel, bonus og de viktigste typespesifikke feltene. Hvis typen har flere poliser, får hver polise sin egen underseksjon med overskrift (f.eks. «Bank Norwegian» og «Nordea»). Under tabellen kommer knapper:
  - **📄 Dokumenter (n)**: liste over lagrede PDF-er, der et trykk åpner filen
  - **🔗 Min side**: åpner `myPageUrl` i ny fane
  - **✏️ Rediger**
  - **＋ Legg til polise** (bare synlig i Reise-boksen, men tillatt i datamodellen for alle typer)
- **Tom tilstand:** en boks uten data viser «Ikke registrert – trykk for å legge inn».

## 7. Rediger og dokumenter

- **Redigeringsark:** ett felt per linje, med norske etiketter og riktig tastatur (`inputmode="numeric"` for beløp, `type="date"` for datoer, `type="url"`, `type="tel"`). Beløp vises formatert med `nb-NO` (mellomrom som tusenskille, «kr»). Knappene er **Lagre**, **Avbryt** og **Slett polise** (krever bekreftelse i appens egen dialog; ikke bruk `alert()`/`confirm()`).
- **Velg selskap** fra en nedtrekksliste med norske forsikringsselskaper og kortutstedere: If, Gjensidige, Tryg, Fremtind (SpareBank 1/DNB), Storebrand, Frende, Codan, Eika, KLP, Bank Norwegian, Nordea og «Annet». Hvert valg forhåndsutfyller `myPageUrl` med selskapets forside. Brukeren kan endre lenken.
- **Legg til dokument:** `<input type="file" accept="application/pdf,image/*">`. Brukeren gir dokumentet en tittel og velger type. På iPhone åpner dette Filer, iCloud eller kamera.
- **Henting fra selskapets nettside:** selskapene tilbyr ikke åpen tilgang, så appen skal **ikke** forsøke automatisk innlogging eller skraping. Flyten er: trykk «🔗 Min side» → logg inn hos selskapet → last ned polisen → tilbake i appen → «Legg til dokument». Vis en kort hjelpetekst med denne flyten første gang.
- **Visning av PDF:** åpne via `URL.createObjectURL(blob)` i ny fane. iOS viser PDF-en i sin egen visning.

## 8. Påminnelser

Siden har tre bokser i samme stil som forsiden, og alle er lukket som standard. Et tellemerke på bunnknappen viser antall påminnelser som krever handling.

1. **Fornyelser**
   - Lukket boks: den nærmeste fornyelsen, f.eks. «Bil fornyes om 63 dager».
   - Åpen boks: alle poliser med dato og «x dager» i en pille (grønn eller oransje).
   - Valg av **varseltid**: 14, 30, 60 eller 90 dager. Standard er **30**.
   - **📅 Legg i kalender**: lager en `.ics`-fil med en hendelse på fornyelsesdatoen og alarm på varseltiden. Filen kan åpnes i Kalender på iPhone og i Outlook/Google på PC. Det er den pålitelige måten å få varsel når appen er lukket.
2. **Årlig tilbud**
   - Anbefaler å hente tilbud cirka **6 uker før** hver fornyelse.
   - Avkrysningsliste per forsikringstype for inneværende år, som nullstilles automatisk når nytt forsikringsår starter.
   - Knapp **🔗 Åpne bytt.no** (https://www.bytt.no).
   - Teller som påminnelse når det er under 6 uker til en fornyelse og typen ikke er avkrysset.
3. **Innboregister**
   - Lukket boks: «Sist oppdatert for x mnd siden». Teller som påminnelse hvis det er mer enn **12 måneder** siden.
   - Åpen boks: rom med antall gjenstander og sum, og en måler som viser **registrert verdi mot forsikringssum** (hentet fra innbopolisen).
   - Knappene **＋ Legg til gjenstand** og **Åpne innboregister**.
   - Tekst: «Lagres kun på denne enheten.»

**Innboregister (egen visning):**
- Rom: standardrommene er Stue, Kjøkken, Soverom, Bad, Kontor og Bod/garasje. Brukeren kan legge til, gi nytt navn og slette rom.
- Gjenstand: navn, rom, verdi (kr), kjøpsår, merknad, **bilde** (kamera eller bibliotek) og **kvittering** (bilde eller PDF).
- Bilder komprimeres i nettleseren til maks 1600 px (JPEG, kvalitet ~0,8) før lagring.

**Merk:** iOS-PWA-er kan ikke vise ekte push-varsler uten en server. Appen skal derfor bruke tellemerket i appen og `.ics`-kalenderfiler, ikke push-varsler.

## 9. KI-assistent (versjon 1: spørsmålsbygger)

Versjon 1 gjør **ingen KI-kall fra appen**. Den bygger en ferdig tekst som brukeren kopierer inn i Claude.

- **Fire temaknapper** i 2×2-rutenett, der valgt knapp markeres:
  - **🕳️ Hull**: «Hva er jeg ikke dekket for?»
  - **🔁 Dobbeltdekning**: «Betaler jeg to ganger?»
  - **💰 Egenandel**: «Lønner det seg å heve den?»
  - **🚫 Unntak**: «Viktige begrensninger»
- **Fritekstfelt** for eget spørsmål, med eksempelknapper: «Bilulykke – hva dekkes?», «Mistet mobilen på ferie», «Vannlekkasje på badet».
- Knappen **✨ Lag spørsmål til Claude** lager teksten etter malen under og viser den i et kremfarget felt, med knappene **📋 Kopier** (`navigator.clipboard`) og **↗ Åpne Claude** (https://claude.ai i ny fane).
- **Mal:**
  ```
  Du er en norsk forsikringsrådgiver. Her er våre forsikringer (gift par, pensjonister, Oslo):
  • <type> – <selskap>: <premie>/år, fornyes <dato>, dekning <…>, egenandel <…>, <typespesifikke felt>
  … (alle poliser)
  [Hvis tema er valgt:] Tema: <tema> – <temabeskrivelse>
  Spørsmål: <fritekst>
  Svar kort og konkret på norsk. Si hva som sannsynligvis dekkes, hva som ikke dekkes, hvilken egenandel som gjelder, og hva jeg bør sjekke i vilkårene eller spørre selskapet om.
  ```
- **Dobbeltdekning-temaet skal alltid nevne at paret har reiseforsikring via to kredittkort** (Bank Norwegian og Nordea). Hvis innbo og reise begge dekker bagasje, skal det også nevnes.
- **Ta aldri med** fullstendige kortnummer eller personnummer i teksten.
- Legg inn en tydelig «sløyfe» i koden (`assistantProvider`), slik at en **versjon 2** med egen Claude API-nøkkel kan legges til senere uten å skrive om visningen. Ikke bygg versjon 2 nå.

## 10. Innstillinger og deling mellom ektefellene

Dataene lagres lokalt på hver enhet. Deling skjer med **eksport og import**:

- **📤 Del med ektefelle / ta sikkerhetskopi:** lager én fil, `min-forsikring-YYYY-MM-DD.json`, med alle poliser og innstillinger. Brukeren velger selv om dokumenter og innbobilder skal være med (de legges inn som base64). Filen deles via `navigator.share({ files })` (Meldinger, Mail, AirDrop). Der det ikke støttes, lastes filen ned i stedet.
- **📥 Importer:** les filen, og vis hva som er nytt eller endret. Brukeren velger **«Slå sammen»** (nyeste `updatedAt` vinner per polise) eller **«Erstatt alt»**.
- Viser datoen for siste eksport, og en mild påminnelse hvis det er over 3 måneder siden.
- **Varseltid** (14/30/60/90 dager) kan også endres her.
- **🧹 Tøm eksempeldata** og **🗑️ Slett alle data** (med dobbel bekreftelse).
- Appversjon og en kort hjelpetekst om hjemskjerm.

Datamodellen skal ha `updatedAt` på alt, slik at **ekte synkronisering** (for eksempel Firebase) kan legges til senere. Ikke bygg synkronisering nå.

## 11. Startdata ved første oppstart

Ved første oppstart legges det inn eksempeldata, merket med et lite «Eksempel»-merke, som brukeren erstatter med sine egne:

- **Bil:** én polise, selskap tomt, eksempelverdier som i skissen.
- **Hus:** én polise, eksempelverdier.
- **Innbo:** én polise, forsikringssum 1 500 000 kr (eksempel).
- **Reise:** **to** poliser:
  - «Reise – Bank Norwegian-kort», selskap *Bank Norwegian*, premie *Inkludert i kredittkortet*
  - «Reise – Nordea-kort», selskap *Nordea*, premie *Inkludert i kredittkortet*

  Begge har aktiveringsvilkår, maks varighet, dekningsområde og nødnummer som **tomme felt** som brukeren fyller ut fra kortvilkårene. Ikke finn på verdier for disse.

## 12. Kvalitet og tilgjengelighet

- Semantisk HTML: knapper skal være `<button>`, og bokser som åpnes og lukkes skal ha `aria-expanded`. Brukeren skal kunne bruke tastatur på PC.
- Kontrast skal oppfylle WCAG AA. Tekststørrelsen skal følge iOS-innstillingen der det er mulig (bruk `rem`).
- Appen skal virke offline etter første besøk.
- Ingen feil i konsollen. Feil vises i appen på norsk, for eksempel «Kunne ikke lagre dokumentet – er lagringen full?».
- Test i iPhone-størrelse (390×844) og på PC (1280 bred).

## 13. Byggerekkefølge – stopp etter hvert steg

Etter hvert steg: oppsummer hva som er gjort, fortell hvordan det testes (start lokal server, adresse), og **vent på tilbakemelding før neste steg**.

1. **Skjelett og forside:** filstruktur, design fra `skisse.html`, de fire boksene med eksempeldata fra minnet (ingen lagring ennå), bunnmeny og ruting.
2. **Lagring og redigering:** IndexedDB, datamodell, redigeringsark, flere poliser per type (Reise med to kort), og total årspremie beregnet fra data.
3. **Dokumenter:** opplasting, liste og visning av PDF/bilder per polise, «Min side»-lenker og selskapsliste.
4. **Påminnelser:** fornyelser med varseltid og tellemerke, `.ics`-eksport, og årlig tilbud med avkrysning og bytt.no.
5. **Innboregister:** rom, gjenstander, bilder og kvitteringer, og sum mot forsikringssum.
6. **KI-assistent v1:** temaer, eksempler, spørsmålsbygger, kopier og åpne Claude.
7. **Innstillinger og deling:** eksport/import, tøm eksempeldata, slett alt.
8. **PWA og publisering:** manifest, ikoner (lag et enkelt skjold- eller paraplyikon i appens farger), service worker, lokal font, test av «Legg til på Hjem-skjerm», publisering til GitHub Pages og README på norsk.

## 14. Ferdig når …

- Appen kan legges på hjemskjermen på iPhone, åpnes uten Safari-ramme og virker uten nett.
- Alle fire bokser er lukket ved oppstart. Et trykk åpner og lukker boksen. Lukket boks viser type, premie og forfall.
- Total årspremie stemmer med summen av polisene.
- Reise-boksen viser begge kredittkortforsikringene hver for seg.
- En PDF kan legges inn på iPhone, og den finnes fortsatt etter at appen er lukket og åpnet igjen.
- Påminnelser teller riktig, og kalenderfilen åpner seg i iPhone-kalenderen med alarm.
- KI-teksten inneholder alle poliser og spørsmålet, og kan kopieres.
- En eksportfil fra én telefon kan importeres på den andre, og gir de samme dataene.
