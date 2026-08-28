/**
 * The curated GitHub repo list and its fetcher.
 *
 * Lives outside the route file so both `/api/repos` and the /tools route
 * loader (SSR) read the same data through the same cache.
 */
import { fetchWithTimeout, mapWithConcurrency } from "../fetch-utils";
import { cachedJson, UpstreamUnavailableError } from "./cache";

export type Repo = {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  updated_at: string;
  fork: boolean;
  archived: boolean;
  created_at: string;
  license?: { spdx_id?: string | null; name?: string | null } | null;
  topics?: string[];
};

// No orgs or users are auto-fetched — every repo on the site is individually
// curated to ensure only Odia-language projects are listed.
const PINNED_REPOS: string[] = [
  // ── soumendrak ──
  "soumendrak/aidaybbsr2025demo",
  "soumendrak/odia-2048",
  "soumendrak/openodia",
  // ── Individual high-value repos ──
  "goru001/nlp-for-odia",
  "sovopr/sovogpt",
  "jyotishankar04/odialang",
  "Deeptiman/Alphabet-Learning-Android-Application",
  "Deeptiman/php-dom-parser-translation-tool",
  "nsoum/odia-tex",
  "SantoshNayak/Odia-Calendar",
  "SantoshNayak/Odia-Month",
  "gyan111/gyan111.github.io",
  "gyan111/twinkle-orwiki",
  "odiaorg/purnachandraBhasakosha",
  "odiaorg/odiaDictColln",
  "shrixtacy/Subhadra-AI",
  "HimanshuMohanty-Git24/OdiaLingua",
  "GnsP/odia-keyboard",
  "sushantamishra79/Odia-TTS-Dataset",
  "mohitkdas/OdiaCalendarArchive",
  "RajeebLochan/Sweatable",
  "Sameetpatro/odlang",
  "OmmDevgoswami/SikshaSathi---Odia-Gen-AI-Hackathon",
  "biranchi2018/odia",
  // ── OCR, datasets & speech ──
  "Udayps2303/Line-Level-OCR-using-CNN-BiLSTM-CTC-loss",
  "sushantamishra79/Odia-TTS-Dataset1",
  "sushantamishra79/odia-audio-processor",
  "sushantamishra79/LLM-ODIA",
  "biranchikulesika/lipy",
  // ── imsbg — Odia educational apps ──
  "imsbg/odiabhasa",
  "imsbg/odia-bhasa",
  "imsbg/odiaapp",
  "imsbg/odiagames",
  "imsbg/odialipi",
  "imsbg/Ganita-Bingya-App",
  "imsbg/Atomic-Guru",
  // ── Odia time & educational tools ──
  "imsbg/oled-time",
  "imsbg/Ama-Ganita",
  // ── coldbreeze16 — fonts, IME, converter ──
  "coldbreeze16/Lekhani",
  "coldbreeze16/Kunji-Binyasa",
  "coldbreeze16/Meghaduta-Converter",
  // ── dmort27 — Odia NLP tools ──
  "dmort27/orimorph",
  "dmort27/odia-tools",
  "dmort27/odia-im",
  // ── shantipriyap — Odia-only repos (excluded non-Odia: Bengali_LLM, etc.) ──
  "shantipriyap/Odia-NLP-Resource-Catalog",
  "shantipriyap/BertOdia",
  "shantipriyap/Llama3_Odia",
  "shantipriyap/MDOLC",
  "shantipriyap/ODIAGEN_WAT2024",
  "shantipriyap/OdiEnCorp-1.0",
  "shantipriyap/Odia-Santali-Dialect-Detection-Dataset",
  "shantipriyap/Odia_Tokenizer",
  "shantipriyap/SiloNLP_WAT2022",
  "shantipriyap/hunyuan_odia_ocr",
  "shantipriyap/odia-ocr-internvl2",
  "shantipriyap/odia-ocr-qwen-finetuned",
  "shantipriyap/odia-ocr-qwen7b-v3",
  "shantipriyap/odia_asr",
  "shantipriyap/odia_nlp",
  "shantipriyap/wat2025",
  // ── NLP & ASR resources ──
  "ltrc/Odia-Sentiment-Analysis",
  "UniversalDependencies/UD_Odia-ODTB",
  "bikashkumars/rasa_core_nlu_oriya",
  "AUOrga/OriyaNLUandASRModel",
  "Sachin1724/Odia-TTS",
  // ── odisha-ml community ──
  "odisha-ml/Awesome-Odia-AI",
  "odisha-ml/OdiaInMLWeb",
  "odisha-ml/odisha-ml.github.io",
  "odisha-ml/website",
  "odisha-ml/SummerSchool2022",
  "odisha-ml/links",
  "odisha-ml/OdishaVox",
  // ── OdiaGenAI ──
  "OdiaGenAI/GenerativeAI_and_LLM_Odia",
  "OdiaGenAI/Olive_Odia_ASR",
  "OdiaGenAI/iwslt-odia-speech",
  // ── OdiaWikimedia ──
  "OdiaWikimedia/Odia_OT_Jagannatha",
  "OdiaWikimedia/Converter",
  "OdiaWikimedia/Kunji-Binyasa",
  "OdiaWikimedia/Wordlist",
  "OdiaWikimedia/odiawikimedia.github.io",
  "OdiaWikimedia/English-Odia",
  // ── OdiaNLP ──
  "OdiaNLP/NMT",
  "OdiaNLP/wikipedia-corpus",
  "OdiaNLP/SMT",
  "OdiaNLP/dictionary",
  "OdiaNLP/odianlp.github.io",
  "OdiaNLP/word-embeddings",
  "OdiaNLP/spelling-correction",
  "OdiaNLP/language-modeling",
  // ── Odia-Digital ──
  "Odia-Digital/odia-keyboard",
  "Odia-Digital/odia-editor",
  "Odia-Digital/odia-books",
  // ── ofdn (Odia-specific repos only) ──
  "ofdn/Chapakala",
  "ofdn/odia-wordlist-from-wikimedia-dump",
  "ofdn/typori",
  "ofdn/chapakhana",
  // ── Additional Odia fonts & typing tools ──
  "lecramyajiv/fonts-oriya-extra",
  "jhellingman/oriya-tex",
  "manojsahukar/TypeOdia",
  // ── Odia learning platforms ──
  "odiabhasa/odiabhasa.github.io",
  "OdiaLanguage/Learn-Odia-Language",
  "ramoh/oriya-vocab-builder",
  "sanchaya/odia",
  // ── Fonts & OS-level Odia support ──
  "notofonts/noto-sans-oriya",
  "notofonts/oriya",
  "silnrsi/font-japa-sans-oriya",
  "gooselinux/hunspell-or",
  "gooselinux/hyphen-or",
  "gooselinux/lohit-oriya-fonts",
  "lohit-fonts/lohit-odia-fonts",
  "nlci/orya-font-asika",
  "nlci/orya-font-sans",
  "nlci/orya-keybd-winscript",
  "pld-linux/aspell-or",
];

const TTL_MS = 30 * 60 * 1000;

const githubToken = process.env.GITHUB_TOKEN;
const GH_HEADERS = {
  "User-Agent": "openodia.com",
  Accept: "application/vnd.github+json",
  ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
};

async function fetchSingleRepo(ownerRepo: string): Promise<Repo | null> {
  try {
    const r = await fetchWithTimeout(`https://api.github.com/repos/${ownerRepo}`, {
      headers: GH_HEADERS,
    });
    if (!r.ok) return null;
    return (await r.json()) as Repo;
  } catch (err) {
    console.warn(`fetchSingleRepo ${ownerRepo}:`, err);
    return null;
  }
}

/**
 * ~150 GitHub calls on a cache miss, so this is always read through
 * `cachedJson`. Throws when *every* call failed: GitHub throttling us is not
 * the same as the directory being empty, and caching the empty version would
 * pin a blank directory in place for the whole TTL.
 */
export async function loadRepos(): Promise<Repo[]> {
  return cachedJson("repos", TTL_MS, async () => {
    // Bounded, not Promise.all: 150 simultaneous fetches saturate the socket
    // pool and the tail aborts on its own timeout.
    const results = await mapWithConcurrency(PINNED_REPOS, 12, fetchSingleRepo);
    const repos = results
      .filter((r): r is Repo => r !== null && !r.fork && !r.archived)
      .sort((a, b) => b.stargazers_count - a.stargazers_count);
    if (repos.length === 0) {
      throw new UpstreamUnavailableError("github_unavailable");
    }
    return repos;
  });
}
