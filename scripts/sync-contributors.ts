/**
 * Aggregates GitHub contributors across the OpenOdia curated repo list and
 * writes the result to Cloudflare Workers KV via the Cloudflare REST API.
 *
 * No orgs or users are auto-fetched — every repo in the list is individually
 * curated to ensure only Odia-language projects are included.
 *
 * Designed for GitHub Actions (see .github/workflows/sync-contributors.yml).
 * Runs outside the Worker so it isn't bound by the 50-subrequest free-tier cap.
 *
 * Required env:
 *   GITHUB_TOKEN                  GitHub PAT or workflow token (read:org, public_repo)
 *   CLOUDFLARE_ACCOUNT_ID         Cloudflare account ID
 *   CLOUDFLARE_API_TOKEN          API token with Workers KV Storage: Edit on the namespace
 *   CONTRIBUTORS_KV_NAMESPACE_ID  KV namespace ID from `wrangler kv namespace create`
 */

const CURATED_REPOS: string[] = [
  // ── soumendrak ──
  "soumendrak/aidaybbsr2025demo",
  "soumendrak/odia-2048",
  // ── Individual high-value repos ──
  "goru001/nlp-for-odia",
  "sovopr/sovogpt",
  "jyotishankar04/odialang",
  "Deeptiman/Alphabet-Learning-Android-Application",
  "Deeptiman/php-dom-parser-translation-tool",
  "nsoum/odia-tex",
  "SantoshNayak/Odia-Calendar",
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
  // ── imsbg — Odia educational apps ──
  "imsbg/odiabhasa",
  "imsbg/odia-bhasa",
  "imsbg/odiaapp",
  "imsbg/odiagames",
  "imsbg/odialipi",
  "imsbg/Ganita-Bingya-App",
  "imsbg/Atomic-Guru",
  // ── coldbreeze16 — fonts, IME, converter ──
  "coldbreeze16/Lekhani",
  "coldbreeze16/Kunji-Binyasa",
  "coldbreeze16/Meghaduta-Converter",
  // ── dmort27 — Odia NLP tools ──
  "dmort27/orimorph",
  "dmort27/odia-tools",
  "dmort27/odia-im",
  // ── shantipriyap — Odia-only repos ──
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
  // ── odisha-ml community ──
  "odisha-ml/Awesome-Odia-AI",
  "odisha-ml/OdiaInMLWeb",
  "odisha-ml/odisha-ml.github.io",
  "odisha-ml/website",
  "odisha-ml/SummerSchool2022",
  "odisha-ml/links",
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

const MIN_CONTRIBUTIONS = 10;
const KV_KEY = "contributors:v1";

type GitHubContributor = {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
};

type Contributor = GitHubContributor & { repos: string[] };

type Payload = {
  contributors: Contributor[];
  totalContributors: number;
  fetchedAt: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function ghHeaders(token: string): HeadersInit {
  return {
    "User-Agent": "openodia-contributors-sync",
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
  };
}

async function gh<T>(url: string, token: string): Promise<T | null> {
  const r = await fetch(url, { headers: ghHeaders(token) });
  if (!r.ok) {
    console.warn(`GitHub ${r.status} ${url}`);
    return null;
  }
  const text = await r.text();
  return text ? (JSON.parse(text) as T) : null;
}

async function fetchContributors(fullName: string, token: string): Promise<GitHubContributor[]> {
  const data = await gh<GitHubContributor[]>(
    `https://api.github.com/repos/${fullName}/contributors?per_page=30`,
    token,
  );
  return data ?? [];
}

async function aggregate(token: string): Promise<Payload> {
  const perRepo = await Promise.all(
    CURATED_REPOS.map(async (fullName) => ({
      repo: fullName.split("/")[1],
      contributors: await fetchContributors(fullName, token),
    })),
  );

  const map = new Map<string, Contributor>();
  for (const { repo, contributors } of perRepo) {
    for (const c of contributors) {
      const existing = map.get(c.login);
      if (existing) {
        existing.contributions += c.contributions;
        if (!existing.repos.includes(repo)) existing.repos.push(repo);
      } else {
        map.set(c.login, {
          login: c.login,
          avatar_url: c.avatar_url,
          html_url: c.html_url,
          contributions: c.contributions,
          repos: [repo],
        });
      }
    }
  }

  const contributors = Array.from(map.values())
    .filter((c) => c.contributions > MIN_CONTRIBUTIONS)
    .sort((a, b) => b.contributions - a.contributions);

  return {
    contributors,
    totalContributors: contributors.length,
    fetchedAt: new Date().toISOString(),
  };
}

async function writeToKv(payload: Payload): Promise<void> {
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = requireEnv("CLOUDFLARE_API_TOKEN");
  const namespaceId = requireEnv("CONTRIBUTORS_KV_NAMESPACE_ID");

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${KV_KEY}`;
  const r = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const body = await r.text();
    throw new Error(`KV PUT failed: ${r.status} ${body}`);
  }
}

async function main(): Promise<void> {
  const token = requireEnv("GITHUB_TOKEN");
  const payload = await aggregate(token);
  console.log(
    `Aggregated ${payload.totalContributors} contributors (>${MIN_CONTRIBUTIONS} contributions) from ${CURATED_REPOS.length} curated repos.`,
  );
  await writeToKv(payload);
  console.log(`Wrote KV key "${KV_KEY}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
