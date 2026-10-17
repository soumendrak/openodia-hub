import { z } from "zod";

export const EXCEPTIONS_PATH = "scripts/standards/exceptions.json";

export type Finding = Readonly<Record<"rule" | "file" | "message" | "key", string>> & {
  readonly line: number;
};

const isCalendarDate = (value: string) =>
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().startsWith(value);

const exceptionSchema = z
  .object({
    rule: z.string().min(1),
    file: z.string().min(1),
    findings: z.array(z.string().min(1)).min(1),
    reason: z.string().min(1),
    expires: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(isCalendarDate),
    approvedBy: z.string().min(1),
  })
  .strict();

export type StandardsException = z.infer<typeof exceptionSchema>;
export type Exceptions = readonly StandardsException[];

export function parseExceptions(raw: unknown): StandardsException[] {
  return z
    .object({ exceptions: z.array(exceptionSchema) })
    .strict()
    .parse(raw).exceptions;
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

export function applyExceptions(findings: readonly Finding[], entries: Exceptions) {
  const allowed = new Map(
    entries.map((entry) => [key(entry.rule, entry.file), [...entry.findings]]),
  );
  const blocking = findings.filter(
    (finding) => !consume(allowed.get(key(finding.rule, finding.file)) ?? [], finding.key),
  );
  const unused = [...allowed].filter(([, left]) => left.length > 0);
  const problems = unused.map(
    ([id, left]) => `${id}: no longer found, remove from ${EXCEPTIONS_PATH}: ${left.join(" | ")}`,
  );
  return { blocking, problems };
}
