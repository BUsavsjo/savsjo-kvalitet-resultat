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
import studentAbsenceKpiData from "./data/kpi_franvaro_alla_lasar.json";
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
  "teacherEligibility",
  "teacherPedagogicalDegree",
  "studentsPerTeacher",
  "netCost",
  "preschoolClassCost",
  "svenska6",
  "matematik6",
  "knowledge6",
  "gradePointSwedish6",
  "gradePointMath6",
  "gradePointSva6",
  "engelska6",
  "gymEligibility",
  "knowledge9",
  "meritValue",
  "mathGrade9",
  "english9",
  "math9",
  "swedish9",
]);
const SALSA_ANALYSIS_KEYS = new Set(["salsaEligibility", "salsaMerit"]);
const SECTION_DEFINITIONS = [
  { key: "organisation", title: "Organisation och resurser" },
  { key: "competence", title: "Kompetens och bakgrund" },
  { key: "signals", title: "Tidiga signaler" },
  { key: "lower", title: "Lågstadie" },
  { key: "middle", title: "Mellanstadie" },
  { key: "upper", title: "Högstadie" },
];
const METRIC_SECTIONS = {
  students: "organisation",
  adaptedStudents: "organisation",
  budgetDeviation: "organisation",
  netCost: "organisation",
  preschoolClassCost: "organisation",
  staffAbsence: "organisation",
  studentsPerTeacher: "organisation",
  teacherEligibility: "competence",
  teacherPedagogicalDegree: "competence",
  parentHigherEducation: "competence",
  studentAbsence: "signals",
  wellbeing: "signals",
  schoolSurvey5: "signals",
  schoolSurvey8: "signals",
  nationalTests3: "lower",
  nationalTests6: "middle",
  svenska6: "middle",
  matematik6: "middle",
  engelska6: "middle",
  knowledge6: "middle",
  gradePointSwedish6: "middle",
  gradePointMath6: "middle",
  gradePointSva6: "middle",
  nationalTests9: "upper",
  knowledge9: "upper",
  english9: "upper",
  math9: "upper",
  swedish9: "upper",
  gymEligibility: "upper",
  meritValue: "upper",
  mathGrade9: "upper",
  salsaEligibility: "upper",
  salsaMerit: "upper",
};
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
  { id: "N15034", name: "Elever/lärare i kommunal grundskola åk 1-9", description: "Antal elever per lärare omräknat till heltidstjänster i kommunala skolor i kommunen", unit: "antal" },
  { id: "N15030", name: "Andel lärare med pedagogisk högskoleexamen", description: "Andel lärare med pedagogisk högskoleutbildning", unit: "procent" },
];

const OUTCOME_F6_KPIS = [
  { id: "N15454", name: "Nationella prov åk 3 matematik", description: "Elever i åk 3 som klarat alla delar av nationella provet i matematik, kommunala skolor", unit: "procent" },
  { id: "N15452", name: "Nationella prov åk 3 svenska och SVA", description: "Elever i åk 3 som klarat alla delar av nationella provet i svenska och svenska som andraspråk, kommunala skolor", unit: "procent" },
  { id: "N15486", name: "Andel elever åk 6 med lägst betyget E i svenska", description: "Elever med lägst betyget E i svenska, årskurs 6", unit: "procent" },
  { id: "N15483", name: "Andel elever åk 6 med lägst betyget E i matematik", description: "Elever med lägst betyget E i matematik, årskurs 6", unit: "procent" },
  { id: "N15480", name: "Andel elever åk 6 med lägst betyget E i engelska", description: "Elever med lägst betyget E i engelska, årskurs 6", unit: "procent" },
  { id: "N15514", name: "Betygspoäng i svenska åk 6", description: "Elever i åk 6, betygspoäng i svenska, kommunala skolor, genomsnitt", unit: "poäng" },
  { id: "N15513", name: "Betygspoäng i matematik åk 6", description: "Elever i åk 6, betygspoäng i matematik, kommunala skolor, genomsnitt", unit: "poäng" },
  { id: "N15515", name: "Betygspoäng i svenska som andraspråk åk 6", description: "Elever i åk 6, betygspoäng i svenska som andraspråk, kommunala skolor, genomsnitt", unit: "poäng" },
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
  { id: "V15E068400701", municipality: "0684", title: "Vallsjöskolan", type: "grundskola", grades: "F-6", stage: "F-6", source: "Fördefinierad Kolada OU" },
  { id: "V15E068401101", municipality: "0684", title: "Vrigstad skola", type: "grundskola", grades: "F-6", stage: "F-6", source: "Fördefinierad Kolada OU" },
  { id: "V15E068401501", municipality: "0684", title: "Hofgårdsskolan", type: "grundskola", grades: "7-9", stage: "7-9", source: "Fördefinierad Kolada OU" },
  { id: "V15E068401601", municipality: "0684", title: "Stockaryds skola", type: "grundskola", grades: "F-6", stage: "F-6", source: "Fördefinierad Kolada OU" },
];

function getPredefinedSkolenheter(kommunId) {
  return PREDEFINED_SKOLENHETER.filter((enhet) => enhet.municipality === kommunId).map((enhet) => ({ ...enhet, type: "school" }));
}

const SCHOOL_FALLBACK = getPredefinedSkolenheter(MUNICIPALITY_ID);

const KPI_CATALOG = [
  { key: "students", order: 1, title: "Antal elever", unit: "antal", chart: "line", kpiIds: ["N15835"], schoolKpiIds: ["N15807", "N11805"], source: "Kolada: N15835, skolenhet N15807 + N11805", localNeeded: false, category: "förutsättningar" },
  { key: "adaptedStudents", order: 2, title: "Elever i anpassad grundskola", unit: "antal", chart: "line", kpiIds: ["N18803"], source: "Kolada: N18803", localNeeded: "partial", schoolTitles: ["Hägneskolan"], category: "förutsättningar" },
  { key: "budgetDeviation", order: 4, title: "Budgetavvikelse", unit: "tkr", chart: "line", source: "Lokal ekonomiimport: Budgetavvikelse 5 år.xlsx", localNeeded: true, category: "förutsättningar", period: "calendarYear", series: [
    { key: "grundskola", label: "Grundskola", color: "#14b8a6" },
    { key: "fritids", label: "Fritidshem", color: "#f97316" },
    { key: "anpassadGrundskola", label: "Anpassad grundskola", color: "#8b5cf6" },
    { key: "totalt", label: "Totalt", color: "#0f172a" },
  ] },
  { key: "netCost", order: 5, title: "Kostnad grundskola åk 1-9", unit: "kr/elev", chart: "line", kpiIds: ["N15006"], source: "Kolada: N15006, källa SCB", localNeeded: "partial", dataLevel: "municipality", category: "förutsättningar", period: "calendarYear", description: "Bruttokostnad minus interna intäkter plus kostnad för skolskjuts minus försäljning av verksamhet till andra kommuner, dividerat med medelvärde av antal folkbokförda elever i grundskola åk 1-9. Avser kalenderår." },
  { key: "preschoolClassCost", order: 5.1, title: "Kostnad kommunal förskoleklass", unit: "kr/elev", chart: "line", kpiIds: ["N15053"], source: "Kolada: N15053, källa SCB", localNeeded: "partial", dataLevel: "municipality", category: "förutsättningar", period: "calendarYear", description: "Kostnad kommunal förskoleklass dividerat med antal elever i förskoleklass i kommunens egen regi. Avser kalenderår och egen regi." },
  { key: "staffAbsence", order: 6, title: "Frånvaro personal", unit: "%", chart: "line", source: "Lokal HR-rapport: sjukfrånvaro BU", localNeeded: true, category: "förutsättningar", period: "calendarYear", compareMunicipality: true, description: "Sjukfrånvaro i procent av ordinarie arbetstid. Totalen bygger på BU-rapportens detaljrader och skolenheter aggregeras från respektive enhetsrader." },
  { key: "teacherEligibility", order: 7, title: "Lärarlegitimation och behörighet", unit: "%", chart: "line", kpiIds: ["N15814"], source: "Kolada: N15814", localNeeded: false, category: "förutsättningar", description: "Lärare, omräknat till heltidstjänster, med lärarlegitimation och behörighet i grundskola åk 1-9, kommunala skolor." },
  { key: "teacherPedagogicalDegree", order: 8, title: "Lärare med pedagogisk högskoleexamen", unit: "%", chart: "line", kpiIds: ["N15030"], source: "Kolada: N15030", localNeeded: false, category: "förutsättningar", compareMunicipality: true },
  { key: "studentsPerTeacher", order: 9, title: "Elever/lärare i grundskola", unit: "antal", chart: "line", kpiIds: ["N15034"], schoolKpiIds: ["N15033"], source: "Kolada: kommun N15034, skolenhet N15033", localNeeded: false, category: "förutsättningar", compareMunicipality: true, description: "Kommunnivå visar elever per lärare i kommunal grundskola åk 1-9. Enhetsnivå visar antal elever per lärare på skolenhet enligt Kolada N15033. Avser läsår, mätt den 15 oktober." },
  { key: "studentAbsence", order: 10, title: "Frånvaro elever", unit: "%", chart: "line", source: "Lokal frånvarorapport från Edlevo", localNeeded: true, category: "förutsättningar", compareMunicipality: true },
  { key: "parentHigherEducation", order: 11, title: "Föräldrar med eftergymnasial utbildning", unit: "%", chart: "line", kpiIds: ["N15816"], source: "Kolada: N15816", localNeeded: false, category: "förutsättningar", compareMunicipality: true },
  { key: "wellbeing", order: 12, title: "Trivsel elever", unit: "%", chart: "bar", source: "Lokal enkät eller Skolenkäten där jämförbart värde finns", localNeeded: true, category: "förutsättningar" },
  { key: "nationalTests3", order: 9, title: "Resultat nationella prov årskurs 3", unit: "%", chart: "line", source: "Kolada: N15454, N15452. Lokal NP-import används endast som reserv där Kolada saknar skolenhetsdata.", localNeeded: "partial", stage: ["F-6", "F-9"], category: "utfall", description: "Andel elever som uppnått kravnivån i samtliga delprov på nationella proven i svenska och SVA samt matematik i årskurs 3.", series: [
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
  { key: "engelska6", order: 14, title: "Åk 6 minst E i engelska", unit: "%", chart: "line", kpiIds: ["N15480"], source: "Kolada: N15480", localNeeded: false, stage: ["F-6", "F-9"], category: "utfall" },
  { key: "knowledge6", order: 15, title: "Åk 6 uppnått betygskriterierna i alla ämnen", unit: "%", chart: "line", kpiIds: ["N15540"], source: "Kolada: N15540", localNeeded: false, stage: ["F-6", "F-9"], category: "utfall", compareMunicipality: true },
  { key: "gradePointSwedish6", order: 16, title: "Åk 6 betygspoäng svenska", unit: "poäng", chart: "line", kpiIds: ["N15514"], source: "Kolada: N15514", localNeeded: false, stage: ["F-6", "F-9"], category: "utfall", compareMunicipality: true, description: "Genomsnittlig betygspoäng i svenska för elever i årskurs 6, kommunala skolor." },
  { key: "gradePointMath6", order: 17, title: "Åk 6 betygspoäng matematik", unit: "poäng", chart: "line", kpiIds: ["N15513"], source: "Kolada: N15513", localNeeded: false, stage: ["F-6", "F-9"], category: "utfall", compareMunicipality: true, description: "Genomsnittlig betygspoäng i matematik för elever i årskurs 6, kommunala skolor." },
  { key: "gradePointSva6", order: 18, title: "Åk 6 betygspoäng svenska som andraspråk", unit: "poäng", chart: "line", kpiIds: ["N15515"], source: "Kolada: N15515", localNeeded: false, stage: ["F-6", "F-9"], entityTypes: ["municipality"], category: "utfall", description: "Genomsnittlig betygspoäng i svenska som andraspråk för elever i årskurs 6, kommunala skolor. Visas bara på kommunnivå eftersom Kolada saknar skolenhetsvärden för detta mått." },
  { key: "knowledge9", order: 15, title: "Åk 9 uppnått betygskriterierna i alla ämnen", unit: "%", chart: "line", kpiIds: ["N15419"], source: "Kolada: N15419", localNeeded: false, stage: ["7-9", "F-9"], category: "utfall", compareMunicipality: true },
  { key: "schoolSurvey5", order: 16, title: "Skolenkäten årskurs 5", unit: "index 0-10", chart: "bar", source: "Kolada, redovisas vartannat år", localNeeded: false, stage: ["F-6", "F-9"], category: "utfall", period: "surveyYear", description: "Indexvärden 0-10 inom stimulans, stöd, studiero, trygghet och skolans arbete med att förhindra kränkningar. Visas efter enkätår eftersom Skolenkäten genomförs vartannat år.", series: [
    { key: "stimulans", label: "Stimulans", kpiIds: ["N15602"], color: "#14b8a6", scale: 0.1 },
    { key: "stod", label: "Stöd", kpiIds: ["N15623"], color: "#0ea5e9", scale: 0.1 },
    { key: "studiero", label: "Studiero", kpiIds: ["N15603"], color: "#f97316", scale: 0.1 },
    { key: "trygghet", label: "Trygghet", kpiIds: ["N15613"], color: "#e11d48", scale: 0.1 },
    { key: "krankningar", label: "Förhindra kränkningar", kpiIds: ["N15614"], color: "#8b5cf6", scale: 0.1 },
  ] },
  { key: "schoolSurvey8", order: 16, title: "Skolenkäten årskurs 8", unit: "index 0-10", chart: "bar", source: "Kolada, redovisas vartannat år", localNeeded: false, stage: ["7-9", "F-9"], category: "utfall", period: "surveyYear", description: "Indexvärden 0-10 inom stimulans, stöd, studiero, trygghet och skolans arbete med att förhindra kränkningar. Visas efter enkätår eftersom Skolenkäten genomförs vartannat år.", series: [
    { key: "stimulans", label: "Stimulans", kpiIds: ["N15632"], color: "#14b8a6", scale: 0.1 },
    { key: "stod", label: "Stöd", kpiIds: ["N15653"], color: "#0ea5e9", scale: 0.1 },
    { key: "studiero", label: "Studiero", kpiIds: ["N15633"], color: "#f97316", scale: 0.1 },
    { key: "trygghet", label: "Trygghet", kpiIds: ["N15643"], color: "#e11d48", scale: 0.1 },
    { key: "krankningar", label: "Förhindra kränkningar", kpiIds: ["N15644"], color: "#8b5cf6", scale: 0.1 },
  ] },
  { key: "english9", order: 17, title: "Åk 9 minst E i engelska", unit: "%", chart: "line", kpiIds: ["N15492"], source: "Kolada: N15492", localNeeded: false, stage: ["7-9", "F-9"], entityTypes: ["school"], category: "utfall", compareMunicipality: true, description: "Elever i åk 9 med lägst betyget E i engelska, kommunala skolor, andel." },
  { key: "math9", order: 18, title: "Åk 9 minst E i matematik", unit: "%", chart: "line", kpiIds: ["N15495"], source: "Kolada: N15495", localNeeded: false, stage: ["7-9", "F-9"], entityTypes: ["school"], category: "utfall", compareMunicipality: true, description: "Elever i åk 9 med lägst betyget E i matematik, kommunala skolor, andel." },
  { key: "swedish9", order: 19, title: "Åk 9 minst E i svenska", unit: "%", chart: "line", kpiIds: ["N15498"], source: "Kolada: N15498", localNeeded: false, stage: ["7-9", "F-9"], entityTypes: ["school"], category: "utfall", compareMunicipality: true, description: "Elever i åk 9 med lägst betyget E i svenska, kommunala skolor, andel." },
  { key: "gymEligibility", order: 20, title: "Gymnasiebehörighet", unit: "%", chart: "line", kpiIds: ["N15424"], source: "Kolada: N15424", localNeeded: false, stage: ["7-9", "F-9"], category: "utfall" },
  { key: "meritValue", order: 21, title: "Genomsnittligt meritvärde", unit: "poäng", chart: "line", kpiIds: ["N15504"], source: "Kolada: N15504", localNeeded: false, stage: ["7-9", "F-9"], category: "utfall", compareMunicipality: true },
  { key: "mathGrade9", order: 22, title: "Åk 9 betygspoäng matematik", unit: "poäng", chart: "line", kpiIds: ["N15503"], source: "Kolada: N15503", localNeeded: false, stage: ["7-9", "F-9"], category: "utfall" },
  { key: "salsaEligibility", order: 21, title: "SALSA avvikelse resultat", unit: "procentenheter", chart: "line", kpiIds: ["U15414"], source: "Kolada: U15414", localNeeded: false, stage: ["7-9", "F-9"], entityTypes: ["school"], category: "utfall" },
  { key: "salsaMerit", order: 22, title: "SALSA avvikelse meritvärde", unit: "poäng", chart: "line", kpiIds: ["U15416"], source: "Kolada: U15416", localNeeded: false, stage: ["7-9", "F-9"], entityTypes: ["school"], category: "utfall" },
];

const LOCAL_SUPPLEMENT = {
  municipality: { socioEconomicIndex: null, adaptedStudents: [], staffAbsence: [], teacherPedagogicalDegree: [], studentAbsence: [], parentHigherEducation: [], wellbeing: [], nationalTests3: [], nationalTests6: [], nationalTests9: [], knowledge6: [], knowledge9: [], schoolSurvey: [] },
  schools: {
    "Hägneskolan": { socioEconomicIndex: null, adaptedStudents: [], staffAbsence: [], teacherPedagogicalDegree: [], studentAbsence: [], parentHigherEducation: [], wellbeing: [], nationalTests3: [], nationalTests6: [], nationalTests9: [], knowledge6: [], knowledge9: [], schoolSurvey: [] },
    "Rörviks skola": { socioEconomicIndex: null, adaptedStudents: [], staffAbsence: [], teacherPedagogicalDegree: [], studentAbsence: [], parentHigherEducation: [], wellbeing: [], nationalTests3: [], nationalTests6: [], nationalTests9: [], knowledge6: [], knowledge9: [], schoolSurvey: [] },
    "Stockaryds skola": { socioEconomicIndex: null, adaptedStudents: [], staffAbsence: [], teacherPedagogicalDegree: [], studentAbsence: [], parentHigherEducation: [], wellbeing: [], nationalTests3: [], nationalTests6: [], nationalTests9: [], knowledge6: [], knowledge9: [], schoolSurvey: [] },
    "Vallsjöskolan": { socioEconomicIndex: null, adaptedStudents: [], staffAbsence: [], teacherPedagogicalDegree: [], studentAbsence: [], parentHigherEducation: [], wellbeing: [], nationalTests3: [], nationalTests6: [], nationalTests9: [], knowledge6: [], knowledge9: [], schoolSurvey: [] },
    "Vrigstad skola": { socioEconomicIndex: null, adaptedStudents: [], staffAbsence: [], teacherPedagogicalDegree: [], studentAbsence: [], parentHigherEducation: [], wellbeing: [], nationalTests3: [], nationalTests6: [], nationalTests9: [], knowledge6: [], knowledge9: [], schoolSurvey: [] },
    "Sävsjö kristna skola": { socioEconomicIndex: null, adaptedStudents: [], staffAbsence: [], teacherPedagogicalDegree: [], studentAbsence: [], parentHigherEducation: [], wellbeing: [], nationalTests3: [], nationalTests6: [], nationalTests9: [], knowledge6: [], knowledge9: [], schoolSurvey: [] },
    "Hofgårdsskolan": { socioEconomicIndex: null, adaptedStudents: [], staffAbsence: [], teacherPedagogicalDegree: [], studentAbsence: [], parentHigherEducation: [], wellbeing: [], nationalTests3: [], nationalTests6: [], nationalTests9: [], knowledge6: [], knowledge9: [], schoolSurvey: [] },
  },
};

function seededValue(seed, year, min, max, decimals = 0) {
  const raw = Math.sin((seed.length + 7) * (year + 13)) * 10000;
  const fraction = raw - Math.floor(raw);
  return Number((min + fraction * (max - min)).toFixed(decimals));
}

function mockSeries(entityName, key, unit) {
  return YEARS.map((year) => {
    const lower = unit === "%" ? 55 : unit === "poäng" ? 185 : unit === "index 0-10" ? 4 : 8;
    const upper = unit === "%" ? 95 : unit === "poäng" ? 245 : unit === "index 0-10" ? 8.8 : 380;
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

const ABSENCE_SCHOOL_NAME_MAP = {
  hofgard: "Hofgård",
  hagne: "Hägne",
  rorvik: "Rörvik",
  rorviks: "Rörvik",
  stockaryd: "Stockaryd",
  stockaryds: "Stockaryd",
  vallsjo: "Vallsjö",
  vrigstad: "Vrigstad",
};

function fixMojibake(value) {
  if (typeof value !== "string") return value;
  return value
    .replaceAll("Ã¥", "å")
    .replaceAll("Ã¤", "ä")
    .replaceAll("Ã¶", "ö")
    .replaceAll("Ã…", "Å")
    .replaceAll("Ã„", "Ä")
    .replaceAll("Ã–", "Ö");
}

function normalizeAbsenceSchoolName(name = "") {
  return fixMojibake(name)
    .toLowerCase()
    .replaceAll("å", "a")
    .replaceAll("ä", "a")
    .replaceAll("ö", "o")
    .replace("sskolan", "")
    .replace("skolan", "")
    .replace("skola", "")
    .replace(/\s+/g, "")
    .trim();
}

function getAbsenceSchoolName(entityTitle) {
  return ABSENCE_SCHOOL_NAME_MAP[normalizeAbsenceSchoolName(entityTitle)] || entityTitle;
}

function shareToPct(value) {
  return Number.isFinite(Number(value)) ? Number((Number(value) * 100).toFixed(1)) : null;
}

function getAbsenceEndYear(schoolYear) {
  const match = String(schoolYear || "").match(/(\d{4})\s*$/);
  return match ? Number(match[1]) : null;
}

function isSameAbsenceSchoolYear(left, right) {
  if (!left || !right) return true;
  const leftYear = getAbsenceEndYear(left);
  const rightYear = getAbsenceEndYear(right);
  return Number.isFinite(leftYear) && Number.isFinite(rightYear) && leftYear === rightYear;
}

function toAbsenceKpiPoint(summary, municipalitySummary) {
  return {
    year: getAbsenceEndYear(summary.school_year),
    schoolYear: summary.school_year,
    schoolName: fixMojibake(summary.school_name),
    value: shareToPct(summary.avg_total_absence_share),
    totalAbsence: shareToPct(summary.avg_total_absence_share),
    unauthorisedAbsence: shareToPct(summary.avg_unauthorised_absence_share),
    over10: shareToPct(summary.total_absence_over_10_share),
    over15: shareToPct(summary.total_absence_15_plus_share),
    over30: shareToPct(summary.total_absence_30_plus_share),
    unauthorisedOver5: shareToPct(summary.unauthorised_absence_5_plus_share),
    studentCount: summary.student_count,
    over10Count: summary.total_absence_over_10_count,
    over15Count: summary.total_absence_15_plus_count,
    over30Count: summary.total_absence_30_plus_count,
    unauthorisedOver5Count: summary.unauthorised_absence_5_plus_count,
    riskLevel: summary.overall_risk_level,
    municipalityValue: municipalitySummary ? shareToPct(municipalitySummary.avg_total_absence_share) : undefined,
    municipalityOver15: municipalitySummary ? shareToPct(municipalitySummary.total_absence_15_plus_share) : undefined,
    municipalityName: MUNICIPALITY_NAME,
    source: "Lokal frånvaro-KPI",
  };
}

function getStudentAbsenceKpiRows(entity) {
  const summaries = studentAbsenceKpiData.summaries || [];
  if (entity.type === "municipality") {
    return summaries
      .filter((item) => item.scope === "municipality")
      .map((summary) => toAbsenceKpiPoint(summary, summary))
      .filter((item) => Number.isFinite(item.year))
      .sort((a, b) => a.year - b.year);
  }

  const schoolNameKey = normalizeAbsenceSchoolName(getAbsenceSchoolName(entity.title));
  return summaries
    .filter((item) => item.scope === "school" && normalizeAbsenceSchoolName(item.school_name) === schoolNameKey)
    .map((summary) => {
      const municipalitySummary = summaries.find((item) => item.scope === "municipality" && item.school_year === summary.school_year);
      return toAbsenceKpiPoint(summary, municipalitySummary);
    })
    .filter((item) => Number.isFinite(item.year))
    .sort((a, b) => a.year - b.year);
}

function getStudentAbsenceSeries(entity) {
  const kpiRows = getStudentAbsenceKpiRows(entity);
  if (kpiRows.length) return kpiRows;
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
  if (metric.key === "nationalTests3" && entity.type !== "municipality" && !hasSeriesData(koladaSeries, metric)) return getNationalTests3Series(entity);
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
  if (metric.entityTypes && !metric.entityTypes.includes(entity.type)) return false;
  if (entity.type !== "municipality" && metric.dataLevel === "municipality") return false;
  if (metric.schoolTitles && entity.type === "school" && !metric.schoolTitles.includes(entity.title)) return false;
  if (!metric.stage) return true;
  return metric.stage.includes(getEntityStage(entity));
}

function getMetricSection(metric) {
  return METRIC_SECTIONS[metric.key] || (metric.category === "förutsättningar" ? "organisation" : "upper");
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
  if (metric.period === "surveyYear") return `Enkät ${year}`;
  return metric.period === "calendarYear" ? String(year) : formatSchoolYear(year);
}

function getMetricPeriodNote(metric, year) {
  if (!year) return "Period saknas";
  if (metric.key === "studentAbsence") return `Läsår ${formatSchoolYear(year)}`;
  if (metric.period === "calendarYear") return `Kalenderår ${year}`;
  if (metric.period === "surveyYear") return `Enkätår ${year}`;
  return `Rapporterat år ${year}`;
}

function getMetricRenderData(metric, selected, series) {
  const items = series[metric.key];
  if (items?.length) return items;
  if (metric.key === "studentAbsence") return [];
  return mockSeries(selected.title, metric.key, metric.unit);
}

function getMetricDomain(metric) {
  if (metric.key === "staffAbsence") return [0, 15];
  if (metric.key === "studentAbsence") return [0, 25];
  if (metric.unit === "%") return [0, 100];
  if (metric.unit === "index 0-10") return [0, 10];
  return ["auto", "auto"];
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
      <YAxis tick={{ fontSize: 12, fill: "#000", fontWeight: 800 }} tickFormatter={(value) => metric.unit === "%" ? `${value}%` : value} domain={getMetricDomain(metric)} tickLine={false} axisLine={false} />
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
  if (metric.key === "studentAbsence") {
    return <StudentAbsenceRiskCard metric={metric} data={data} entityTitle={entityTitle} />;
  }
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

function formatPct(value) {
  return Number.isFinite(Number(value)) ? `${compactNumber(value)}%` : "â€“";
}

function formatCount(value) {
  if (value === "<3") return "<3";
  return Number.isFinite(Number(value)) ? new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(value) : "â€“";
}

function getGradeSortValue(grade) {
  const normalized = String(grade || "").trim().toUpperCase();
  if (normalized === "F") return 0;
  const number = Number(normalized.replace(/^ÅK\s*/i, ""));
  return Number.isFinite(number) ? number : 99;
}

function getUniqueGradeRows(rows) {
  const byGrade = new Map();
  for (const row of rows) {
    const key = String(row.grade || "").trim().toUpperCase();
    const existing = byGrade.get(key);
    if (!existing || Number(row.studentCount || 0) > Number(existing.studentCount || 0)) {
      byGrade.set(key, row);
    }
  }
  return Array.from(byGrade.values());
}

function getLatestAbsenceSchoolRows(schoolYear) {
  const summaries = studentAbsenceKpiData.summaries || [];
  const targetYear = getAbsenceEndYear(schoolYear);
  const latestYear = Number.isFinite(targetYear)
    ? targetYear
    : Math.max(...summaries.filter((item) => item.scope === "school").map((item) => getAbsenceEndYear(item.school_year)).filter(Number.isFinite));
  return summaries
    .filter((item) => item.scope === "school" && getAbsenceEndYear(item.school_year) === latestYear)
    .map((item) => toAbsenceKpiPoint(item, summaries.find((summary) => summary.scope === "municipality" && summary.school_year === item.school_year)))
    .sort((a, b) => Number(b.over15 || 0) - Number(a.over15 || 0));
}

function getLatestAbsenceGradeRows(entityTitle, schoolYear) {
  const summaries = studentAbsenceKpiData.summaries || [];
  const schoolNameKey = normalizeAbsenceSchoolName(getAbsenceSchoolName(entityTitle));
  const rows = summaries.filter((item) => item.scope === "school_grade" && normalizeAbsenceSchoolName(item.school_name) === schoolNameKey);
  const targetYear = getAbsenceEndYear(schoolYear);
  const latestYear = Number.isFinite(targetYear)
    ? targetYear
    : Math.max(...rows.map((item) => getAbsenceEndYear(item.school_year)).filter(Number.isFinite));
  const mappedRows = rows
    .filter((item) => getAbsenceEndYear(item.school_year) === latestYear)
    .map((item) => ({ ...toAbsenceKpiPoint(item, null), grade: item.grade }))
    .filter((item) => isSameAbsenceSchoolYear(item.schoolYear, schoolYear));
  return getUniqueGradeRows(mappedRows)
    .sort((a, b) => getGradeSortValue(a.grade) - getGradeSortValue(b.grade));
}

function riskLabel(level) {
  return {
    low: "Låg",
    attention: "Uppmärksamma",
    risk: "Risk",
    high: "Hög",
    critical: "Kritisk",
    red: "Röd",
    yellow: "Gul",
    green: "Grön",
  }[level] || level || "â€“";
}

function getDelta(current, previous, key) {
  if (!previous || !Number.isFinite(Number(current?.[key])) || !Number.isFinite(Number(previous?.[key]))) return null;
  return Number((Number(current[key]) - Number(previous[key])).toFixed(1));
}

function formatDelta(delta, unit = "p.e.") {
  if (!Number.isFinite(Number(delta))) return null;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${compactNumber(delta)} ${unit}`;
}

function AbsenceMiniKpi({ label, value, count, total, delta }) {
  return (
    <div className="absence-mini-kpi">
      <span>{label}</span>
      <strong>{formatPct(value)}</strong>
      {count !== undefined && <small>{formatCount(count)}{total ? ` av ${formatCount(total)}` : ""} elever</small>}
      {delta !== null && delta !== undefined && <em className={delta > 0 ? "delta-bad" : delta < 0 ? "delta-good" : ""}>{formatDelta(delta)}</em>}
    </div>
  );
}

function buildAbsenceInsight(latest, previous) {
  if (!latest) return "";
  const parts = [];
  const over15Delta = getDelta(latest, previous, "over15");
  const over30Delta = getDelta(latest, previous, "over30");
  const unauthorisedDelta = getDelta(latest, previous, "unauthorisedOver5");
  if (Number.isFinite(over15Delta)) {
    parts.push(over15Delta < -0.2 ? "Riskfrånvaron över 15% minskar jämfört med föregående läsår" : over15Delta > 0.2 ? "Riskfrånvaron över 15% ökar jämfört med föregående läsår" : "Riskfrånvaron över 15% är i stort sett oförändrad");
  }
  if (Number.isFinite(unauthorisedDelta) && unauthorisedDelta > 0.2) parts.push("ogiltig frånvaro över 5% ökar");
  if (Number.isFinite(over30Delta) && latest.over30 >= 3) parts.push("allvarlig frånvaro över 30% behöver följas nära");
  return parts.length ? `${parts.join(", ")}.` : "Följ utvecklingen över tid och jämför särskilt riskfrånvaro med kommunens nivå.";
}

function StudentAbsenceRiskCard({ metric, data, entityTitle }) {
  const latest = [...data].reverse().find((x) => Number.isFinite(Number(x.value)));
  if (!latest) {
    return (
      <Card className="metric-card absence-risk-card">
        <CardContent className="metric-content">
          <div className="metric-heading">
            <div>
              <h3>{metric.order}. {metric.title} (%)</h3>
              <p>{metric.source}</p>
            </div>
            <span>Lokal</span>
          </div>
          <div className="empty-chart">Frånvarodata saknas i lokal komplettering</div>
        </CardContent>
      </Card>
    );
  }

  const previous = [...data].reverse().find((x) => x.year < latest.year && Number.isFinite(Number(x.value)));
  const chartData = data.map((item) => ({
    ...item,
    ar: formatMetricYear(item.year, metric),
  }));
  const comparisonRows = entityTitle === MUNICIPALITY_NAME ? getLatestAbsenceSchoolRows(latest.schoolYear) : getLatestAbsenceGradeRows(entityTitle, latest.schoolYear);
  const comparisonTitle = entityTitle === MUNICIPALITY_NAME ? "Jämförelse mellan skolor" : "Årskurser på skolan";
  const isMunicipality = entityTitle === MUNICIPALITY_NAME;
  const maxOver15 = Math.max(...comparisonRows.map((row) => Number(row.over15)).filter(Number.isFinite));
  const maxOver30 = Math.max(...comparisonRows.map((row) => Number(row.over30)).filter(Number.isFinite));
  const maxUnauthorised = Math.max(...comparisonRows.map((row) => Number(row.unauthorisedOver5)).filter(Number.isFinite));

  return (
    <Card className="metric-card absence-risk-card">
      <CardContent className="metric-content">
        <div className="metric-heading">
          <div>
            <h3>{metric.order}. {metric.title} (%)</h3>
            {metric.description && <p className="metric-description">{metric.description}</p>}
            <p>{metric.source}</p>
          </div>
          <span>Lokal</span>
        </div>

        <div className="absence-summary">
          <AbsenceMiniKpi label="Total frånvaro" value={latest.totalAbsence} delta={getDelta(latest, previous, "totalAbsence")} />
          <AbsenceMiniKpi label="Över 15%" value={latest.over15} count={latest.over15Count} total={latest.studentCount} delta={getDelta(latest, previous, "over15")} />
          <AbsenceMiniKpi label="Över 30%" value={latest.over30} count={latest.over30Count} total={latest.studentCount} delta={getDelta(latest, previous, "over30")} />
          <AbsenceMiniKpi label="Ogiltig över 5%" value={latest.unauthorisedOver5} count={latest.unauthorisedOver5Count} total={latest.studentCount} delta={getDelta(latest, previous, "unauthorisedOver5")} />
        </div>

        <div className="absence-insight">{buildAbsenceInsight(latest, previous)}</div>

        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 12, right: 18, left: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#d9d9d9" />
            <XAxis dataKey="ar" tick={{ fontSize: 12, fill: "#000", fontWeight: 800 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#000", fontWeight: 800 }} tickFormatter={(value) => `${value}%`} domain={[0, "auto"]} tickLine={false} axisLine={false} />
            <Tooltip formatter={(value, name) => [`${compactNumber(value)}%`, name]} />
            <Legend wrapperStyle={{ fontSize: 12, fontWeight: 800 }} iconType="line" />
            <Line type="monotone" dataKey="totalAbsence" name="Total frånvaro" stroke="#006fae" strokeWidth={2.2} dot={{ r: 3 }} connectNulls />
            <Line type="monotone" dataKey="over15" name="Över 15%" stroke="#d98512" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line type="monotone" dataKey="over30" name="Över 30%" stroke="#bd4f5b" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line type="monotone" dataKey="unauthorisedOver5" name="Ogiltig över 5%" stroke="#008c7a" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            {data.some((item) => Number.isFinite(Number(item.municipalityValue))) && entityTitle !== MUNICIPALITY_NAME && (
              <Line type="monotone" dataKey="municipalityValue" name="Kommun total" stroke="#0f172a" strokeWidth={1.8} strokeDasharray="5 5" dot={{ r: 2 }} connectNulls />
            )}
          </LineChart>
        </ResponsiveContainer>

        {comparisonRows.length > 0 && (
          <div className="absence-table-wrap">
            <h4>{comparisonTitle}</h4>
            <table className="absence-table">
              <thead>
                <tr>
                  <th>{isMunicipality ? "Skola" : "Åk"}</th>
                  <th>Elever</th>
                  <th>Total</th>
                  <th>Över 15%</th>
                  <th>Över 30%</th>
                  <th>Ogiltig &gt;5%</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={`${row.schoolYear}-${row.schoolName || row.grade}`}>
                    <td>{isMunicipality ? row.schoolName : row.grade}</td>
                    <td>{formatCount(row.studentCount)}</td>
                    <td>{formatPct(row.totalAbsence)}</td>
                    <td className={row.over15 === maxOver15 ? "table-flag" : ""}>{formatPct(row.over15)}</td>
                    <td className={row.over30 === maxOver30 ? "table-flag" : ""}>{formatPct(row.over30)}</td>
                    <td className={row.unauthorisedOver5 === maxUnauthorised ? "table-flag" : ""}>{formatPct(row.unauthorisedOver5)}</td>
                    <td><span className={`risk-pill risk-${row.riskLevel || "unknown"}`}>{riskLabel(row.riskLevel)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const RELATED_ABSENCE_METRICS = {
  "F-6": ["staffAbsence", "studentsPerTeacher", "schoolSurvey5", "nationalTests3", "knowledge6"],
  "7-9": ["staffAbsence", "studentsPerTeacher", "schoolSurvey8", "meritValue", "gymEligibility", "salsaMerit"],
  "F-9": ["staffAbsence", "studentsPerTeacher", "schoolSurvey8", "nationalTests3", "meritValue", "gymEligibility"],
};

const RELATED_ABSENCE_REASON = {
  staffAbsence: "Kontinuitet och bemanning",
  studentsPerTeacher: "Organisations- och resurskontext",
  schoolSurvey5: "Trygghet, stöd och studiero",
  schoolSurvey8: "Trygghet, stöd och studiero",
  nationalTests3: "Tidiga kunskapsresultat",
  knowledge6: "Måluppfyllelse i mellanstadiet",
  meritValue: "Resultat vid läsårets slut",
  gymEligibility: "Behörighet och övergång",
  salsaMerit: "Resultat i relation till elevsammansättning",
};

function latestSeriesItem(items = [], metric) {
  if (!items.length) return null;
  if (!metric.series) return [...items].reverse().find((item) => Number.isFinite(Number(item.value))) || null;
  return [...items].reverse().find((item) => metric.series.some((series) => Number.isFinite(Number(item[series.key])))) || null;
}

function formatRelatedValue(item, metric) {
  if (!item) return "–";
  if (!metric.series) return `${compactNumber(item.value)} ${metric.unit}`;
  const parts = metric.series
    .filter((series) => Number.isFinite(Number(item[series.key])))
    .slice(0, 2)
    .map((series) => `${series.label}: ${compactNumber(item[series.key])}`);
  return parts.length ? `${parts.join(" · ")} ${metric.unit}` : "–";
}

function RelatedAbsenceKpiCard({ selected, series }) {
  if (selected.type !== "school") return null;
  const stage = getEntityStage(selected);
  const metricKeys = RELATED_ABSENCE_METRICS[stage] || RELATED_ABSENCE_METRICS["F-6"];
  const items = metricKeys
    .map((key) => {
      const metric = KPI_CATALOG.find((candidate) => candidate.key === key);
      if (!metric || !isMetricVisibleForEntity(metric, selected)) return null;
      const latest = latestSeriesItem(series[key] || [], metric);
      return { metric, latest };
    })
    .filter(Boolean);
  if (!items.length) return null;

  return (
    <Card className="metric-card related-kpi-card">
      <CardContent className="metric-content">
        <div className="metric-heading">
          <div>
            <h3>Analysera tillsammans med</h3>
            <p className="metric-description">Frånvaro är lokal läsårsdata. Angränsande Kolada- och lokala mått visas med sina egna rapporteringsperioder och ska användas som analyskontext.</p>
          </div>
          <span>Analysstöd</span>
        </div>
        <div className="related-kpi-grid">
          {items.map(({ metric, latest }) => (
            <div className="related-kpi-item" key={metric.key}>
              <span>{getMetricPeriodNote(metric, latest?.year)}</span>
              <strong>{metric.title}</strong>
              <p>{formatRelatedValue(latest, metric)}</p>
              <small>{RELATED_ABSENCE_REASON[metric.key] || "Angränsande kvalitetsmått"}</small>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function getAbsenceDialogueItems(selected, absenceSeries = []) {
  if (selected.type !== "school") return [];
  const latest = [...absenceSeries].reverse().find((item) => Number.isFinite(Number(item.value)));
  const gradeRows = getLatestAbsenceGradeRows(selected.title, latest?.schoolYear);
  const highestOver15 = [...gradeRows].sort((a, b) => Number(b.over15 || 0) - Number(a.over15 || 0))[0];
  const highestUnauthorised = [...gradeRows].sort((a, b) => Number(b.unauthorisedOver5 || 0) - Number(a.unauthorisedOver5 || 0))[0];
  const items = [
    highestOver15 ? `Börja analysen i årskurs ${highestOver15.grade}: högst andel riskfrånvaro över 15% (${formatPct(highestOver15.over15)}).` : "Identifiera vilken årskurs som driver riskfrånvaron.",
    highestUnauthorised ? `Följ ogiltig frånvaro i årskurs ${highestUnauthorised.grade}: ${formatPct(highestUnauthorised.unauthorisedOver5)} över 5%.` : "Särskilj total frånvaro från ogiltig frånvaro i analysen.",
    latest?.municipalityValue ? `Jämför skolans totalfrånvaro (${formatPct(latest.totalAbsence)}) med kommunens nivå (${formatPct(latest.municipalityValue)}) för samma läsår.` : "Jämför skolans utveckling med kommunens läsårsbild där jämförbart värde finns.",
    "Pröva om mönstret syns även i resultat, trygghet/studiero, personalfrånvaro eller resursmått innan åtgärder prioriteras.",
  ];
  return items;
}

function QualityDialogueCard({ selected, series }) {
  if (selected.type !== "school") return null;
  const items = getAbsenceDialogueItems(selected, series.studentAbsence || []);
  return (
    <Card className="quality-dialogue-card">
      <CardContent className="metric-content">
        <div className="metric-heading">
          <div>
            <h3>Att ta med till kvalitetsdialogen</h3>
            <p className="metric-description">Frågor och signaler för läsårsbokslut, analys och prioriteringar inför nästa läsår.</p>
          </div>
          <span>Skolenhet</span>
        </div>
        <div className="dialogue-list">
          {items.map((item) => <p key={item}>{item}</p>)}
        </div>
      </CardContent>
    </Card>
  );
}

const SIGNAL_MATRIX_METRIC_KEYS = [
  "students",
  "teacherEligibility",
  "teacherPedagogicalDegree",
  "studentsPerTeacher",
  "knowledge6",
  "knowledge9",
  "meritValue",
  "gymEligibility",
  "schoolSurvey5",
  "schoolSurvey8",
];

function latestNumeric(items = [], key = "value") {
  return [...items].reverse().find((item) => Number.isFinite(Number(item?.[key]))) || null;
}

function previousNumeric(items = [], latest, key = "value") {
  if (!latest) return null;
  return [...items].reverse().find((item) => item.year < latest.year && Number.isFinite(Number(item?.[key]))) || null;
}

function numericDelta(current, previous, key = "value") {
  if (!Number.isFinite(Number(current?.[key])) || !Number.isFinite(Number(previous?.[key]))) return null;
  return Number((Number(current[key]) - Number(previous[key])).toFixed(1));
}

function trendText(delta, unit = "p.e.") {
  if (!Number.isFinite(Number(delta))) return "";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${compactNumber(delta)} ${unit} mot föregående`;
}

function classifyHigherIsRisk(value, { red, yellow }, delta = 0) {
  if (!Number.isFinite(Number(value))) return "gray";
  if (value >= red || delta > 2) return "red";
  if (value >= yellow || delta > 0.5) return "yellow";
  return "green";
}

function classifyLowerIsRisk(value, { red, yellow }, delta = 0) {
  if (!Number.isFinite(Number(value))) return "gray";
  if (value <= red || delta < -3) return "red";
  if (value <= yellow || delta < -1) return "yellow";
  return "green";
}

function classifyBudget(value, delta = 0) {
  if (!Number.isFinite(Number(value))) return "gray";
  if (value < -1000 || delta < -500) return "red";
  if (value < 0 || delta < 0) return "yellow";
  return "green";
}

function formatMatrixValue(value, unit = "%") {
  if (!Number.isFinite(Number(value))) return "–";
  return unit ? `${compactNumber(value)} ${unit}` : compactNumber(value);
}

function makeSignalCell({ value, unit = "%", status = "gray", period = "", sub = "", note = "", label = "", delta = null, lowerIsBetter = false }) {
  return { value, unit, status, period, sub, note, label, delta, lowerIsBetter };
}

function getHighestRiskGrade(title) {
  const rows = getLatestAbsenceGradeRows(title);
  if (!rows.length) return null;
  return [...rows].sort((a, b) => Number(b.over15 || 0) - Number(a.over15 || 0))[0];
}

async function buildSignalMatrixRows(schools) {
  const metricMap = new Map(KPI_CATALOG.map((metric) => [metric.key, metric]));
  const rows = [];

  for (const school of schools.filter((item) => item.type === "school")) {
    const stage = getEntityStage(school);
    const absenceRows = getStudentAbsenceKpiRows(school);
    const staffSeries = getStaffAbsenceSeries(school);
    const budgetSeries = getBudgetDeviationSeries(school);
    if (!absenceRows.length && !staffSeries.length && !budgetSeries.length) continue;
    const latestAbsence = latestNumeric(absenceRows, "totalAbsence");
    const previousAbsence = [...absenceRows].reverse().find((item) => item.year < latestAbsence?.year && Number.isFinite(Number(item.over15)));
    const riskDelta = getDelta(latestAbsence, previousAbsence, "over15");
    const unauthorisedDelta = getDelta(latestAbsence, previousAbsence, "unauthorisedOver5");
    const highestGrade = getHighestRiskGrade(school.title);
    const staff = latestNumeric(staffSeries);
    const staffDelta = numericDelta(staff, previousNumeric(staffSeries, staff));
    const budget = latestNumeric(budgetSeries, "totalt");
    const budgetDelta = numericDelta(budget, previousNumeric(budgetSeries, budget, "totalt"), "totalt");

    const loaded = {};
    for (const key of SIGNAL_MATRIX_METRIC_KEYS) {
      const metric = metricMap.get(key);
      if (!metric || !isMetricVisibleForEntity(metric, school)) continue;
      try {
        const kolada = metric.series ? await loadKoladaMultiSeries(metric, school) : await loadKoladaSeries(metric, school);
        loaded[key] = mergeLocalSeries(school, metric, kolada);
      } catch (error) {
        console.warn("Signal matrix KPI failed", key, school.title, error);
        loaded[key] = [];
      }
    }

    const students = latestNumeric(loaded.students || []);
    const studentsDelta = numericDelta(students, previousNumeric(loaded.students || [], students));
    const teacherEligibility = latestNumeric(loaded.teacherEligibility || []);
    const teacherEligibilityDelta = numericDelta(teacherEligibility, previousNumeric(loaded.teacherEligibility || [], teacherEligibility));
    const teacherPedagogicalDegree = latestNumeric(loaded.teacherPedagogicalDegree || []);
    const teacherPedagogicalDegreeDelta = numericDelta(teacherPedagogicalDegree, previousNumeric(loaded.teacherPedagogicalDegree || [], teacherPedagogicalDegree));
    const studentsPerTeacher = latestNumeric(loaded.studentsPerTeacher || []);
    const studentsPerTeacherDelta = numericDelta(studentsPerTeacher, previousNumeric(loaded.studentsPerTeacher || [], studentsPerTeacher));
    const knowledge6 = latestNumeric(loaded.knowledge6 || []);
    const knowledge9 = latestNumeric(loaded.knowledge9 || []);
    const meritValue = latestNumeric(loaded.meritValue || []);
    const gymEligibility = latestNumeric(loaded.gymEligibility || []);
    const surveyMetric = ["7-9", "F-9"].includes(stage) ? metricMap.get("schoolSurvey8") : metricMap.get("schoolSurvey5");
    const surveyLatest = latestSeriesItem(loaded[surveyMetric?.key] || [], surveyMetric || {});
    const surveyValues = surveyMetric?.series?.map((series) => Number(surveyLatest?.[series.key])).filter(Number.isFinite) || [];
    const surveyAverage = surveyValues.length ? Number((surveyValues.reduce((sum, value) => sum + value, 0) / surveyValues.length).toFixed(1)) : null;
    const surveyPrevious = previousNumeric(loaded[surveyMetric?.key] || [], surveyLatest);
    const surveyPreviousValues = surveyMetric?.series?.map((series) => Number(surveyPrevious?.[series.key])).filter(Number.isFinite) || [];
    const surveyPreviousAverage = surveyPreviousValues.length ? Number((surveyPreviousValues.reduce((sum, value) => sum + value, 0) / surveyPreviousValues.length).toFixed(1)) : null;
    const surveyDelta = Number.isFinite(surveyAverage) && Number.isFinite(surveyPreviousAverage) ? Number((surveyAverage - surveyPreviousAverage).toFixed(1)) : null;
    const surveyLabel = ["7-9", "F-9"].includes(stage) ? "Skolenkäten åk 8" : "Skolenkäten åk 5";

    const resultMetric = ["F-6", "F-9"].includes(stage) ? metricMap.get("knowledge6") : metricMap.get("gymEligibility");
    const resultItem = ["F-6", "F-9"].includes(stage) ? knowledge6 : gymEligibility;
    const resultValue = resultItem?.value;
    const resultSeries = (["F-6", "F-9"].includes(stage) ? loaded.knowledge6 : loaded.gymEligibility) || [];
    const resultDelta = numericDelta(resultItem, previousNumeric(resultSeries, resultItem));
    const resultLabel = ["F-6", "F-9"].includes(stage) ? "Åk 6 alla ämnen" : "Gymnasiebehörighet";

    const cells = {
      riskAbsence: makeSignalCell({
        value: latestAbsence?.over15,
        status: classifyHigherIsRisk(latestAbsence?.over15, { red: 18, yellow: 12 }, riskDelta || 0),
        period: latestAbsence ? `Läsår ${formatSchoolYear(latestAbsence.year)}` : "Period saknas",
        sub: trendText(riskDelta),
        note: "Riskfrånvaro >15%",
        delta: riskDelta,
        lowerIsBetter: true,
      }),
      unauthorised: makeSignalCell({
        value: latestAbsence?.unauthorisedOver5,
        status: classifyHigherIsRisk(latestAbsence?.unauthorisedOver5, { red: 8, yellow: 4 }, unauthorisedDelta || 0),
        period: latestAbsence ? `Läsår ${formatSchoolYear(latestAbsence.year)}` : "Period saknas",
        sub: [trendText(unauthorisedDelta), `${formatCount(latestAbsence?.unauthorisedOver5Count)} elever`].filter(Boolean).join(" · "),
        note: "Ogiltig frånvaro >5%",
        delta: unauthorisedDelta,
        lowerIsBetter: true,
      }),
      staff: makeSignalCell({
        value: staff?.value,
        status: classifyHigherIsRisk(staff?.value, { red: 8, yellow: 5.5 }, staffDelta || 0),
        period: staff ? `Kalenderår ${staff.year}` : "Period saknas",
        sub: trendText(staffDelta),
        note: "Personalfrånvaro",
        delta: staffDelta,
        lowerIsBetter: true,
      }),
      students: makeSignalCell({
        value: students?.value,
        unit: "elever",
        status: Number.isFinite(Number(students?.value)) ? "green" : "gray",
        period: students ? `Rapporterat år ${students.year}` : "Period saknas",
        sub: trendText(studentsDelta, "elever"),
        note: "Antal elever på skolenheten",
        delta: studentsDelta,
      }),
      teacherEligibility: makeSignalCell({
        value: teacherEligibility?.value,
        status: classifyLowerIsRisk(teacherEligibility?.value, { red: 70, yellow: 80 }, teacherEligibilityDelta || 0),
        period: teacherEligibility ? `Rapporterat år ${teacherEligibility.year}` : "Period saknas",
        sub: trendText(teacherEligibilityDelta),
        note: "Lärarlegitimation och behörighet",
        label: "Behöriga lärare",
        delta: teacherEligibilityDelta,
      }),
      teacherPedagogicalDegree: makeSignalCell({
        value: teacherPedagogicalDegree?.value,
        status: classifyLowerIsRisk(teacherPedagogicalDegree?.value, { red: 70, yellow: 80 }, teacherPedagogicalDegreeDelta || 0),
        period: teacherPedagogicalDegree ? `Rapporterat år ${teacherPedagogicalDegree.year}` : "Period saknas",
        sub: trendText(teacherPedagogicalDegreeDelta),
        note: "Lärare med pedagogisk högskoleexamen",
        label: "Ped. högskoleexamen",
        delta: teacherPedagogicalDegreeDelta,
      }),
      studentsPerTeacher: makeSignalCell({
        value: studentsPerTeacher?.value,
        unit: "antal",
        status: classifyHigherIsRisk(studentsPerTeacher?.value, { red: 15, yellow: 12 }, studentsPerTeacherDelta || 0),
        period: studentsPerTeacher ? `Rapporterat år ${studentsPerTeacher.year}` : "Period saknas",
        sub: trendText(studentsPerTeacherDelta, "elever/lärare"),
        note: "Elever/lärare",
        delta: studentsPerTeacherDelta,
        lowerIsBetter: true,
      }),
      budget: makeSignalCell({
        value: budget?.totalt,
        unit: "tkr",
        status: classifyBudget(budget?.totalt, budgetDelta || 0),
        period: budget ? `Kalenderår ${budget.year}` : "Period saknas",
        sub: trendText(budgetDelta, "tkr"),
        note: "Budgetavvikelse",
        delta: budgetDelta,
      }),
      survey: makeSignalCell({
        value: surveyAverage,
        unit: "index",
        status: classifyLowerIsRisk(surveyAverage, { red: 5.5, yellow: 6.5 }, surveyDelta || 0),
        period: surveyLatest ? `Enkätår ${surveyLatest.year}` : "Period saknas",
        sub: [surveyLabel, trendText(surveyDelta, "index")].filter(Boolean).join(" · "),
        note: surveyMetric?.title || "Skolenkät",
        label: surveyLabel,
        delta: surveyDelta,
      }),
      result: makeSignalCell({
        value: resultValue,
        status: classifyLowerIsRisk(resultValue, { red: 60, yellow: 70 }, resultDelta || 0),
        period: resultItem ? `Rapporterat år ${resultItem.year}` : "Period saknas",
        sub: [resultLabel, trendText(resultDelta)].filter(Boolean).join(" · "),
        note: resultMetric?.title || "Resultatsignal",
        label: resultLabel,
        delta: resultDelta,
      }),
    };

    const redCount = Object.values(cells).filter((cell) => cell.status === "red").length;
    const yellowCount = Object.values(cells).filter((cell) => cell.status === "yellow").length;
    const priority = redCount >= 2 || (cells.riskAbsence.status === "red" && cells.result.status === "red")
      ? "Prioritera analys"
      : redCount === 1 || yellowCount >= 3 ? "Bevaka" : "Stabil";

    rows.push({
      school,
      stage,
      highestGrade,
      cells,
      redCount,
      yellowCount,
      priority,
    });
  }

  return rows.sort((a, b) => b.redCount - a.redCount || b.yellowCount - a.yellowCount || a.school.title.localeCompare(b.school.title, "sv"));
}

function getTrendIndicator(cell) {
  const delta = Number(cell?.delta);
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.05) return null;
  const direction = delta > 0 ? "up" : "down";
  const isBetter = cell.lowerIsBetter ? delta < 0 : delta > 0;
  return {
    arrow: delta > 0 ? "↑" : "↓",
    className: `trend-arrow trend-${direction} ${isBetter ? "trend-good" : "trend-bad"}`,
    label: isBetter ? "Förbättring" : "Försämring",
  };
}

function SignalCell({ cell }) {
  const trend = getTrendIndicator(cell);
  return (
    <td className={`signal-cell signal-${cell.status}`} title={`${cell.note}. ${cell.period}`}>
      <strong>
        {formatMatrixValue(cell.value, cell.unit)}
        {trend && <span className={trend.className} aria-label={trend.label} title={trend.label}>{trend.arrow}</span>}
      </strong>
      {cell.label && <em>{cell.label}</em>}
      <span>{cell.period}</span>
      {cell.sub && <small>{cell.sub}</small>}
    </td>
  );
}

function averageCellValue(rows, key) {
  const values = rows.map((row) => Number(row.cells?.[key]?.value)).filter(Number.isFinite);
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

function SignalMatrixPage({ rows, loading }) {
  const schoolsWithRed = rows.filter((row) => row.redCount > 0).length;
  const highAbsence = rows.filter((row) => row.cells.riskAbsence.status === "red").length;
  const combinedRisk = rows.filter((row) => row.cells.riskAbsence.status === "red" && row.cells.result.status === "red").length;
  const latestAbsenceYear = rows.map((row) => getStudentAbsenceKpiRows(row.school).at(-1)?.year).filter(Number.isFinite).sort().at(-1);
  const averageRiskAbsence = averageCellValue(rows, "riskAbsence");
  const averageStaff = averageCellValue(rows, "staff");
  const averageTeacherEligibility = averageCellValue(rows, "teacherEligibility");
  const averageTeacherDegree = averageCellValue(rows, "teacherPedagogicalDegree");
  const averageResult = averageCellValue(rows, "result");

  return (
    <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="report-page signal-page">
      <header className="report-header">
        <div className="report-header-grid">
          <div>
            <p className="level-label">Huvudmannanivå</p>
            <h2>Signalmatris huvudman</h2>
            <p>Översikt för att hitta skolor där frånvaro, organisation, trygghet/studiero och resultat behöver analyseras tillsammans. Studiero/trygghet visar Skolenkäten åk 5 för F-6 och åk 8 för 7-9/F-9. Resultatsignal visar Åk 6 alla ämnen för F-6/F-9 och gymnasiebehörighet för 7-9. Perioder visas i varje cell eftersom lokala läsårsdata och Kolada-mått rapporteras vid olika tidpunkter.</p>
          </div>
          <div className="index-box">
            <p>Frånvaroperiod</p>
            <strong>{latestAbsenceYear ? formatSchoolYear(latestAbsenceYear) : "–"}</strong>
          </div>
        </div>
      </header>

      <div className="signal-summary">
        <div><span>Skolor med röd signal</span><strong>{schoolsWithRed}</strong></div>
        <div><span>Röd riskfrånvaro</span><strong>{highAbsence}</strong></div>
        <div><span>Frånvaro + resultat</span><strong>{combinedRisk}</strong></div>
        <div><span>Skolor i matrisen</span><strong>{rows.length}</strong></div>
      </div>

      <div className="signal-comparison">
        <div><span>Snitt riskfrånvaro</span><strong>{formatPct(averageRiskAbsence)}</strong></div>
        <div><span>Snitt personalfrånvaro</span><strong>{formatPct(averageStaff)}</strong></div>
        <div><span>Snitt behöriga lärare</span><strong>{formatPct(averageTeacherEligibility)}</strong></div>
        <div><span>Snitt ped. examen</span><strong>{formatPct(averageTeacherDegree)}</strong></div>
        <div><span>Snitt resultatsignal</span><strong>{formatPct(averageResult)}</strong></div>
      </div>

      {loading && <div className="empty-chart">Laddar signalmatris ...</div>}
      {!loading && (
        <div className="signal-table-wrap">
          <table className="signal-table">
            <thead>
              <tr>
                <th>Skola</th>
                <th>Stadie</th>
                <th>Högsta riskårskurs</th>
                <th>Riskfrånvaro &gt;15%</th>
                <th>Ogiltig &gt;5%</th>
                <th>Personal</th>
                <th>Antal elever</th>
                <th>Behörighet<br /><span>Lärare</span></th>
                <th>Ped. examen<br /><span>Lärare</span></th>
                <th>Elever/lärare</th>
                <th>Budget</th>
                <th>Studiero/trygghet<br /><span>Skolenkäten åk 5 eller 8</span></th>
                <th>Resultatsignal<br /><span>Åk 6 eller åk 9</span></th>
                <th>Samlad signal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.school.id || row.school.title}>
                  <th className="signal-school">{row.school.title}</th>
                  <td>{row.stage}</td>
                  <td>{row.highestGrade ? `Åk ${row.highestGrade.grade} · ${formatPct(row.highestGrade.over15)}` : "–"}</td>
                  <SignalCell cell={row.cells.riskAbsence} />
                  <SignalCell cell={row.cells.unauthorised} />
                  <SignalCell cell={row.cells.staff} />
                  <SignalCell cell={row.cells.students} />
                  <SignalCell cell={row.cells.teacherEligibility} />
                  <SignalCell cell={row.cells.teacherPedagogicalDegree} />
                  <SignalCell cell={row.cells.studentsPerTeacher} />
                  <SignalCell cell={row.cells.budget} />
                  <SignalCell cell={row.cells.survey} />
                  <SignalCell cell={row.cells.result} />
                  <td><span className={`priority-pill priority-${row.priority === "Prioritera analys" ? "red" : row.priority === "Bevaka" ? "yellow" : "green"}`}>{row.priority}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Card className="quality-dialogue-card">
        <CardContent className="metric-content">
          <div className="metric-heading">
            <div>
              <h3>Frågor för huvudmannens kvalitetsdialog</h3>
              <p className="metric-description">Använd matrisen för att prioritera dialog, inte som ranking av skolor.</p>
            </div>
            <span>Huvudman</span>
          </div>
          <div className="dialogue-list">
            <p>Vilka skolor har både röd frånvarosignal och röd resultatsignal?</p>
            <p>Finns samma årskursmönster i flera skolor eller är signalen skolspecifik?</p>
            <p>Sammanfaller frånvaro med personalfrånvaro, resursmått eller budgetavvikelse?</p>
            <p>Vilka skolor behöver riktat stöd och vilka behöver fortsatt uppföljning?</p>
          </div>
        </CardContent>
      </Card>
    </motion.main>
  );
}

function combineSalsaData(meritSeries = [], salsaMeritSeries = [], salsaEligibilitySeries = []) {
  const byYear = new Map();
  for (const item of meritSeries) {
    if (!Number.isFinite(Number(item.value))) continue;
    byYear.set(item.year, {
      ...(byYear.get(item.year) || { year: item.year }),
      meritValue: item.value,
      municipalityValue: item.municipalityValue,
      riketValue: item.riketValue,
      similarValue: item.similarValue,
    });
  }
  for (const item of salsaMeritSeries) {
    if (!Number.isFinite(Number(item.value))) continue;
    const existing = byYear.get(item.year) || { year: item.year };
    existing.salsaMerit = item.value;
    existing.expectedMeritValue = Number((Number(existing.meritValue) - Number(item.value)).toFixed(1));
    byYear.set(item.year, existing);
  }
  for (const item of salsaEligibilitySeries) {
    if (!Number.isFinite(Number(item.value))) continue;
    const existing = byYear.get(item.year) || { year: item.year };
    existing.salsaEligibility = item.value;
    byYear.set(item.year, existing);
  }
  return Array.from(byYear.values())
    .filter((item) => Number.isFinite(Number(item.meritValue)) || Number.isFinite(Number(item.salsaMerit)) || Number.isFinite(Number(item.salsaEligibility)))
    .sort((a, b) => a.year - b.year)
    .map((item) => ({ ...item, år: formatMetricYear(item.year, { period: "calendarYear" }) }));
}

function SalsaAnalysisCard({ meritSeries, salsaMeritSeries, salsaEligibilitySeries }) {
  const data = combineSalsaData(meritSeries, salsaMeritSeries, salsaEligibilitySeries);
  if (!data.length) return null;
  const latest = [...data].reverse().find((item) => Number.isFinite(Number(item.salsaMerit)) || Number.isFinite(Number(item.salsaEligibility)));
  const latestMeritText = Number.isFinite(Number(latest?.salsaMerit))
    ? `Meritvärdet ligger ${Math.abs(latest.salsaMerit).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} poäng ${latest.salsaMerit >= 0 ? "över" : "under"} förväntat värde.`
    : "Meritvärdets avvikelse saknas för senaste år.";
  const latestEligibilityText = Number.isFinite(Number(latest?.salsaEligibility))
    ? `Resultatavvikelsen är ${latest.salsaEligibility.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} procentenheter.`
    : "Resultatavvikelse saknas för senaste år.";

  return (
    <Card className="metric-card salsa-card">
      <CardContent className="metric-content">
        <div className="metric-heading">
          <div>
            <h3>21-22. SALSA i relation till meritvärde</h3>
            <p className="metric-description">SALSA jämför skolans faktiska resultat med ett förväntat värde utifrån elevsammansättning. Positiv avvikelse betyder resultat över modellens förväntan.</p>
            <p>Kolada: KPI 19, 21 och 22. Meritvärde jämförs med kommun, riket och liknande kommuner där data finns.</p>
          </div>
          <span>Kolada</span>
        </div>
        <div className="salsa-summary">
          <strong>{latest?.year ?? "–"}</strong>
          <span>{latestMeritText}</span>
          <span>{latestEligibilityText}</span>
        </div>
        <div className="salsa-charts">
          <div>
            <p>Meritvärde åk 9</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data} margin={{ top: 12, right: 18, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#d9d9d9" />
                <XAxis dataKey="år" tick={{ fontSize: 12, fill: "#000", fontWeight: 800 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#000", fontWeight: 800 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                <Tooltip formatter={(value, name) => [`${compactNumber(value)} poäng`, name]} />
                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 800 }} iconType="line" />
                <Line type="monotone" dataKey="meritValue" name="Faktiskt meritvärde" stroke="#14b8a6" strokeWidth={2.2} dot={{ r: 3 }} connectNulls />
                <Line type="monotone" dataKey="expectedMeritValue" name="Förväntat meritvärde" stroke="#f97316" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} connectNulls />
                {data.some((item) => Number.isFinite(Number(item.municipalityValue))) && (
                  <Line type="monotone" dataKey="municipalityValue" name="Kommun" stroke="#0f172a" strokeWidth={1.8} strokeDasharray="3 4" dot={{ r: 2 }} connectNulls />
                )}
                {data.some((item) => Number.isFinite(Number(item.riketValue))) && (
                  <Line type="monotone" dataKey="riketValue" name="Riket" stroke="#64748b" strokeWidth={1.8} dot={{ r: 2 }} connectNulls />
                )}
                {data.some((item) => Number.isFinite(Number(item.similarValue))) && (
                  <Line type="monotone" dataKey="similarValue" name="Liknande kommuner" stroke="#2563eb" strokeWidth={1.8} strokeDasharray="3 4" dot={{ r: 2 }} connectNulls />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p>Avvikelse från förväntat</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data} margin={{ top: 12, right: 18, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#d9d9d9" />
                <XAxis dataKey="år" tick={{ fontSize: 12, fill: "#000", fontWeight: 800 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#000", fontWeight: 800 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                <Tooltip formatter={(value, name) => [`${compactNumber(value)} ${name === "Meritvärde" ? "poäng" : "procentenheter"}`, name]} />
                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 800 }} iconType="rect" />
                <Bar dataKey="salsaMerit" name="Meritvärde" fill="#14b8a6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="salsaEligibility" name="Resultat" fill="#f97316" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
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
  const [activeView, setActiveView] = useState("quality");
  const [series, setSeries] = useState({});
  const [signalRows, setSignalRows] = useState([]);
  const [signalLoading, setSignalLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Inte synkad ännu");
  const pageRef = useRef(null);
  const syncRunRef = useRef(0);

  const entities = useMemo(() => [{ type: "municipality", id: MUNICIPALITY_ID, title: MUNICIPALITY_NAME, grades: "Huvudman", stage: "F-9" }, ...schools], [schools]);
  const visibleMetrics = useMemo(() => KPI_CATALOG.filter((m) => isMetricVisibleForEntity(m, selected)), [selected]);
  const outcomeMetrics = useMemo(() => visibleMetrics.filter((metric) => metric.category === "utfall"), [visibleMetrics]);
  const metricsBySection = useMemo(() => {
    const grouped = new Map(SECTION_DEFINITIONS.map((section) => [section.key, []]));
    for (const metric of visibleMetrics) {
      if (SALSA_ANALYSIS_KEYS.has(metric.key)) continue;
      const section = getMetricSection(metric);
      grouped.set(section, [...(grouped.get(section) || []), metric]);
    }
    return grouped;
  }, [visibleMetrics]);
  const showSalsaAnalysis = selected.type === "school" && ["7-9", "F-9"].includes(getEntityStage(selected));

  async function sync() {
    const runId = syncRunRef.current + 1;
    syncRunRef.current = runId;
    setLoading(true);
    setSeries({});
    setStatus("Hämtar skolenheter och Kolada-data ...");
    const loadedSchools = await loadSchools();
    if (runId !== syncRunRef.current) return;
    setSchools(loadedSchools);
    setSignalLoading(true);
    buildSignalMatrixRows(loadedSchools)
      .then(setSignalRows)
      .catch((error) => {
        console.warn("Signal matrix failed", error);
        setSignalRows([]);
      })
      .finally(() => setSignalLoading(false));
    const currentEntity = selected.type === "municipality" ? selected : loadedSchools.find((s) => s.title === selected.title) || loadedSchools[0];
    const next = {};
    for (const metric of KPI_CATALOG) {
      if (runId !== syncRunRef.current) return;
      if (!isMetricVisibleForEntity(metric, currentEntity)) continue;
      const koladaSeries = metric.series ? await loadKoladaMultiSeries(metric, currentEntity) : await loadKoladaSeries(metric, currentEntity);
      next[metric.key] = await addComparisons(metric, currentEntity, mergeLocalSeries(currentEntity, metric, koladaSeries));
    }
    if (runId !== syncRunRef.current) return;
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
          <div className="view-tabs">
            <button onClick={() => setActiveView("quality")} className={activeView === "quality" ? "active" : ""}><School />Kvalitet per enhet</button>
            <button onClick={() => setActiveView("signals")} className={activeView === "signals" ? "active" : ""}><Building2 />Signalmatris huvudman</button>
          </div>
          {activeView === "quality" && (
            <div className="entity-tabs">
              {entities.map((entity) => (
                <button key={`${entity.type}-${entity.id}`} onClick={() => setSelected(entity)} className={selected.title === entity.title ? "active" : ""}>
                  {entity.type === "municipality" ? <Building2 /> : <School />}{entity.title}
                </button>
              ))}
            </div>
          )}
          <p className="status">{status}</p>
        </div>

        {activeView === "quality" && <SourcesPanel metrics={visibleMetrics} />}

        {activeView === "signals" ? (
          <SignalMatrixPage rows={signalRows} loading={signalLoading} />
        ) : (
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

          {SECTION_DEFINITIONS.map((section, index) => {
            const metrics = metricsBySection.get(section.key) || [];
            const showSalsaInSection = section.key === "upper" && showSalsaAnalysis;
            if (!metrics.length && !showSalsaInSection) return null;
            return (
              <React.Fragment key={section.key}>
                <div className={`section-divider ${index > 0 ? "page-break" : ""}`}>
                  <div /><p>{section.title}</p><div />
                </div>
                <section className="metric-grid">
                  {metrics.map((metric) => (
                    <React.Fragment key={`${selected.type}-${selected.id || selected.title}-${metric.key}`}>
                      <MetricCard metric={metric} data={getMetricRenderData(metric, selected, series)} entityTitle={selected.title} />
                      {metric.key === "studentAbsence" && <RelatedAbsenceKpiCard selected={selected} series={series} />}
                    </React.Fragment>
                  ))}
                  {showSalsaInSection && (
                    <SalsaAnalysisCard
                      meritSeries={series.meritValue || []}
                      salsaMeritSeries={series.salsaMerit || []}
                      salsaEligibilitySeries={series.salsaEligibility || []}
                    />
                  )}
                </section>
              </React.Fragment>
            );
          })}

          <QualityDialogueCard selected={selected} series={series} />

          <footer className="report-footer">
            <p>Dataprinciper</p>
            <span>Kolada prioriteras för officiella nyckeltal. Lokal komplettering används för ekonomi, personalfrånvaro, elevfrånvaro, trivsel och de resultatmått där skolenhetsdata inte finns eller behöver brytas ned. Värden med färre än fem elever/personer ska döljas före publicering.</span>
          </footer>
        </motion.main>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<SavsjoQualityDashboard />);
