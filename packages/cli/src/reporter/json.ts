import type { HealthReport } from "epitaph-dev-core";

export function renderJsonReport(report: HealthReport): string {
  return JSON.stringify(report, null, 2);
}
