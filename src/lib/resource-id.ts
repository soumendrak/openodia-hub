/**
 * Stable identity for a catalog resource.
 *
 * Every entry in the directory is ultimately a GitHub repo, a Hugging Face
 * model, or a Hugging Face dataset — including most Awesome-Odia-AI rows,
 * which link to one of those. Deriving the id from the URL means a curated
 * entry and the repo it points at resolve to the same permalink instead of
 * being two unrelated cards.
 *
 * Entries that point somewhere else (an arXiv paper, a project homepage) have
 * no id and keep linking straight out.
 */

export type ResourceKind = "gh" | "model" | "dataset";

export type ResourceRef = {
  kind: ResourceKind;
  /** Upstream identifier, e.g. "OdiaGenAI/odia_llama2_7B". */
  id: string;
};

const HOSTS: Record<string, "github" | "huggingface"> = {
  "github.com": "github",
  "www.github.com": "github",
  "huggingface.co": "huggingface",
  "www.huggingface.co": "huggingface",
  "hf.co": "huggingface",
};

/** Sub-paths on huggingface.co that are not models. */
const HF_NON_MODEL = new Set(["spaces", "blog", "docs", "papers", "collections", "organizations"]);

export function refFromUrl(url: string): ResourceRef | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = HOSTS[parsed.host.toLowerCase()];
  if (!host) return null;

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  if (host === "github") {
    // Only owner/repo — deeper paths (issues, blobs, a tree) are not the resource.
    if (parts.length !== 2) return null;
    return { kind: "gh", id: `${parts[0]}/${parts[1].replace(/\.git$/, "")}` };
  }

  if (parts[0] === "datasets") {
    if (parts.length < 2 || parts.length > 3) return null;
    return { kind: "dataset", id: parts.slice(1).join("/") };
  }
  if (HF_NON_MODEL.has(parts[0])) return null;
  if (parts.length > 2) return null;
  return { kind: "model", id: parts.join("/") };
}

export function refToPath(ref: ResourceRef): string {
  return `/r/${ref.kind}/${ref.id}`;
}

/** Parses the `/r/*` splat back into a ref. */
export function refFromSplat(splat: string): ResourceRef | null {
  const parts = splat.split("/").filter(Boolean);
  const [kind, ...rest] = parts;
  if (kind !== "gh" && kind !== "model" && kind !== "dataset") return null;
  if (rest.length === 0 || rest.length > 2) return null;
  return { kind, id: rest.join("/") };
}

export function upstreamUrl(ref: ResourceRef): string {
  if (ref.kind === "gh") return `https://github.com/${ref.id}`;
  if (ref.kind === "dataset") return `https://huggingface.co/datasets/${ref.id}`;
  return `https://huggingface.co/${ref.id}`;
}

export const KIND_LABEL: Record<ResourceKind, string> = {
  gh: "Repository",
  model: "Model",
  dataset: "Dataset",
};
