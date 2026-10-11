// Shared types for the rules engine. The engine is pure: it takes answers and
// returns ids and numbers, never display text, so it can be tested without a
// screen and the same result renders in either language.

export type Lang = 'en' | 'es';
export type Bi = { en: string; es: string };
export type BiList = { en: string[]; es: string[] };

export const PNTS = 'pnts' as const;
export type Pnts = typeof PNTS;

export type YesNo = 'yes' | 'no' | 'unsure' | Pnts | null;
export type Freq = 'most' | 'some' | 'rarely' | Pnts | null;

export interface Answers {
  /** Call-911 signs (em_*). Separate from the symptom list so the red card can react. */
  emergencies: string[];
  /** Red-flag signs (sym_*), or an exclusive 'none' / 'pnts'. null = not answered. */
  symptoms: string[] | 'none' | Pnts | null;
  age: string | Pnts | null;
  sex: 'female' | 'male' | Pnts | null;
  gender: string | Pnts | null;
  famCancers: string[] | 'none' | 'unsure' | Pnts | null;
  famClose: YesNo;
  famYoung: YesNo;
  history: string[] | 'none' | Pnts | null;
  hpv: 'yes' | 'some' | 'no' | 'unsure' | Pnts | null;
  smoke: 'never' | 'former' | 'current' | Pnts | null;
  packsPerDay: number | Pnts | null;
  yearsSmoked: number | Pnts | null;
  quit: 'lt5' | '5to15' | 'gt15' | Pnts | null;
  alcohol: 'none' | 'le1' | '2to7' | '8to14' | '15plus' | Pnts | null;
  activity: 'lt60' | '60to149' | '150to299' | '300plus' | Pnts | null;
  heightFt: number | null;
  heightIn: number | null;
  weightLb: number | null;
  bodySkip: boolean;
  procMeat: Freq;
  redMeat: Freq;
  plants: Freq;
  radon: 'low' | 'fixed' | 'high' | 'never' | 'unsure' | Pnts | null;
  sun: 'always' | 'sometimes' | 'rarely' | Pnts | null;
}

export const emptyAnswers = (): Answers => ({
  emergencies: [],
  symptoms: null,
  age: null,
  sex: null,
  gender: null,
  famCancers: null,
  famClose: null,
  famYoung: null,
  history: null,
  hpv: null,
  smoke: null,
  packsPerDay: null,
  yearsSmoked: null,
  quit: null,
  alcohol: null,
  activity: null,
  heightFt: null,
  heightIn: null,
  weightLb: null,
  bodySkip: false,
  procMeat: null,
  redMeat: null,
  plants: null,
  radon: null,
  sun: null,
});

/** Day of week (0 = Monday) -> food id -> servings. */
export type FoodLog = Record<string, Record<string, number>>;

export type CancerKey =
  | 'colorectal' | 'breast' | 'cervical' | 'lung' | 'prostate' | 'skin'
  | 'liver' | 'pancreatic' | 'stomach' | 'bladder' | 'brain';
export type ClinicTest = 'mammogram' | 'colonoscopy' | 'fit' | 'ldct' | 'pap' | 'skin';
