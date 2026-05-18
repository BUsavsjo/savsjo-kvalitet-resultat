# Kvalitet och resultat i grundskolan - Sävsjö

React/Vite-prototyp för uppföljning på huvudmannanivå och per grundskola.

## Kör lokalt

```bash
npm install
npm run dev
```

Öppna sedan den lokala adressen som Vite visar, oftast `http://localhost:5173`.

## Bygg för publicering

```bash
npm run build
npm run preview
```

## Datakällor

- Kolada v3 API används för de KPI:er som har fasta KPI-id:n.
- Lokala kompletteringar läggs i `LOCAL_SUPPLEMENT` i `src/main.jsx`.
- Fördefinierade skolenheter ligger i `PREDEFINED_SKOLENHETER`.
- Elevfrånvaro hämtas från genererad JSON i `src/data/franvaro_elever.json`.

## Uppdatera elevfrånvaro

Rådata för elevfrånvaro ligger i `data/` och versioneras inte med Git.

1. Lägg nya Excel-filer i `data/` med namn enligt mönstret:

   ```text
   lasar 2025-2026.xls
   ```

2. Låt gamla läsårsfiler ligga kvar. Skriptet läser alla `lasar *.xls`-filer och bygger tidsserien från dem.

3. Kontrollera att filerna har samma tabellstruktur som tidigare rapporter. Första kolumnen i tabellen ska heta `Skola`.

4. Kör från projektroten:

   ```powershell
   py data\franvaro_extract.py
   ```

5. Skriptet undantar `Aleholm Sävsjö` och skriver uppdaterad JSON till:

   ```text
   src/data/franvaro_elever.json
   ```

6. Bygg eller starta appen efteråt:

   ```bash
   npm run build
   npm run dev
   ```

## Kända saker att kontrollera innan skarp användning

- Verifiera att Kolada v3-endpoints och svarsfält matchar produktion.
- Lägg in riktiga lokala värden för driftresultat, personalfrånvaro och trivsel.
- Bestäm om SALSA ska vara egna diagram eller separat analysruta.
- Lägg sekretesslogik för värden som bygger på färre än fem elever/personer.
