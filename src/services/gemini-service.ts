import type { getNationalGridSnapshot } from "./grid-snapshot";
import type { optimizeGridDispatch } from "./grid-optimizer";
import type { runMonteCarloSimulation } from "./monte-carlo";
import { getPolarStationState, optimizePolarDispatch, runPolarRiskSimulation } from "./polar-station";

declare const process: { env: Record<string, string | undefined> };

type NationalGridSnapshot = Awaited<ReturnType<typeof getNationalGridSnapshot>>;
type MonteCarloResult = ReturnType<typeof runMonteCarloSimulation>;
type GridOptimizerResult = ReturnType<typeof optimizeGridDispatch>;

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_TIMEOUT_MS = 20_000;
const GEMINI_MAX_OUTPUT_TOKENS = 900;

const SYSTEM_PROMPT = `
You are Grid Sentinel AI, an expert energy-systems decision-support assistant for the Grid Sentinel AI prototype.

Knowledge scope:
- National grid snapshot, state-level risk, renewable penetration, reserves, batteries and dispatch actions.
- Monte Carlo risk analysis, including LOLP, EUE, confidence intervals, convergence/stability and simulation performance.
- Polar research-station digital twin, including critical/deferrable load, solar/wind availability, battery reserve, backup generation, weather scenarios and modeled baseline-vs-Sentinel impact.
- Texas 2021 historical replay when supplied. Treat replay data as historical analysis, not live telemetry.
- Grid optimization and contingency/risk concepts represented in the supplied backend context.

Strict truth rules:
- Use only the supplied backend context for numerical claims.
- Never invent telemetry, forecasts, probabilities, savings, costs, emissions, dates, or equipment status.
- Clearly distinguish modeled/synthetic prototype results from historical or live data.
- Do not call Monte Carlo estimator precision "accuracy".
- Do not call heuristic optimization a mathematically proven global optimum.
- If a requested fact is not in the context, say "Not available in the current Grid Sentinel context."
- Do not treat the prototype's polar-station inputs as live station telemetry.
- Explain the evidence behind every recommendation.

Answer structure:
1. **Assessment** — one or two sentences answering the question directly.
2. **Evidence** — cite the relevant supplied metrics/conditions; keep units.
3. **Recommended action** — concrete operator action and why it follows from the evidence.
4. **Expected impact** — only when the context contains a baseline-vs-Sentinel comparison; report the supplied modeled change and label it modeled.
5. **Data status** — state whether the answer uses prototype/synthetic, live national snapshot, or historical replay data.

For simple factual questions, keep the same headings but make each section brief. Never hide uncertainty.
`.trim();

interface GeminiGridAssistantInput {
  readonly question: string;
  readonly snapshot: NationalGridSnapshot;
  readonly monteCarlo: MonteCarloResult;
  readonly optimizer: GridOptimizerResult;
  readonly texasReplay?: TexasReplayPromptContext;
}

export interface GeminiGridAssistantResponse {
  readonly content: string;
  readonly sources: readonly string[];
}

export interface TexasReplayPromptContext {
  readonly requested: boolean;
  readonly dataAvailable: boolean;
  readonly status: string;
  readonly unavailableFields: readonly string[];
  readonly replayStart?: string;
  readonly replayEnd?: string;
  readonly peakDemandMw?: number | string;
  readonly peakRenewableGenerationMw?: number | string;
  readonly minimumReserveMarginPercent?: number | string;
  readonly maximumBlackoutProbability?: number | string;
  readonly maximumBlackoutProbabilityHour?: unknown;
  readonly majorTimelineEvents?: readonly unknown[];
  readonly summaryStatistics?: unknown;
}

interface GeminiResponse {
  readonly candidates?: readonly {
    readonly content?: {
      readonly parts?: readonly {
        readonly text?: string;
      }[];
    };
  }[];
  readonly error?: {
    readonly message?: string;
  };
}

interface GeminiProviderDiagnostics {
  readonly httpStatus?: number;
  readonly responseBody?: string;
  readonly providerErrorMessage?: string;
  readonly timeoutMs?: number;
  readonly timedOut: boolean;
}

export class GeminiServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiServiceError";
  }
}

export async function askGeminiGridAssistant(
  input: GeminiGridAssistantInput,
): Promise<GeminiGridAssistantResponse> {
  const response = await requestGemini(buildRequestBody(input));
  const content = extractText(response);

  return {
    content,
    sources: [
      "Gemini 2.5 Flash",
      "Grid Sentinel backend context",
      "National Grid Snapshot",
      "Monte Carlo Engine",
      "Grid Optimizer",
      "Polar Station Digital Twin",
      ...(input.texasReplay ? ["Texas 2021 Historical Replay"] : []),
    ],
  };
}

function buildRequestBody(input: GeminiGridAssistantInput) {
  const userPrompt = buildUserPrompt(input);
  return {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
    },
  };
}

function buildUserPrompt(input: GeminiGridAssistantInput): string {
  return [
    "Answer the operator question using only this backend-generated Grid Sentinel context.",
    "Do not calculate new grid values. Do not add measurements that are not present.",
    "Use the requested answer structure exactly unless the question is unrelated, in which case refuse briefly.",
    "",
    `Operator question: ${input.question}`,
    "",
    "Backend context JSON:",
    JSON.stringify(buildGridContext(input), null, 2),
  ].join("\n");
}

function buildGridContext(input: GeminiGridAssistantInput) {
  return {
    nationalGridSnapshot: buildNationalSummary(input.snapshot),
    stateRiskSummary: input.snapshot.states.map(buildStateSummary),
    monteCarloResult: input.monteCarlo,
    gridOptimizerResult: buildOptimizerSummary(input.optimizer),
    polarStationDigitalTwin: buildPolarSummary(),
    ...(input.texasReplay ? { TexasReplaySummary: input.texasReplay } : {}),
  };
}

function buildPolarSummary() {
  return ["nominal", "polar-storm", "low-light", "wind-derating"].map((scenario) => {
    const state = getPolarStationState(scenario as Parameters<typeof getPolarStationState>[0]);
    const risk = runPolarRiskSimulation(state);
    const optimized = optimizePolarDispatch(state);
    return {
      scenario,
      state,
      baselineRisk: risk,
      sentinelDispatch: optimized,
      modeledFuelSavingPercent: percentReduction(risk.fuelUsedLitres, optimized.fuelUsedLitres),
      modeledShortageRiskReductionPercent: percentReduction(
        risk.shortageProbabilityPercent,
        optimized.shortageProbabilityPercent,
      ),
      modeledEueReductionPercent: percentReduction(
        risk.expectedUnservedEnergyKwh,
        optimized.expectedUnservedEnergyKwh,
      ),
      fuelCostAssumptionInrPerLitre: 95,
      co2AssumptionKgPerLitre: 2.68,
      dieselConsumptionAssumptionLitresPerKwh: 0.29,
      dataStatus: "Synthetic prototype inputs; modeled decision-support comparison, not field measurements.",
    };
  });
}

function percentReduction(baseline: number, optimized: number): number | null {
  if (baseline <= 0) return null;
  return Math.round(((baseline - optimized) / baseline) * 1000) / 10;
}

function buildNationalSummary(snapshot: NationalGridSnapshot) {
  return {
    timestamp: snapshot.timestamp,
    nationalDemandMw: snapshot.nationalDemandMw,
    nationalRenewableGenerationMw: snapshot.nationalRenewableGenerationMw,
    nationalReserveMarginPercent: snapshot.nationalReserveMarginPercent,
    nationalRenewablePenetrationPercent: snapshot.nationalRenewablePenetrationPercent,
    nationalGridStressIndex: snapshot.nationalGridStressIndex,
    averageDemandConfidence: snapshot.averageDemandConfidence,
    highestRiskState: snapshot.highestRiskState,
    lowestRiskState: snapshot.lowestRiskState,
    systemHealthScore: snapshot.systemHealthScore,
  };
}

function buildStateSummary(state: NationalGridSnapshot["states"][number]) {
  return {
    state: state.state,
    capital: state.capital,
    observedAt: state.observedAt,
    demandMw: state.demand.estimatedLoadMw,
    peakLoadMw: state.demand.peakLoadMw,
    renewableGenerationMw: state.energy.netRenewableGenerationMw,
    batteryAvailableMwh: state.energy.batteryAvailableMwh,
    supplyDemandGapMw: state.energy.supplyDemandGapMw,
    reserveMarginPercent: state.energy.reserveMarginPercent,
    gridStressIndex: state.energy.gridStressIndex,
    demandConfidenceScore: state.demand.demandConfidenceScore,
  };
}

function buildOptimizerSummary(optimizer: GridOptimizerResult) {
  return {
    generatedAt: optimizer.generatedAt,
    systemPriority: optimizer.systemPriority,
    projectedReserveMarginPercent: optimizer.projectedReserveMarginPercent,
    residualRiskScore: optimizer.residualRiskScore,
    totalBatteryDispatchMw: optimizer.totalBatteryDispatchMw,
    totalDemandResponseMw: optimizer.totalDemandResponseMw,
    totalReserveProcurementMw: optimizer.totalReserveProcurementMw,
    totalRenewableCurtailmentMw: optimizer.totalRenewableCurtailmentMw,
    recommendedActions: optimizer.recommendedActions,
  };
}

async function requestGemini(body: unknown): Promise<GeminiResponse> {
  const apiKey = readApiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  const requestBody = JSON.stringify(body);

  logGeminiRequestDiagnostics(body, requestBody);

  try {
    const response = await fetch(buildGeminiUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: requestBody,
      signal: controller.signal,
    });

    const responseBody = await response.text();
    logGeminiResponseDiagnostics(response.status, responseBody);
    const data = parseGeminiResponse(responseBody);

    if (!response.ok) {
      logGeminiProviderError({
        httpStatus: response.status,
        responseBody,
        providerErrorMessage: data.error?.message,
        timeoutMs: GEMINI_TIMEOUT_MS,
        timedOut: false,
      });
      throw new GeminiServiceError(readGeminiError(data));
    }

    return data;
  } catch (error) {
    if (isAbortError(error)) {
      logGeminiProviderError({
        providerErrorMessage: "Gemini request aborted by server timeout.",
        timeoutMs: GEMINI_TIMEOUT_MS,
        timedOut: true,
      });
      throw new GeminiServiceError("Gemini request timed out. Please retry.");
    }
    if (error instanceof GeminiServiceError) throw error;
    logGeminiProviderError({
      providerErrorMessage:
        error instanceof Error ? error.message : "Unknown Gemini request failure.",
      timeoutMs: GEMINI_TIMEOUT_MS,
      timedOut: false,
    });
    throw new GeminiServiceError("Gemini is unavailable. Please retry later.");
  } finally {
    clearTimeout(timeout);
  }
}

function readApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiServiceError("Gemini is not configured.");
  }
  return apiKey;
}

function buildGeminiUrl(): string {
  return `${GEMINI_API_BASE_URL}/${GEMINI_MODEL}:generateContent`;
}

function parseGeminiResponse(responseBody: string): GeminiResponse {
  try {
    return JSON.parse(responseBody) as GeminiResponse;
  } catch {
    throw new GeminiServiceError("Gemini returned an unreadable response.");
  }
}

function extractText(response: GeminiResponse): string {
  const text = response.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) throw new GeminiServiceError("Gemini returned no response text.");
  return text;
}

function readGeminiError(_response: GeminiResponse): string {
  return "Gemini request failed. Please retry later.";
}

function logGeminiProviderError(diagnostics: GeminiProviderDiagnostics): void {
  console.error("Gemini provider error", {
    httpStatus: diagnostics.httpStatus ?? null,
    responseBody: redactSecrets(diagnostics.responseBody ?? null),
    providerErrorMessage: redactSecrets(diagnostics.providerErrorMessage ?? null),
    timeoutMs: diagnostics.timeoutMs ?? null,
    timedOut: diagnostics.timedOut,
  });
}

function logGeminiRequestDiagnostics(body: unknown, requestBody: string): void {
  console.info("Gemini request diagnostics", {
    promptSizeChars: calculatePromptSizeChars(body),
    jsonBodySizeBytes: new TextEncoder().encode(requestBody).length,
  });
}

function logGeminiResponseDiagnostics(httpStatus: number, responseBody: string): void {
  console.info("Gemini response diagnostics", {
    httpStatus,
    responseBody: redactSecrets(responseBody),
  });
}

function calculatePromptSizeChars(body: unknown): number {
  const contents =
    (body as { contents?: readonly { parts?: readonly { text?: string }[] }[] }).contents ?? [];
  return contents.reduce(
    (total, content) =>
      total +
      (content.parts ?? []).reduce((partTotal, part) => partTotal + (part.text?.length ?? 0), 0),
    0,
  );
}

function redactSecrets(value: string | null): string | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!value || !apiKey) return value;
  return value.replaceAll(apiKey, "[REDACTED_GEMINI_API_KEY]");
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
