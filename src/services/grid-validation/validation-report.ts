export type ValidationGrade = "PASS" | "WARNING" | "FAIL";

export interface ConstraintResult {
  readonly id: string;
  readonly status: "pass" | "warning" | "fail";
  readonly message: string;
  readonly score: number;
}

export interface ValidationReport {
  readonly overallGrade: ValidationGrade;
  readonly validationScore: number;
  readonly passedConstraints: readonly string[];
  readonly brokenConstraints: readonly string[];
  readonly warnings: readonly string[];
  readonly engineeringNotes: readonly string[];
  readonly confidencePct: number;
  readonly constraints: readonly ConstraintResult[];
}

/** Aggregates individual deterministic constraints into a concise simulation integrity report. */
export function compileValidationReport(results: readonly ConstraintResult[]): ValidationReport {
  const brokenConstraints = results
    .filter((result) => result.status === "fail")
    .map((result) => result.message);
  const warnings = results
    .filter((result) => result.status === "warning")
    .map((result) => result.message);
  const passedConstraints = results
    .filter((result) => result.status === "pass")
    .map((result) => result.id);
  const validationScore = Math.round(
    results.reduce((sum, result) => sum + result.score, 0) / Math.max(1, results.length),
  );
  const overallGrade: ValidationGrade =
    brokenConstraints.length > 0 ? "FAIL" : warnings.length > 0 ? "WARNING" : "PASS";
  return {
    overallGrade,
    validationScore,
    passedConstraints,
    brokenConstraints,
    warnings,
    engineeringNotes: results.map((result) => `${result.id}: ${result.message}`),
    confidencePct: validationScore,
    constraints: results,
  };
}
