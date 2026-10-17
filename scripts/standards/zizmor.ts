import { z } from "zod";
import type { Finding } from "./exceptions";

export const ZIZMOR_VERSION = "1.31.1";

const segment = z.object({ Key: z.string() }).or(z.object({ Index: z.number() }));

const locationSchema = z.object({
  symbolic: z.object({
    key: z.object({ Local: z.object({ verbatim_path: z.string() }) }),
    kind: z.string(),
    route: z.object({ route: z.array(segment) }),
    feature_kind: z
      .object({ Subfeature: z.object({ fragment: z.object({ Raw: z.string() }) }) })
      .or(z.string()),
  }),
  concrete: z.object({
    location: z.object({ start_point: z.object({ row: z.number() }) }),
    feature: z.string(),
  }),
});

const reportSchema = z.array(
  z.object({
    ident: z.string(),
    desc: z.string(),
    determinations: z.object({ severity: z.string() }),
    locations: z.array(locationSchema).nonempty(),
  }),
);

export function parseZizmor(raw: unknown): Finding[] {
  return reportSchema.parse(raw).map((report) => {
    const primary =
      report.locations.find((location) => location.symbolic.kind === "Primary") ??
      report.locations[0];
    const { route, feature_kind } = primary.symbolic;
    const path = route.route.map((part) => ("Key" in part ? part.Key : "*")).join(".");
    const flagged =
      typeof feature_kind === "string"
        ? primary.concrete.feature.trim().replace(/\n.*/s, "")
        : feature_kind.Subfeature.fragment.Raw;
    return {
      rule: `zizmor/${report.ident}`,
      file: primary.symbolic.key.Local.verbatim_path,
      line: primary.concrete.location.start_point.row + 1,
      message: `${report.determinations.severity}: ${report.desc}`,
      key: `${path} ${flagged}`.trim(),
    };
  });
}
