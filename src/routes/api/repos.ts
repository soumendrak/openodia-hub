import { createFileRoute } from "@tanstack/react-router";
import { fetchWithTimeout } from "../../lib/fetch-utils";

type Repo = {
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
  topics?: string[];
};

// No orgs or users are auto-fetched — every repo on the site is individually
// curated to ensure only Odia-language projects are listed.
const ORGS: string[] = [];
const USERS: string[] = [];

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
  "SantoshNayak/Odia_Calendar",
  "SantoshNayak/Odia-Month",
  "gyan111/gyan111.github.io",
  "gyan111/twinkle-orwiki",
  "odiaorg/purnachandraBhasakosha",
  "odiaorg/odiaDictColln",
  "shrixtacy/Subhadra-AI",
  "HimanshuMohanty-Git24/OdiaLingua",
  "HimanshuMohanty-Git24/Odia_Lingua",
  "HimanshuMohanty-Git24/MoBusMCP",
  "GnsP/odia-keyboard",
  "sushantamishra79/Odia-TTS-Dataset",
  "mohitkdas/OdiaCalendarArchive",
  "mohitkdas/OdiaCalendarArchiveAdmin",
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
  "imsbg/number-increment",
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
  // ── Odia translation & dictionaries ──
  "ujjaldas1997/English_Odia-Translation",
  "shrivastava95/odia-dictionary",
  "Aishraj30/odia",
  "135462/Odia",
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

function buildResponse(body: unknown, status: number, cache = true) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, User-Agent",
  };
  if (cache) {
    headers["Cache-Control"] = "public, s-maxage=1800, stale-while-revalidate=86400";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export const Route = createFileRoute("/api/repos")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const pinnedResults = await Promise.all(PINNED_REPOS.map(fetchSingleRepo));
          const repos = pinnedResults
            .filter((r): r is Repo => r !== null && !r.fork && !r.archived)
            .sort((a, b) => b.stargazers_count - a.stargazers_count);

          return buildResponse({ repos }, 200);
        } catch (e) {
          console.error("repos error", e);
          return buildResponse({ repos: [] }, 200, false);
        }
      },
    },
  },
});
