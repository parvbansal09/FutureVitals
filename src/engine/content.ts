// Typed access to the content files in /content. Those JSON files are the
// single place clinical wording, rules parameters, links and the clinic list
// live, so a non-developer can edit them without touching this code.
import type { Bi, BiList, ClinicTest } from './types';

import metaJson from '../../content/meta.json';
import checkJson from '../../content/check.json';
import screeningJson from '../../content/screening.json';
import riskJson from '../../content/risk.json';
import compareJson from '../../content/compare.json';
import foodsJson from '../../content/foods.json';
import ingredientsJson from '../../content/ingredients.json';
import preventionJson from '../../content/prevention.json';
import learnJson from '../../content/learn.json';
import clinicsJson from '../../content/clinics.json';
import eventsJson from '../../content/events.json';
import vaZipsJson from '../../content/va-zips.json';

// ── meta ──────────────────────────────────────────────────────────────────
export interface Meta {
  appVersion: string;
  contentVersion: string;
  contentUpdated: string;
  clinicalReviewer: { name: string | null; credentials: string | null; reviewedOn: string | null };
  spanish: { status: 'draft' | 'reviewed'; reviewer: string | null; reviewedOn: string | null };
  feedbackEmail: string;
  guidelineOrgs: { name: string; url: string }[];
  productData: { name: string; url: string; license: string; licenseUrl: string };
  changelog: { date: string; en: string; es: string }[];
}
export const meta = metaJson as unknown as Meta;

// ── check options ─────────────────────────────────────────────────────────
export interface Option { id: string; en: string; es: string }
export interface AgeBand { id: string; lo: number; hi: number }
export interface SymptomOption extends Option { cancer: string | null }
export const check = checkJson as unknown as {
  emergencies: Option[];
  symptoms: SymptomOption[];
  ages: AgeBand[];
  sexes: Option[];
  genders: Option[];
  familyCancers: Option[];
  yesNo: Option[];
  history: Option[];
  hpvVaccine: Option[];
  smoke: Option[];
  packsPerDay: (Option & { value: number })[];
  quitYears: Option[];
  alcohol: (Option & { drinks: number })[];
  activity: Option[];
  frequency: Option[];
  plants: Option[];
  radon: Option[];
  sun: Option[];
};

// ── screening plan text ───────────────────────────────────────────────────
export interface Guideline { org: string; short: string; year: number; url: string }
export interface ScreeningItem {
  name: Bi;
  options: Record<string, Bi[]>;
  why: Record<string, Bi>;
  asks: Record<string, Bi[]>;
  sides?: { for: Bi; against: Bi };
}
export const screening = screeningJson as unknown as {
  guidelines: Record<string, Guideline>;
  items: Record<string, ScreeningItem>;
  symptoms: Record<string, { what: Bi; do: Bi }>;
};

// ── risk model parameters ─────────────────────────────────────────────────
export interface RiskFactorDef {
  id: string;
  kind: string;
  mod: boolean;
  src: string;
  [k: string]: unknown;
}
export interface RiskCancerDef {
  /** History answers for inherited gene changes that set this cancer's risk (brca, lynch, syndrome). */
  gene?: string[];
  factors?: RiskFactorDef[];
  /** A history answer that puts this cancer under watch, off the average scale (hepatitis, an abnormal Pap). */
  surveil?: string;
  src?: string;
}
export const risk = riskJson as unknown as {
  bands: { key: string; below: number | null }[];
  minCoverage: number;
  displayCap: number;
  sources: Record<string, { name: string; url: string }>;
  cancers: Record<string, RiskCancerDef>;
  labels: Record<'en' | 'es', Record<string, { label: string; why: string }>>;
};

// ── compare rows ──────────────────────────────────────────────────────────
export interface Action { type: 'tel' | 'url' | 'email' | 'route'; value: string; label?: Bi; id?: string }
export interface CompareRowDef {
  id: string;
  title: Bi;
  rec: Bi;
  source: { org: string; name: string; url: string };
  quote: string;
  quoteEs: string;
  quoteChecked: boolean;
  acts: Bi;
  firstStep: { text: Bi; actions: Action[] };
}
export const compare = compareJson as unknown as { rows: CompareRowDef[] };

// ── food diary ────────────────────────────────────────────────────────────
/** How strong the evidence is that something causes cancer: the ingredient grade's points. */
export type Evidence = 'iarc1' | 'iarc2A' | 'wcrf' | 'iarc2B' | 'weight' | 'limited';
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface FoodDef {
  id: string;
  group: 'limit' | 'choose';
  /** Foods to limit only: sets the grade shown when the food comes up in a search. */
  evidence?: Evidence;
  grams: number | null;
  name: Bi;
  examples: Bi;
  serving: Bi;
  level: Bi;
  cancers: BiList;
  source: { org: string; url: string };
}
export const foods = foodsJson as unknown as { minDays: number; servingGuide: Bi; foods: FoodDef[] };

// ── scanner rules ─────────────────────────────────────────────────────────
export interface IngredientRule {
  id: string;
  iarc?: '1' | '2A' | '2B';
  wcrf?: string;
  diary: string | null;
  label: Bi;
  classification: Bi;
  quote: string;
  quoteEs: string;
  quoteChecked: boolean;
  exposure: Bi;
  source: { org: string; name: string; url: string };
  words: string[];
  /** Words only count among the first three ingredients (a main ingredient, not a trace). */
  lead?: boolean;
  exclude?: string[];
  curingWords?: string[];
  tags?: string[];
}
export const ingredients = ingredientsJson as unknown as {
  thresholds: { freeSugarEnergyShare: number; sodiumMgPerKcal: number; source: { name: string; url: string } };
  grade: { points: Record<Evidence, number>; bands: [Grade, number][] };
  addedSugarWords: string[];
  addedSaltWords: string[];
  nova4Markers: string[];
  meatFreeTags: string[];
  hazards: IngredientRule[];
  protective: IngredientRule[];
  categoryGroups: Record<string, string[]>;
};

// ── prevention library ────────────────────────────────────────────────────
export interface PreventionEntry {
  id: string;
  icon: string;
  appliesIf: string;
  reviewed: string;
  title: Bi;
  body: Bi;
  quote: string;
  quoteEs: string;
  firstStep: Bi;
  source: { org: string; url: string };
  cancers: string[];
}
export interface CancerPage {
  id: string;
  screening: 'yes' | 'choice' | 'no';
  guideline: string;
  name: Bi;
  blurb: Bi;
  raises: BiList;
  change: BiList;
  signs: BiList;
  screeningText: Bi;
}
export const prevention = preventionJson as unknown as {
  staleAfterMonths: number;
  screening: { title: Bi; body: Bi };
  entries: PreventionEntry[];
  cancers: CancerPage[];
};

// ── learn library ─────────────────────────────────────────────────────────
export interface Chapter {
  id: string;
  kicker: Bi;
  title: Bi;
  blurb: Bi;
  minutes: number;
  visual: string;
  sections: { h: Bi; p: Bi }[];
  list?: BiList;
  ladder?: { s: Bi; d: Bi }[];
  stats?: { n: string; l: Bi }[];
  glossary?: { w: Bi; d: Bi }[];
  takeaway: Bi;
  source: { org: string; url: string };
}
export const learn = learnJson as unknown as {
  chapters: Chapter[];
  myths: { id: string; myth: Bi; fact: Bi }[];
  mythsSource: { org: string; url: string };
};

// ── clinics and events ────────────────────────────────────────────────────
export type ClinicType = 'massey' | 'fqhc' | 'free' | 'healthdept' | 'hospital' | 'cancer' | 'specialist' | 'resource';
export interface Clinic {
  id: string;
  name: string;
  type: ClinicType;
  nci: boolean;
  address: string;
  city: string;
  zip: string;
  lat: number;
  lng: number;
  phone: string;
  phoneNote?: Bi;
  website: string;
  tests: ClinicTest[];
  testsBasis?: string;
  cost: { uninsured: boolean | null; slidingScale: boolean | null; ewl: boolean | null; medicaid: boolean | null };
  costNote?: Bi;
  language: { spanish: boolean | null; interpreter: boolean | null };
  languageNote?: Bi;
  bus: boolean | null;
  hours: Bi | null;
  evening: boolean | null;
  weekend: boolean | null;
  referral: boolean | 'some' | null;
  referralNote?: Bi;
  bring?: Bi;
  verified: string;
  source: string;
}
export const clinics = clinicsJson as unknown as { version: string; staleAfterDays: number; sites: Clinic[] };

export interface ProgramContact { type: 'tel' | 'email' | 'url'; value: string; label?: Bi }
export interface MobileProgram {
  id: string;
  name: Bi;
  desc: Bi;
  areas: Bi;
  howTo: Bi;
  tests: ClinicTest[];
  contact: ProgramContact[];
  verified: string;
}
export interface ScreeningEvent {
  id: string;
  date: string;
  time?: Bi;
  title: Bi;
  place: string;
  address?: string;
  register: ProgramContact;
  tests: ClinicTest[];
}
export const events = eventsJson as unknown as { events: ScreeningEvent[]; programs: MobileProgram[] };

// ── Virginia ZIP centroids (Census) ───────────────────────────────────────
export const vaZips = vaZipsJson as unknown as { source: string; count: number; zips: Record<string, [number, number]> };

/** Picks the text for the current language from a bilingual pair. */
export const tx = (b: Bi | undefined | null, lang: 'en' | 'es'): string => (b ? b[lang] || b.en : '');
