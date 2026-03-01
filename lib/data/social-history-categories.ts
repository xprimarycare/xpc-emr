export interface SocialHistoryCategory {
  /** LOINC code for this category */
  code: string;
  /** Human-readable display name (e.g. "Tobacco Use") */
  display: string;
  /** LOINC system URL */
  system: string;
  /**
   * Keyword patterns for client-side classification.
   * Strings matched case-insensitively via includes(); RegExp via .test().
   */
  keywords: (string | RegExp)[];
}

export const LOINC_SYSTEM = "http://loinc.org";

export const SOCIAL_HISTORY_CATEGORIES: SocialHistoryCategory[] = [
  {
    code: "72166-2",
    display: "Tobacco Use",
    system: LOINC_SYSTEM,
    keywords: [
      "tobacco", "smoker", "smoking", "cigarette", "cigar", "vape",
      "vaping", "nicotine", "hookah", "chew", "snuff", "e-cigarette",
      /\b(never|former|current|ex)\s*smok/,
      /\bpack\s*(year|day)/,
      /\bppd\b/,
      /\bpk\s*yr/,
    ],
  },
  {
    code: "11331-6",
    display: "Alcohol Use",
    system: LOINC_SYSTEM,
    keywords: [
      "alcohol", "drinker", "drinking", "beer", "wine", "liquor",
      "spirits", "sober", "sobriety",
      /\bsocial\s+drink/,
      /\bheavy\s+drink/,
      /\boccasional\s+drink/,
      /\bdrinks?\s+per\s+(week|day|month)/,
    ],
  },
  {
    code: "74204-9",
    display: "Drug Use",
    system: LOINC_SYSTEM,
    keywords: [
      "drug use", "drug abuse", "marijuana", "cannabis", "cocaine",
      "heroin", "opioid", "methamphetamine", "intravenous drug",
      "illicit", "recreational drug", "substance abuse",
      /\bivd[ua]\b/,
    ],
  },
  {
    code: "11341-5",
    display: "Occupation",
    system: LOINC_SYSTEM,
    keywords: [
      "occupation", "employed", "unemployed", "retired",
      "self-employed", "disability", "disabled", "homemaker",
      /\b(teacher|nurse|doctor|engineer|lawyer|driver|farmer|mechanic|preacher|pastor|minister|accountant|chef|artist|writer|carpenter|electrician|plumber|firefighter|paramedic|dentist|pharmacist|therapist|social worker|janitor|clerk|manager|developer|programmer|pilot|soldier|veteran)\b/,
    ],
  },
  {
    code: "82589-3",
    display: "Education Level",
    system: LOINC_SYSTEM,
    keywords: [
      "education", "degree", "diploma", "college", "university",
      "high school", "ged", "graduate", "bachelor", "master",
      "doctorate", "phd", "associate degree",
      /\b(some\s+college|no\s+formal\s+education)\b/,
    ],
  },
  {
    code: "77593-4",
    display: "Exercise",
    system: LOINC_SYSTEM,
    keywords: [
      "exercise", "physical activity", "workout", "gym", "jogging",
      "running", "walking", "swimming", "cycling", "yoga",
      "sedentary", "active lifestyle", "fitness",
    ],
  },
  {
    code: "86648-3",
    display: "Sexual Activity",
    system: LOINC_SYSTEM,
    keywords: [
      "sexual", "sexually active", "abstinent", "contraception",
      "condom", "birth control",
      /\bsexually\s+transmitted/,
    ],
  },
  {
    code: "45404-1",
    display: "Marital Status",
    system: LOINC_SYSTEM,
    keywords: [
      "married", "single", "divorced", "widowed", "separated",
      "domestic partner", "civil union", "marital",
      /\b(never\s+married|living\s+together)\b/,
    ],
  },
  {
    code: "71802-3",
    display: "Housing",
    system: LOINC_SYSTEM,
    keywords: [
      "housing", "homeless", "shelter", "living alone",
      "lives with", "living with", "assisted living",
      "nursing home", "group home",
    ],
  },
  {
    code: "81663-7",
    display: "Diet/Nutrition",
    system: LOINC_SYSTEM,
    keywords: [
      "diet", "nutrition", "vegetarian", "vegan", "gluten-free",
      "keto", "low-sodium", "low-fat", "eating habits",
    ],
  },
  {
    code: "8691-8",
    display: "Travel History",
    system: LOINC_SYSTEM,
    keywords: [
      "travel", "traveled", "travelled", "abroad",
      "international", "overseas",
      /\brecent\s+travel/,
    ],
  },
  {
    code: "76542-2",
    display: "Stress",
    system: LOINC_SYSTEM,
    keywords: [
      "stress", "anxiety", "depression", "mental health",
      "coping", "burnout", "overwhelmed", "therapy",
      "counseling",
    ],
  },
];
