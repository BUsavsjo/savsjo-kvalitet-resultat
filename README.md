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

## Kända saker att kontrollera innan skarp användning

- Verifiera att Kolada v3-endpoints och svarsfält matchar produktion.
- Lägg in riktiga lokala värden för driftresultat, personalfrånvaro, elevfrånvaro och trivsel.
- Bestäm om SALSA ska vara egna diagram eller separat analysruta.
- Lägg sekretesslogik för värden som bygger på färre än fem elever/personer.
