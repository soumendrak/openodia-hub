import { getLocaleStatus } from "../src/lib/locale-status";

export function checkLocaleCoverage(report = getLocaleStatus(), output = console) {
  output.log(
    `Odia UI inventory: ${report.translated}/${report.total} translated; ${report.reviewed}/${report.total} native-reviewed. Scope: ${report.scope}`,
  );
  for (const error of report.errors) output.error(error);
  return report.errors.length === 0 ? 0 : 1;
}

if (process.argv[1]?.endsWith("check-locale-coverage.ts")) {
  process.exitCode = checkLocaleCoverage();
}
