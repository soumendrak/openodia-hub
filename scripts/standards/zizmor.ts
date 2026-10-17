import { z } from "zod";
import type { Finding } from "./exceptions";

export const ZIZMOR_VERSION = "1.31.1";

const locationSchema = z.object({
  symbolic: z.object({
    key: z.object({ Local: z.object({ verbatim_path: z.string() }) }),
    kind: z.string(),
  }),
  concrete: z.object({ location: z.object({ start_point: z.object({ row: z.number() }) }) }),
});

const reportSchema = z.array(
  z.object({
    ident: z.string(),
    desc: z.string(),
    determinations: z.object({ severity: z.string() }),
    locations: z.array(locationSchema).nonempty(),
    ignored: z.boolean(),
  }),
);

export function parseZizmor(raw: unknown): Finding[] {
  return reportSchema
    .parse(raw)
    .filter((report) => !report.ignored)
    .map((report) => {
      const primary =
        report.locations.find((location) => location.symbolic.kind === "Primary") ??
        report.locations[0];
      return {
        rule: `zizmor/${report.ident}`,
        file: primary.symbolic.key.Local.verbatim_path,
        line: primary.concrete.location.start_point.row + 1,
        message: `${report.determinations.severity}: ${report.desc}`,
      };
    });
}
