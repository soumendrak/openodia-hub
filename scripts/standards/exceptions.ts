import { z } from "zod";

export const EXCEPTIONS_PATH = "scripts/standards/exceptions.json";

export type Finding = {
  readonly rule: string;
  readonly file: string;
  readonly line: number;
  readonly message: string;
};

const exceptionSchema = z
  .object({
    rule: z.string().min(1),
    file: z.string().min(1),
    limit: z.number().int().positive(),
    reason: z.string().min(1),
    expires: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    approvedBy: z.string().min(1),
  })
  .strict();

export type StandardsException = z.infer<typeof exceptionSchema>;

export function parseExceptions(raw: unknown): StandardsException[] {
  return z
    .object({ exceptions: z.array(exceptionSchema) })
    .strict()
    .parse(raw).exceptions;
}

const key = (rule: string, file: string) => `${rule} in ${file}`;

export function applyExceptions(
  findings: readonly Finding[],
  exceptions: readonly StandardsException[],
  today: string,
): { blocking: Finding[]; problems: string[] } {
  const problems: string[] = [];
  const limits = new Map<string, number>();
  for (const entry of exceptions) {
    const id = key(entry.rule, entry.file);
    if (limits.has(id)) problems.push(`${id}: duplicate exception`);
    if (entry.expires < today) problems.push(`${id}: exception expired on ${entry.expires}`);
    limits.set(id, entry.limit);
  }
  const groups = new Map<string, Finding[]>();
  for (const finding of findings) {
    const id = key(finding.rule, finding.file);
    groups.set(id, [...(groups.get(id) ?? []), finding]);
  }
  const blocking: Finding[] = [];
  for (const [id, group] of groups) {
    const limit = limits.get(id) ?? 0;
    if (group.length <= limit) continue;
    blocking.push(...group);
    if (limit > 0)
      problems.push(`${id}: ${group.length} found, ${limit} allowed by ${EXCEPTIONS_PATH}`);
  }
  return { blocking, problems };
}
