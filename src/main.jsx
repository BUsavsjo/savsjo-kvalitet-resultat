import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Download, FileText, RefreshCw, School, Building2, Database, AlertTriangle } from "lucide-react";
import "./styles.css";
import staffAbsenceData from "./data/sjukfranvaro_personal.json";
import studentAbsenceData from "./data/franvaro_elever.json";
import nationalTests3Data from "./data/ak3_np.json";
import budgetDeviationData from "./data/budgetavvikelse.json";

function Card({ className = "", children }) {
  return <div className={`card ${className}`}>{children}</div>;
}

function CardContent({ className = "", children }) {
  return <div className={className}>{children}</div>;
}

function Button({ className = "", variant = "default", disabled, onClick, children }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`btn ${variant === "outline" ? "btn-outline" : "btn-primary"} ${className}`}>
      {children}
    </button>
  );
}

const KOLADA_BASE = "https://api.kolada.se/v3";
const DEFAULT_MUNICIPALITY_CODE = "0684";
const MUNICIPALITY_ID = DEFAULT_MUNICIPALITY_CODE;
const MUNICIPALITY_NAME = "Sävsjö kommun";
const RIKET_ID = "0000";
const SIMILAR_MUNICIPALITY_IDS = ["0604", "0617", "0682", "0683", "0685", "0686", "0687"];
const EXTERNAL_COMPARISON_METRICS = new Set([
  "netCost",
  "teacherEligibility",
  "studentsPerTeacher",
  "svenska6",
  "matematik6",
  "knowledge6",
  "engelska6",
  "gymEligibility",
  "meritValue",
  "mathGrade9",
  "salsaEligibility",
  "salsaMerit",
]);
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, index) => CURRENT_YEAR - 4 + index);
const koladaCache = {};

const MUNICIPALITIES = [
  { code: "0680", name: "Jönköping" },
  { code: "0682", name: "Nässjö" },
  { code: "0683", name: "Värnamo" },
  { code: "0684", name: "Sävsjö" },
  { code: "0685", name: "Vetlanda" },
  { code: "0686", name: "Eksjö" },
  { code: "0687", name: "Tranås" },
  { code: "0760", name: "Uppvidinge" },
  { code: "0761", name: "Lessebo" },
  { code: "0763", name: "Tingsryd" },
  { code: "0764", name: "Alvesta" },
  { code: "0765", name: "Älmhult" },
  { code: "0767", name: "Markaryd" },
  { code: "0780", name: "Växjö" },
  { code: "0781", name: "Ljungby" },
];

const STAGES = [
  { id: "F-6", name: "F-6" },
  { id: "7-9", name: "7-9" },
  { id: "F-9", name: "F-9" },
];

const PREREQ_KPIS = [
  { id: "N15807", name: "Antal elever i grundskolan (åk 1-9)", description: "Elever i grundskola belägen i kommunen årskurs 1-9", unit: "antal" },
  { id: "N15033", name: "Elever per lärare i grundskolan", description: "Genomsnittligt antal elever per heltidstjänst lärare", unit: "antal" },
  { id: "N15030", name: "Andel lärare med pedagogisk högskoleexamen", description: "Andel lärare med pedagogisk högskoleutbildning", unit: "procent" },
];

const OUTCOME_F6_KPIS = [
  { id: "N15454", name: "Nationella prov åk 3 matematik", description: "Elever i åk 3 som klarat alla delar av nationella provet i matematik, kommunala skolor", unit: "procent" },
  { id: "N15452", name: "Nationella prov åk 3 svenska och SVA", description: "Elever i åk 3 som klarat alla delar av nationella provet i svenska och svenska som andraspråk, kommunala skolor", unit: "procent" },
  { id: "N15486", name: "Andel elever åk 6 med lägst betyget E i svenska", description: "Elever med lägst betyget E i svenska, årskurs 6", unit: "procent" },
  { id: "N15483", name: "Andel elever åk 6 med lägst betyget E i matematik", description: "Elever med lägst betyget E i matematik, årskurs 6", unit: "procent" },
  { id: "N15480", name: "Andel elever åk 6 med lägst betyget E i engelska", description: "Elever med lägst betyget E i engelska, årskurs 6", unit: "procent" },
];

const OUTCOME_79_KPIS = [
  { id: "N15492", name: "Nationella prov åk 9 engelska", description: "Elever i åk 9 med lägst betyget E i engelska", unit: "procent" },
  { id: "N15495", name: "Nationella prov åk 9 matematik", description: "Elever i åk 9 med lägst betyget E i matematik", unit: "procent" },
  { id: "N15498", name: "Nationella prov åk 9 svenska", description: "Elever i åk 9 med lägst betyget E i svenska", unit: "procent" },
  { id: "N15424", name: "Andel elever åk 9 behöriga till yrkesprogram", description: "Elever som är behöriga till yrkesprogram på gymnasiet", unit: "procent" },
  { id: "N15504", name: "Genomsnittligt meritvärde åk 9", description: "Genomsnittligt meritvärde för elever i årskurs 9", unit: "poäng" },
  { id: "N15503", name: "Genomsnittlig betygspoäng i matematik åk 9", description: "Genomsnittlig betygspoäng i matematik för elever i årskurs 9", unit: "poäng" },
  { id: "U15414", name: "SALSA: Avvikelse från förväntat resultat", description: "Skolans andel som uppnått betygskriterierna jämfört med förväntat värde", unit: "procentenheter" },
  { id: "U15416", name: "SALSA: Avvikelse genomsnittligt meritvärde", description: "Skolans meritvärde jämfört med förväntat värde baserat på elevsammansättning", unit: "poäng" },
];

const OUTCOME_F9_KPIS = [...OUTCOME_F6_KPIS, ...OUTCOME_79_KPIS];

function detectStage(ou) {
  if (!ou || !ou.title) return null;
  const name = ou.title.toLowerCase();
  const grades = `${ou.grades || ""} ${ou.description || ""}`.toLowerCase();
  const haystack = `${name} ${grades}`;
  if (haystack.includes("f-6") || haystack.includes("f - 6") || haystack.includes("förskoleklass-6")) return "F-6";
  if (haystack.includes("7-9") || haystack.includes("7 - 9") || haystack.includes("högstadie")) return "7-9";
  if (haystack.includes("f-9") || haystack.includes("f - 9") || haystack.includes("förskoleklass-9")) return "F-9";
  if (haystack.includes("lågstadie") || haystack.includes("mellanstadie")) return "F-6";
  if (/vallsjö/i.test(name)) return "7-9";
  if (/sävsjö kristna/i.test(name)) return "F-9";
  if (/hofgård/i.test(name)) return "7-9";
  if (/rörvik/i.test(name)) return "F-9";
  if (/hägne|stockaryd|vrigstad/i.test(name)) return "F-6";
  return null;
}

function getOutcomeKPIs(stage) {
  switch (stage) {
    case "F-6": return OUTCOME_F6_KPIS;
    case "7-9": return OUTCOME_79_KPIS;
    case "F-9": return OUTCOME_F9_KPIS;
    default: return [];
  }
}

function getAllKPIIds(stage) {
  const prereqIds = PREREQ_KPIS.map((k) => k.id);
  const outcomeIds = getOutcomeKPIs(stage).map((k) => k.id);
  return [...prereqIds, ...outcomeIds];
}

const PREDEFINED_SKOLENHETER = [
  { id: "V15E068400107", municipality: "0684", title: "Hägneskolan", type: "grundskola", grades: "F-6", stage: "F-6", source: "Fördefinierad Kolada OU" },
  { id: "V15E068400501", municipality: "0684", title: "Rörviks skola", type: "grundskola", grades: "F-9", stage: "F-9", source: "Fördefinierad Kolada OU" },
  { id: "V15E068400701", municipality: "0684", title: "Vallsjöskolan", type: "grundskola", grades: "7-9", stage: "7-9", source: "Fördefinierad Kolada OU" },
  { id: "V15E068401101", municipality: "0684", title: "Vrigstad skola", type: "grundskola", grades: "F-6", stage: "F-6", source: "Fördefinierad Kolada OU" },
  { id: "V15E068401401", municipality: "0684", title: "Sävsjö kristna skola", type: "grundskola", grades: "F-9", stage: "F-9", source: "Fördefinierad Kolada OU" },
  { id: "V15E068401501", municipality: "0684", title: "Hofgårdsskolan", type: "grundskola", grades: "7-9", stage: "7-9", source: "Fördefinierad Kolada OU" },
  { id: "V15E068401601", municipality: "0684", title: "Stockaryds skola", type: "grundskola", grades: "F-6", stage: "F-6", source: "Fördefinierad Kolada OU" },
];

function getPredefinedSkolenheter(kommunId) {
  return PREDEFINED_SKOLENHETER.filter((enhet) => enhet.municipality === kommunId).map((enhet) => ({ ...enhet, type: "school" }));
}

const SCHOOL_FALLBACK = getPredefinedSkolenheter(MUNICIPALITY_ID);

const KPI_CATALOG = [
  { key: "students", order: 1, title: "Antal elever", unit: "antal", chart: "line", kpiIds: ["N15835"], schoolKpiIds: ["N15807", "N11805"], source: "Kolada: N15835, skolenhet N15807 + N11805", localNeeded: false, category: "förutsättningar" },
  { key: "adaptedStudents", order: 2, title: "Elever i anpassad grundskola", unit: "antal", chart: "line", kpiIds: ["N18803"], source: "Kolada: N18803", localNeeded: "partial", category: "förutsättningar" },
  { key: "operatingResult", order: 3, title: "Driftresultat", unit: "tkr", chart: "line", source: "Lokal komplettering, exempelvis ekonomisystem", localNeeded: true, category: "förutsättningar" },
  { key: "budgetDeviation", order: 4, title: "Budgetavvikelse", unit: "tkr", chart: "line", source: "Lokal ekonomiimport: Budgetavvikelse 5 år.xlsx", localNeeded: true, category: "förutsättningar", series: [
    { key: "grundskola", label: "Grundskola", color: "#14b8a6" },
    { key: "fritids", label: "Fritidshem", color: "#f97316" },
    { key: "anpassadGrundskola", label: "Anpassad grundskola", color: "#8b5cf6" },
    { key: "totalt", label: "Totalt", color: "#0f172a" },
  ] },
  { key: "netCost", order: 5, title: "Kostnad grundskola åk 1-9", unit: "kr/elev", chart: "line", kpiIds: ["N15006"], source: "Kolada: N15006, källa SCB", localNeeded: "partial", dataLevel: "municipality", category: "förutsättningar", description: "Bruttokostnad minus interna intäkter plus kostnad för skolskjuts minus försäljning av verksamhet till andra kommuner, dividerat med medelvärde av antal folkbokförda elever i grundskola åk 1-9." },
  { key: "staffAbsence", order: 6, title: "Frånvaro personal", unit: "%", chart: "line", source: "Lokal HR-rapport: sjukfrånvaro BU", localNeeded: true, category: "förutsättningar", period: "calendarYear", compareMunicipality: true, description: "Sjukfrånvaro i procent av ordinarie arbetstid. Totalen bygger på BU-rapportens detaljrader och skolenheter aggregeras från respektive enhetsrader." },
  { key: "teacherEligibility", order: 7, title: "Lärarlegitimation och behörighet", unit: "%", chart: "line", kpiIds: ["N15814"], source: "Kolada: N15814", localNeeded: false, category: "förutsättningar", description: "Lärare, omräknat till heltidstjänster, med lärarlegitimation och behörighet i grundskola åk 1-9, kommunala skolor." },
  { key: "teacherPedagogicalDegree", order: 8, title: "Lärare med pedagogisk högskoleexamen", unit: "%", chart: "line", kpiIds: ["N15030"], source: "Kolada: N15030", localNeeded: false, category: "förutsättningar" },
  { key: "studentsPerTeacher", order: 9, title: "Antal elever per lärare", unit: "antal", chart: "line", kpiIds: ["N15033"], source: "Kolada: N15033", localNeeded: false, category: "förutsättningar" },
  { key: "studentAbsence", order: 10, title: "Frånvaro elever", unit: "%", chart: "line", source: "Lokal frånvarorapport från Edlevo", localNeeded: true, category: "förutsättningar", compareMunicipality: true },
  { key: "parentHigherEducation", order: 11, title: "Föräldrar med eftergymnasial utbildning", unit: "%", chart: "line", kpiIds: ["N15816"], source: "Kolada: N15816", localNeeded: false, category: "förutsättningar", compareMunicipality: true },
  { key: "wellbeing", order: 12, title: "Trivsel elever", unit: "%", chart: "bar", source: "Lokal enkät eller Skolenkäten där jämförbart värde finns", localNeeded: true, category: "förutsättningar" },
  { key: "nationalTests3", order: 9, title: "Resultat nationella prov årskurs 3", unit: "%", chart: "line", source: "Kolada: N15454, N15452. Skolenhet lokal NP-import", localNeeded: "partial", stage: ["F-6", "F-9"], category: "utfall", description: "Andel elever som uppnått kravnivån i samtliga delprov på nationella proven i svenska och SVA samt matematik i årskurs 3.", series: [
    { key: "matematik", label: "Matematik", color: "#14b8a6", kpiIds: ["N15454"] },
    { key: "svenskaSva", label: "Svenska och SVA", color: "#f97316", kpiIds: ["N15452"] },
  ] },
  { key: "nationalTests6", order: 10, title: "Resultat nationellt prov årskurs 6", unit: "%", chart: "line", source: "Lokal komplettering", localNeeded: true, stage: ["F-6", "F-9"], category: "utfall", description: "Andel elever som uppnått kravnivån på de nationella proven i svenska, engelska och matematik i årskurs 6.", series: [
    { key: "svenska", label: "Svenska", color: "#14b8a6" },
    { key: "engelska", label: "Engelska", color: "#e11d48" },
    { key: "matematik", label: "Matematik", color: "#f97316" },
  ] },
  { key: "nationalTests9", order: 11, title: "Resultat nationella prov årskurs 9", unit: "%", chart: "line", source: "Lokal komplettering", localNeeded: true, stage: ["7-9", "F-9"], category: "utfall", description: "Andel elever som uppnått kravnivån på de nationella proven i svenska, engelska och matematik. Naturvetenskapliga och samhällsvetenskapliga ämnen redovisas inte i diagrammet.", series: [
    { key: "engelska", label: "Engelska", color: "#e11d48" },
    { key: "matematik", label: "Matematik", color: "#f97316" },
    { key: "svenska", label: "Svenska", color: "#14b8a6" },
  ] },
  { key: "svenska6", order: 12, title: "Åk 6 minst E i svenska", unit: "%", chart: "line", kpiIds: ["N15486"], source: "Kolada: N15486", localNeeded: false, stage: ["F-6", "F-9"], category: "utfall" },
  { key: "matematik6", order: 13, title: "Åk 6 minst E i matematik", unit: "%", chart: "line", kpiIds: ["N15483"], source: "Kolada: N15483", localNeeded: false, stage: ["F-6", "F-9"], category: "utfall" },
  { key: "knowledge6", order: 14, title: "Åk 6 uppnått betygskriterierna i alla ämnen", unit: "%", chart: "line", kpiIds: ["N15540"], source: "Kolada: N15540", localNeeded: false, stage: ["F-6", "F-9"], category: "utfall", compareMunicipality: true },
  { key: "knowledge9", order: 15, title: "Åk 9 uppnått betygskriterierna i alla ämnen", unit: "%", chart: "line", kpiIds: ["N15419"], source: "Kolada: N15419", localNeeded: false, stage: ["7-9", "F-9"], category: "utfall", compareMunicipality: true },
  { key: "schoolSurvey5", order: 16, title: "Skolenkäten årskurs 5", unit: "index 0-10", chart: "bar", source: "Kolada, redovisas vartannat år", localNeeded: false, stage: ["F-6", "F-9"], category: "utfall", description: "Indexvärden 0-10 inom stimulans, stöd, studiero, trygghet och skolans arbete med att förhindra kränkningar. Ett högt indexvärde indikerar en positiv uppfattning hos eleverna.", series: [
    { key: "stimulans", label: "Stimulans", kpiIds: ["N15602"], color: "#14b8a6", scale: 0.1 },
    { key: "stod", label: "Stöd", kpiIds: ["N15623"], color: "#0ea5e9", scale: 0.1 },
    { key: "studiero", label: "Studiero", kpiIds: ["N15603"], color: "#f97316", scale: 0.1 },
    { key: "trygghet", label: "Trygghet", kpiIds: ["N15613"], color: "#e11d48", scale: 0.1 },
    { key: "krankningar", label: "Förhindra kränkningar", kpiIds: ["N15614"], color: "#8b5cf6", scale: 0.1 },
  ] },
  { key: "schoolSurvey8", order: 16, title: "Skolenkäten årskurs 8", unit: "index 0-10", chart: "bar", source: "Kolada, redovisas vartannat år", localNeeded: false, stage: ["7-9", "F-9"], category: "utfall", description: "Indexvärden 0-10 inom stimulans, stöd, studiero, trygghet och skolans arbete med att förhindra kränkningar. Ett högt indexvärde indikerar en positiv uppfattning hos eleverna.", series: [
    { key: "stimulans", label: "Stimulans", kpiIds: ["N15632"], color: "#14b8a6", scale: 0.1 },
    { key: "stod", label: "Stöd", kpiIds: ["N15653"], color: "#0ea5e9", scale: 0.1 },
    { key: "studiero", label: "Studiero", kpiIds: ["N15633"], color: "#f97316", scale: 0.1 },
    { key: "trygghet", label: "Trygghet", kpiIds: ["N15643"], color: "#e11d48", scale: 0.1 },
    { key: "krankningar", label: "Förhindra kränkningar", kpiIds: ["N15644"], color: "#8b5cf6", scale: 0.1 },
  ] },
  { key: "engelska6", order: 17, title: "Åk 6 minst E i engelska", unit: "%", chart: "line", kpiIds: ["N15480"], source: "Kolada: N15480", localNeeded: false, stage: ["F-6", "F-9"], category: "utfall" },
  { key: "gymEligibility", order: 18, title: "Gymnasiebehörighet", unit: "%", chart: "line", kpiIds: ["N15424"], source: "Kolada: N15424", localNeeded: false, stage: ["7-9", "F-9"], category: "utfall" },
  { key: "meritValue", order: 19, title: "Genomsnittligt meritvärde", unit: "poäng", chart: "line", kpiIds: ["N15504"], source: "Kolada: N15504", localNeeded: false, stage: ["7-9", "F-9"], category: "utfall" },
  { key: "mathGrade9", order: 20, title: "Åk 9 betygspoäng matematik", unit: "poäng", chart: "line", kpiIds: ["N15503"], source: "Kolada: N15503", localNeeded: false, stage: ["7-9", "F-9"], category: "utfall" },
  { key: "salsaEligibility", order: 21, title: "SALSA avvikelse resultat", unit: "procentenheter", chart: "line", kpiIds: ["U15414"], source: "Kolada: U15414", localNeeded: false, stage: ["7-9", "F-9"], category: "utfall" },
  { key: "salsaMerit", order: 22, title: "SALSA avvikelse meritvärde", unit: "poäng", chart: "line", kpiIds: ["U15416"], source: "Kolada: U15416", localNeeded: false, stage: ["7-9", "F-9"], category: "utfall" },
];

const LOCAL_SUPPLEMENT = {
  municipality: { socioEconomicIndex: null, operatingResult: [], adaptedStudents: [], staffAbsence: [], teacherPedagogicalDegree: [], studentAbsence: [], parentHigherEducation: [], wellbeing: [], nationalTests3: [], nationalTests6: [], nationalTests9: [], knowledge6: [], knowledge9: [], schoolSurvey: [] },
  schools: {
    "Hägneskolan": { socioEconomicIndex: null, operatingResult: [], adaptedStudents: [], staffAbsence: [], teacherPedagogicalDegree: [], studentAbsence: [], parentHigherEducation: [], wellbeing: [], nationalTests3: [], nationalTests6: [], nationalTests9: [], knowledge6: [], knowledge9: [], schoolSurvey: [] },
    "Rörviks skola": { socioEconomicIndex: null, operatingResult: [], adaptedStudents: [], staffAbsence: [], teacherPedagogicalDegree: [], studentAbsence: [], parentHigherEducation: [], wellbeing: [], nationalTests3: [], nationalTests6: [], nationalTests9: [], knowledge6: [], knowledge9: [], schoolSurvey: [] },
    "Stockaryds skola": { socioEconomicIndex: null, operatingResult: [], adaptedStudents: [], staffAbsence: [], teacherPedagogicalDegree: [], studentAbsence: [], parentHigherEducation: [], wellbeing: [], nationalTests3: [], nationalTests6: [], nationalTests9: [], knowledge6: [], knowledge9: [], schoolSurvey: [] },
    "Vallsjöskolan": { socioEconomicIndex: null, operatingResult: [], adaptedStudents: [], staffAbsence: [], teacherPedagogicalDegree: [], studentAbsence: [], parentHigherEducation: [], wellbeing: [], nationalTests3: [], nationalTests6: [], nationalTests9: [], knowledge6: [], knowledge9: [], schoolSurvey: [] },
    "Vrigstad skola": { socioEconomicIndex: null, operatingResult: [], adaptedStudents: [], staffAbsence: [], teacherPedagogicalDegree: [], studentAbsence: [], parentHigherEducation: [], wellbeing: [], nationalTests3: [], nationalTests6: [], nationalTests9: [], knowledge6: [], knowledge9: [], schoolSurvey: [] },
    "Sävsjö kristna skola": { socioEconomicIndex: null, operatingResult: [], adaptedStudents: [], staffAbsence: [], teacherPedagogicalDegree: [], studentAbsence: [], parentHigherEducation: [], wellbeing: [], nationalTests3: [], nationalTests6: [], nationalTests9: [], knowledge6: [], knowledge9: [], schoolSurvey: [] },
    "Hofgårdsskolan": { socioEconomicIndex: null, operatingResult: [], adaptedStudents: [], staffAbsence: [], teacherPedagogicalDegree: [], studentAbsence: [], parentHigherEducation: [], wellbeing: [], nationalTests3: [], nationalTests6: [], nationalTests9: [], knowledge6: [], knowledge9: [], schoolSurvey: [] },
  },
};

function seededValue(seed, year, min, max, decimals = 0) {
  const raw = Math.sin((seed.length + 7) * (year + 13)) * 10000;
  const fraction = raw - Math.floor(raw);
  return Number((min + fraction * (max - min)).toFixed(decimals));
}

function mockSeries(entityName, key, unit) {
  return YEARS.map((year) => {
    const lower = unit === "%" ? 55 : unit === "poäng" ? 185 : unit === "index 0-10" ? 4 : key === "operatingResult" ? -2500 : 8;
    const upper = unit === "%" ? 95 : unit === "poäng" ? 245 : unit === "index 0-10" ? 8.8 : key === "operatingResult" ? 1500 : 380;
    const decimals = unit === "%" || unit === "index 0-10" ? 1 : 0;
    return { year, value: seededValue(`${entityName}-${key}`, year, lower, upper, decimals), source: "Exempeldata" };
  });
}

async function fetchJson(url) {
  if (koladaCache[url]) return koladaCache[url];
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json = await res.json();
  koladaCache[url] = json;
  return json;
}

async function fetchKpiMetadata() {
  const url = `${KOLADA_BASE}/kpi?has_ou_data=true&per_page=500`;
  const json = await fetchJson(url);
  return json.results || [];
}

async function fetchOUsByMunicipality(municipalityId) {
  const url = `${KOLADA_BASE}/ou?municipality=${municipalityId}&per_page=500`;
  const json = await fetchJson(url);
  return json.results || [];
}

async function fetchKpiValuesForOUs(kpiId, ouIds, year) {
  const url = `${KOLADA_BASE}/oudata/kpi/${kpiId}/ou/${ouIds.join(",")}/year/${year}?per_page=500`;
  const json = await fetchJson(url);
  const values = json.values || [];
  return values.filter((v) => ouIds.includes(v.ou));
}

async function fetchKpiValuesForMunicipality(kpiId, municipalityId, year) {
  const url = `${KOLADA_BASE}/data/kpi/${kpiId}/municipality/${municipalityId}/year/${year}?per_page=500`;
  const json = await fetchJson(url);
  return json.values || [];
}

function extractKoladaValues(rows) {
  const values = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const year = Number(row.period || row.year);
    const total = row.values?.find((item) => item.gender === "T" && item.value != null);
    const anyValue = row.values?.find((item) => item.value != null);
    const rawValue = row.value ?? total?.value ?? anyValue?.value ?? row.value_n ?? row.value_f;
    const value = typeof rawValue === "string" ? Number(rawValue.replace(",", ".")) : Number(rawValue);
    if (Number.isFinite(year) && Number.isFinite(value)) values.push({ year, value, source: "Kolada" });
  }
  return values.sort((a, b) => a.year - b.year);
}

async function searchKpiIds(searchTerms) {
  if (!searchTerms?.length) return [];
  const metadata = await fetchKpiMetadata();
  const normalizedTerms = searchTerms.map((term) => term.toLowerCase());
  return metadata
    .filter((item) => {
      const title = `${item.title || ""} ${item.description || ""}`.toLowerCase();
      return normalizedTerms.some((term) => title.includes(term) || term.split(" ").every((part) => title.includes(part)));
    })
    .slice(0, 8)
    .map((item) => ({ id: item.id, title: item.title }));
}

async function loadKoladaSeries(metric, entity) {
  if (metric.key === "adaptedStudents" && entity.type !== "municipality" && entity.title !== "Hägneskolan") return [];
  if (entity.type !== "municipality" && metric.dataLevel === "municipality") return [];
  const metricIds = entity.type === "municipality" ? metric.kpiIds : metric.schoolKpiIds || metric.kpiIds;
  const ids = metricIds?.length ? metricIds.map((id) => ({ id })) : await searchKpiIds(metric.koladaSearchTerms);
  if (metric.sumKpis || (entity.type !== "municipality" && metric.schoolKpiIds?.length > 1)) {
    const mergedByYear = new Map();
    for (const kpi of ids) {
      try {
        const yearlyRows = [];
        for (const year of YEARS) {
          if (entity.type === "municipality") {
            yearlyRows.push(...(await fetchKpiValuesForMunicipality(kpi.id, entity.id || MUNICIPALITY_ID, year)));
          } else if (metric.key === "adaptedStudents" && entity.title === "Hägneskolan") {
            yearlyRows.push(...(await fetchKpiValuesForMunicipality(kpi.id, MUNICIPALITY_ID, year)));
          } else {
            yearlyRows.push(...(await fetchKpiValuesForOUs(kpi.id, [entity.id], year)));
          }
        }
        for (const item of extractKoladaValues(yearlyRows)) {
          const existing = mergedByYear.get(item.year) || { year: item.year, value: 0, source: "Kolada" };
          existing.value += item.value;
          existing.kpi = existing.kpi ? `${existing.kpi}+${kpi.id}` : kpi.id;
          mergedByYear.set(item.year, existing);
        }
      } catch (error) {
        console.warn("KPI data fetch failed", metric.key, kpi.id, entity.title, error);
      }
    }
    return Array.from(mergedByYear.values())
      .map((item) => ({ ...item, value: Number(item.value.toFixed(1)) }))
      .sort((a, b) => a.year - b.year);
  }
  for (const kpi of ids) {
    try {
      const yearlyRows = [];
      for (const year of YEARS) {
        if (entity.type === "municipality") {
          yearlyRows.push(...(await fetchKpiValuesForMunicipality(kpi.id, entity.id || MUNICIPALITY_ID, year)));
        } else if (metric.key === "adaptedStudents" && entity.title === "Hägneskolan") {
          yearlyRows.push(...(await fetchKpiValuesForMunicipality(kpi.id, MUNICIPALITY_ID, year)));
        } else {
          yearlyRows.push(...(await fetchKpiValuesForOUs(kpi.id, [entity.id], year)));
        }
      }
      const values = extractKoladaValues(yearlyRows);
      if (values.length) return values.map((v) => ({ ...v, kpi: kpi.id, kpiTitle: kpi.title }));
    } catch (error) {
      console.warn("KPI data fetch failed", metric.key, kpi.id, entity.title, error);
    }
  }
  return [];
}

async function loadMunicipalityAverageSeries(metric, municipalityIds) {
  const ids = metric.kpiIds?.length ? metric.kpiIds.map((id) => ({ id })) : await searchKpiIds(metric.koladaSearchTerms);
  for (const kpi of ids) {
    try {
      const values = [];
      for (const year of YEARS) {
        const rows = await fetchKpiValuesForMunicipality(kpi.id, municipalityIds.join(","), year);
        const yearValues = extractKoladaValues(rows).map((item) => item.value).filter((value) => Number.isFinite(Number(value)));
        if (yearValues.length) {
          const average = yearValues.reduce((sum, value) => sum + value, 0) / yearValues.length;
          values.push({ year, value: Number(average.toFixed(1)), source: "Liknande kommuner" });
        }
      }
      if (values.length) return values;
    } catch (error) {
      console.warn("Comparison data fetch failed", metric.key, kpi.id, error);
    }
  }
  return [];
}

async function loadKoladaMultiSeries(metric, entity) {
  const mergedByYear = new Map();
  for (const series of metric.series || []) {
    const values = await loadKoladaSeries({ ...metric, kpiIds: series.kpiIds }, entity);
    for (const item of values) {
      const existing = mergedByYear.get(item.year) || { year: item.year, source: "Kolada" };
      existing[series.key] = Number((item.value * (series.scale || 1)).toFixed(1));
      mergedByYear.set(item.year, existing);
    }
  }
  return Array.from(mergedByYear.values()).sort((a, b) => a.year - b.year);
}

async function loadSchools() {
  const predefined = getPredefinedSkolenheter(MUNICIPALITY_ID);
  try {
    const values = await fetchOUsByMunicipality(MUNICIPALITY_ID);
    const byId = new Map(values.map((x) => [x.id, x]));
    return predefined
      .map((school) => {
        const koladaMatch = byId.get(school.id);
        return { ...school, title: koladaMatch?.title || school.title, grades: school.grades, stage: school.stage || detectStage(school) || "F-6", source: koladaMatch ? "Kolada OU + fördefinierad lista" : school.source };
      })
      .sort((a, b) => a.title.localeCompare(b.title, "sv"));
  } catch (error) {
    console.warn("OU fetch failed, using predefined schools", error);
    return predefined.sort((a, b) => a.title.localeCompare(b.title, "sv"));
  }
}

function toAbsencePoint(row) {
  return {
    year: row.year,
    value: row.total_franvaro_pct,
    municipalityValue: row.municipalityValue,
    municipalityName: row.municipalityName,
    source: row.source,
  };
}

function getStudentAbsenceSeries(entity) {
  if (entity.type === "municipality") {
    return studentAbsenceData.municipality.map(toAbsencePoint);
  }
  const school = studentAbsenceData.schools.find((item) => item.name === entity.title);
  return school ? school.values.map(toAbsencePoint) : [];
}

function toStaffAbsencePoint(row) {
  return {
    year: row.year,
    value: row.value,
    municipalityValue: row.municipalityValue,
    municipalityName: row.municipalityName,
    source: row.source,
  };
}

function getStaffAbsenceSeries(entity) {
  if (entity.type === "municipality") {
    return staffAbsenceData.municipality.map(toStaffAbsencePoint);
  }
  const school = staffAbsenceData.schools.find((item) => item.name === entity.title);
  return school ? school.values.map(toStaffAbsencePoint) : [];
}

function toNationalTests3Point(row) {
  return {
    year: row.year,
    matematik: row.matematik,
    svenskaSva: row.svenskaSva,
    kommunMatematik: row.kommunMatematik,
    kommunSvenskaSva: row.kommunSvenskaSva,
    source: row.source,
  };
}

function getNationalTests3Series(entity) {
  if (entity.type === "municipality") {
    return [];
  }
  const school = nationalTests3Data.schools.find((item) => item.name === entity.title);
  return school ? school.values.map(toNationalTests3Point) : [];
}

function getBudgetDeviationSeries(entity) {
  if (entity.type === "municipality") return budgetDeviationData.municipality;
  const school = budgetDeviationData.schools.find((item) => item.name === entity.title);
  return school ? school.values : [];
}

function mergeLocalSeries(entity, metric, koladaSeries) {
  if (metric.key === "staffAbsence") return getStaffAbsenceSeries(entity);
  if (metric.key === "studentAbsence") return getStudentAbsenceSeries(entity);
  if (metric.key === "nationalTests3") return getNationalTests3Series(entity);
  if (metric.key === "budgetDeviation") return getBudgetDeviationSeries(entity);
  const localBucket = entity.type === "municipality" ? LOCAL_SUPPLEMENT.municipality : LOCAL_SUPPLEMENT.schools[entity.title] || {};
  const localSeries = localBucket?.[metric.key] || [];
  const byYear = new Map();
  for (const item of koladaSeries) byYear.set(item.year, item);
  for (const item of localSeries) byYear.set(item.year, { ...item, source: "Lokal komplettering" });
  const merged = Array.from(byYear.values()).sort((a, b) => a.year - b.year);
  return merged;
}

async function addMunicipalityComparison(metric, entity, items) {
  if (!metric.compareMunicipality || entity.type === "municipality" || metric.key === "studentAbsence") return items;
  const municipalitySeries = metric.series
    ? await loadKoladaMultiSeries(metric, { type: "municipality", id: MUNICIPALITY_ID, title: MUNICIPALITY_NAME })
    : await loadKoladaSeries(metric, { type: "municipality", id: MUNICIPALITY_ID, title: MUNICIPALITY_NAME });
  if (!municipalitySeries.length) return items;
  const municipalityByYear = new Map(municipalitySeries.map((item) => [item.year, item]));
  return items.map((item) => {
    const municipalityItem = municipalityByYear.get(item.year);
    return municipalityItem ? { ...item, municipalityValue: municipalityItem.value, municipalityName: MUNICIPALITY_NAME } : item;
  });
}

async function addExternalComparisons(metric, items) {
  if (!EXTERNAL_COMPARISON_METRICS.has(metric.key) || metric.series || !items.length) return items;
  const [riketSeries, similarSeries] = await Promise.all([
    loadKoladaSeries(metric, { type: "municipality", id: RIKET_ID, title: "Riket" }),
    loadMunicipalityAverageSeries(metric, SIMILAR_MUNICIPALITY_IDS),
  ]);
  const riketByYear = new Map(riketSeries.map((item) => [item.year, item.value]));
  const similarByYear = new Map(similarSeries.map((item) => [item.year, item.value]));
  return items.map((item) => ({
    ...item,
    riketValue: riketByYear.get(item.year),
    similarValue: similarByYear.get(item.year),
  }));
}

async function addComparisons(metric, entity, items) {
  const withMunicipality = await addMunicipalityComparison(metric, entity, items);
  return addExternalComparisons(metric, withMunicipality);
}

function hasSeriesData(items, metric) {
  if (!items?.length) return false;
  if (!metric.series) return items.some((item) => Number.isFinite(Number(item.value)));
  return items.some((item) => metric.series.some((series) => Number.isFinite(Number(item[series.key]))));
}

function getEntityStage(entity) {
  if (entity.type === "municipality") return "F-9";
  return entity.stage || detectStage(entity) || "F-6";
}

function isMetricVisibleForEntity(metric, entity) {
  if (!metric.stage) return true;
  return metric.stage.includes(getEntityStage(entity));
}

function compactNumber(value) {
  if (!Number.isFinite(Number(value))) return "–";
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(value);
}

function formatSchoolYear(year) {
  const end = Number(year);
  return Number.isFinite(end) ? `${end - 1}/${end}` : year;
}

function formatMetricYear(year, metric) {
  return metric.period === "calendarYear" ? String(year) : formatSchoolYear(year);
}

function MetricChart({ metric, data, entityTitle }) {
  const chartData = metric.series
    ? data.map((d) => ({ ...d, år: formatMetricYear(d.year, metric) }))
    : data.map((d) => ({
      år: formatMetricYear(d.year, metric),
      [entityTitle]: d.value,
      Kommun: d.municipalityValue,
      Riket: d.riketValue,
      "Liknande kommuner": d.similarValue,
      source: d.source,
    }));
  if (!hasSeriesData(data, metric)) return <div className="empty-chart">Data saknas i Kolada eller lokal komplettering</div>;
  const common = (
    <>
      <CartesianGrid vertical={false} stroke="#d9d9d9" />
      <XAxis dataKey="år" tick={{ fontSize: 12, fill: "#000", fontWeight: 800 }} tickLine={false} axisLine={false} />
      <YAxis tick={{ fontSize: 12, fill: "#000", fontWeight: 800 }} tickFormatter={(value) => metric.unit === "%" ? `${value}%` : value} domain={metric.unit === "%" ? [0, 100] : metric.unit === "index 0-10" ? [0, 10] : ["auto", "auto"]} tickLine={false} axisLine={false} />
      <Tooltip formatter={(value, name) => [`${compactNumber(value)} ${metric.unit}`, name]} />
      <Legend wrapperStyle={{ fontSize: 12, fontWeight: 800 }} iconType="line" />
    </>
  );

  if (metric.chart === "bar") {
    return (
      <ResponsiveContainer width="100%" height={metric.series ? 260 : 155}>
        <BarChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
          {common}
          {metric.series ? metric.series.map((series) => (
            <Bar key={series.key} dataKey={series.key} name={series.label} fill={series.color} radius={[3, 3, 0, 0]} />
          )) : (
            <Bar dataKey={entityTitle} fill="currentColor" radius={[4, 4, 0, 0]} />
          )}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={metric.series ? 260 : 180}>
      <LineChart data={chartData} margin={{ top: 12, right: 18, left: 8, bottom: 0 }}>
        {common}
        {metric.series ? metric.series.map((series) => (
          <Line key={series.key} type="monotone" dataKey={series.key} name={series.label} stroke={series.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />
        )).concat(metric.key === "nationalTests3" && data.some((item) => Number.isFinite(Number(item.kommunMatematik))) ? [
          <Line key="kommunMatematik" type="monotone" dataKey="kommunMatematik" name="Kommun matematik" stroke="#0f766e" strokeWidth={1.8} strokeDasharray="5 5" dot={{ r: 2 }} connectNulls />,
          <Line key="kommunSvenskaSva" type="monotone" dataKey="kommunSvenskaSva" name="Kommun svenska/SVA" stroke="#ea580c" strokeWidth={1.8} strokeDasharray="5 5" dot={{ r: 2 }} connectNulls />,
        ] : []) : (
          <>
            <Line type="monotone" dataKey={entityTitle} stroke="#14b8a6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            {metric.compareMunicipality && data.some((item) => Number.isFinite(Number(item.municipalityValue))) && (
              <Line type="monotone" dataKey="Kommun" stroke="#f97316" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} connectNulls />
            )}
            {EXTERNAL_COMPARISON_METRICS.has(metric.key) && data.some((item) => Number.isFinite(Number(item.riketValue))) && (
              <Line type="monotone" dataKey="Riket" stroke="#64748b" strokeWidth={1.8} dot={{ r: 2 }} connectNulls />
            )}
            {EXTERNAL_COMPARISON_METRICS.has(metric.key) && data.some((item) => Number.isFinite(Number(item.similarValue))) && (
              <Line type="monotone" dataKey="Liknande kommuner" stroke="#2563eb" strokeWidth={1.8} strokeDasharray="3 4" dot={{ r: 2 }} connectNulls />
            )}
          </>
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

function MetricCard({ metric, data, entityTitle }) {
  const latest = metric.series ? null : [...data].reverse().find((x) => Number.isFinite(Number(x.value)));
  const localFlag = metric.localNeeded === true ? "Lokal" : metric.localNeeded === "partial" ? "Delvis lokal" : "Kolada";
  return (
    <Card className="metric-card">
      <CardContent className="metric-content">
        <div className="metric-heading">
          <div>
            <h3>{metric.order}. {metric.title} {metric.unit === "%" ? "(%)" : ""}</h3>
            {metric.description && <p className="metric-description">{metric.description}</p>}
            <p>{metric.source}</p>
          </div>
          <span>{localFlag}</span>
        </div>
        {!metric.series && <div className="metric-value">{latest ? compactNumber(latest.value) : "–"}<small>{metric.unit}</small></div>}
        <MetricChart metric={metric} data={data} entityTitle={entityTitle} />
      </CardContent>
    </Card>
  );
}

function SourcesPanel({ metrics }) {
  const kolada = metrics.filter((m) => !m.localNeeded).length;
  const local = metrics.filter((m) => m.localNeeded === true).length;
  const partial = metrics.filter((m) => m.localNeeded === "partial").length;
  return (
    <div className="sources-panel print-hidden">
      <Card className="source-card source-kolada"><CardContent className="source-content"><Database /><div><p>{kolada}</p><span>mått hämtas främst från Kolada</span></div></CardContent></Card>
      <Card className="source-card source-partial"><CardContent className="source-content"><AlertTriangle /><div><p>{partial}</p><span>mått behöver valideras eller kompletteras</span></div></CardContent></Card>
      <Card className="source-card source-local"><CardContent className="source-content"><FileText /><div><p>{local}</p><span>mått kräver lokal import</span></div></CardContent></Card>
    </div>
  );
}

function SavsjoQualityDashboard() {
  const [schools, setSchools] = useState(SCHOOL_FALLBACK.map((s) => ({ ...s, type: "school" })));
  const [selected, setSelected] = useState({ type: "municipality", id: MUNICIPALITY_ID, title: MUNICIPALITY_NAME, grades: "Huvudman" });
  const [series, setSeries] = useState({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Inte synkad ännu");
  const pageRef = useRef(null);

  const entities = useMemo(() => [{ type: "municipality", id: MUNICIPALITY_ID, title: MUNICIPALITY_NAME, grades: "Huvudman", stage: "F-9" }, ...schools], [schools]);
  const visibleMetrics = useMemo(() => KPI_CATALOG.filter((m) => isMetricVisibleForEntity(m, selected)), [selected]);
  const prerequisiteMetrics = useMemo(() => visibleMetrics.filter((metric) => metric.category === "förutsättningar"), [visibleMetrics]);
  const outcomeMetrics = useMemo(() => visibleMetrics.filter((metric) => metric.category === "utfall"), [visibleMetrics]);

  async function sync() {
    setLoading(true);
    setStatus("Hämtar skolenheter och Kolada-data ...");
    const loadedSchools = await loadSchools();
    setSchools(loadedSchools);
    const currentEntity = selected.type === "municipality" ? selected : loadedSchools.find((s) => s.title === selected.title) || loadedSchools[0];
    const next = {};
    for (const metric of KPI_CATALOG) {
      if (!isMetricVisibleForEntity(metric, currentEntity)) continue;
      const koladaSeries = metric.series ? await loadKoladaMultiSeries(metric, currentEntity) : await loadKoladaSeries(metric, currentEntity);
      next[metric.key] = await addComparisons(metric, currentEntity, mergeLocalSeries(currentEntity, metric, koladaSeries));
    }
    setSeries(next);
    const emptyCount = Object.entries(next).filter(([key, items]) => {
      const metric = KPI_CATALOG.find((item) => item.key === key);
      return !hasSeriesData(items, metric);
    }).length;
    setStatus(emptyCount ? `Synkad med luckor: ${emptyCount} mått saknar Kolada-data eller lokal komplettering.` : "Synkad med Kolada/lokala värden.");
    setLoading(false);
  }

  useEffect(() => { sync(); }, [selected.title]);

  async function exportPdf() {
    const element = pageRef.current;
    if (!element) return;
    setStatus("Skapar PDF ...");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`${selected.title.replaceAll(" ", "-").toLowerCase()}-kvalitet-resultat.pdf`);
      setStatus("PDF exporterad.");
    } catch (error) {
      console.error(error);
      window.print();
      setStatus("PDF-bibliotek saknades i miljön. Öppnade utskrift som reservlösning.");
    }
  }

  const entitySupplement = selected.type === "municipality" ? LOCAL_SUPPLEMENT.municipality : LOCAL_SUPPLEMENT.schools[selected.title] || {};

  return (
    <div className="app-shell">
      <div className="container">
        <div className="toolbar print-hidden">
          <div className="toolbar-top">
            <div>
              <p className="eyebrow">Statistikkompassen · kvalitet och resultat</p>
              <h1>Grundskola i Sävsjö</h1>
              <p>Uppföljning på huvudmannanivå och per grundskola. Kolada används där det går, lokala kompletteringar läggs i LOCAL_SUPPLEMENT.</p>
            </div>
            <div className="toolbar-actions">
              <Button onClick={sync} disabled={loading}><RefreshCw className={loading ? "spin" : ""} />Synka</Button>
              <Button onClick={exportPdf} variant="outline"><Download />Exportera PDF</Button>
            </div>
          </div>
          <div className="entity-tabs">
            {entities.map((entity) => (
              <button key={`${entity.type}-${entity.id}`} onClick={() => setSelected(entity)} className={selected.title === entity.title ? "active" : ""}>
                {entity.type === "municipality" ? <Building2 /> : <School />}{entity.title}
              </button>
            ))}
          </div>
          <p className="status">{status}</p>
        </div>

        <SourcesPanel metrics={visibleMetrics} />

        <motion.main ref={pageRef} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="report-page">
          <header className="report-header">
            <div className="report-header-grid">
              <div>
                <p className="level-label">{selected.type === "municipality" ? "Huvudmannanivå" : `${selected.grades} · ${getEntityStage(selected)}`}</p>
                <h2>{selected.title}</h2>
                <p>Övergripande statistik och resultat. Värden som saknas i Kolada markeras genom källa och kompletteras lokalt innan publicering.</p>
              </div>
              <div className="index-box">
                <p>Socioekonomiskt index</p>
                <strong>{entitySupplement.socioEconomicIndex ?? "–"}</strong>
              </div>
            </div>
          </header>

          <section className="metric-grid">
            {prerequisiteMetrics.map((metric) => (
              <MetricCard key={metric.key} metric={metric} data={series[metric.key] || mockSeries(selected.title, metric.key, metric.unit)} entityTitle={selected.title} />
            ))}
          </section>

          <div className="section-divider page-break">
            <div /><p>Måluppfyllelse</p><div />
          </div>

          <section className="metric-grid">
            {outcomeMetrics.map((metric) => (
              <MetricCard key={metric.key} metric={metric} data={series[metric.key] || mockSeries(selected.title, metric.key, metric.unit)} entityTitle={selected.title} />
            ))}
          </section>

          <footer className="report-footer">
            <p>Dataprinciper</p>
            <span>Kolada prioriteras för officiella nyckeltal. Lokal komplettering används för ekonomi, personalfrånvaro, elevfrånvaro, trivsel och de resultatmått där skolenhetsdata inte finns eller behöver brytas ned. Värden med färre än fem elever/personer ska döljas före publicering.</span>
          </footer>
        </motion.main>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<SavsjoQualityDashboard />);
