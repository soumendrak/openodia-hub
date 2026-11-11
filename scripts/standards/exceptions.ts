import { z } from "zod";

export const EXCEPTIONS_PATH = "scripts/standards/exceptions.json";

export type Finding = Readonly<Record<"rule" | "file" | "message" | "key", string>> & {
  readonly line: number;
};

const isCalendarDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().startsWith(value);

const exceptionSchema = z
  .object({
    rule: z.string().min(1),
    file: z.string().min(1),
    findings: z.array(z.string().min(1)).min(1),
    reason: z.string().trim().min(1),
    expires: z.string().refine(isCalendarDate),
    approvedBy: z.string().trim().min(1),
  })
  .strict();

export type StandardsException = z.infer<typeof exceptionSchema>;
export type Exceptions = readonly StandardsException[];

const fileSchema = z.object({ exceptions: z.array(exceptionSchema) }).strict();

export function parseExceptions(raw: unknown): StandardsException[] {
  return fileSchema.parse(raw).exceptions;
}

export function consume(pool: string[], item: string): boolean {
  const index = pool.indexOf(item);
  if (index >= 0) pool.splice(index, 1);
  return index >= 0;
}

const key = (rule: string, file: string) => `${rule} in ${file}`;

export function checkExceptions(exceptions: Exceptions, today: string) {
  const seen = new Set<string>();
  return exceptions.flatMap((entry) => {
    const id = key(entry.rule, entry.file);
    const problems = seen.has(id) ? [`${id}: duplicate exception`] : [];
    if (entry.expires < today) problems.push(`${id}: exception expired on ${entry.expires}`);
    seen.add(id);
    return problems;
  });
}

export function applyExceptions(
  findings: readonly Finding[],
  entries: Exceptions,
  present = ({ rule, file }: StandardsException): readonly string[] =>
    findings.filter((item) => item.rule === rule && item.file === file).map((item) => item.key),
) {
  const unapproved = new Map<string, string[]>();
  const problems: string[] = [];
  for (const entry of entries) {
    const id = key(entry.rule, entry.file);
    const listed = [...entry.findings];
    const extra = present(entry).filter((item) => !consume(listed, item));
    unapproved.set(id, extra);
    const stale = `${id}: no longer found, remove from ${EXCEPTIONS_PATH}: ${listed.join(" | ")}`;
    if (listed.length > 0) problems.push(stale);
  }
  const pool = (finding: Finding) =>
    unapproved.get(key(finding.rule, finding.file)) ?? [finding.key];
  const blocking = [...findings].reverse().filter((finding) => consume(pool(finding), finding.key));
  return { blocking: blocking.reverse(), problems };
}
