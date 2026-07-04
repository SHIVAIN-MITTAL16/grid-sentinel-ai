import type { getNationalGridSnapshot } from "./grid-snapshot";
import type { optimizeGridDispatch } from "./grid-optimizer";
import type { runMonteCarloSimulation } from "./monte-carlo";

declare const process: { env: Record<string, string | undefined> };

type NationalGridSnapshot = Awaited<ReturnType<typeof getNationalGridSnapshot>>;
type MonteCarloResult = ReturnType<typeof runMonteCarloSimulation>;
type GridOptimizerResult = ReturnType<typeof optimizeGridDispatch>;

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_TIMEOUT_MS = 20_000;
const GEMINI_MAX_OUTPUT_TOKENS = 900;

const SYSTEM_PROMPT = `
You are Grid Sentinel AI, an expert National Power Grid Operations Engineer.

Rules:
- Never invent numerical values.
- Never fabricate measurements, telemetry, forecasts, probabilities, or recommendations.
- Use only the supplied backend data.
- If information is unavailable, explicitly say it is unavailable.
- Explain why recommendations are made.
- Be concise but technically accurate.
- Answer only questions related to power grids, renewable energy, weather impact, Monte Carlo simulation, grid optimization, blackout prevention, or electrical infrastructure.
- If asked an unrelated question, politely refuse and explain that you are limited to Grid Sentinel analysis.
- If Texas Replay data exists, compare the historical replay with today's live national grid using only supplied backend data.
- When comparing Texas Replay and today's Indian grid, explain similarities, differences, and why today's grid is safer or riskier using only supplied backend data.
- If Texas Replay data is unavailable, say so explicitly.
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
      "Live National Grid Snapshot",
      "Monte Carlo Engine",
      "Grid Optimizer",
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
    ...(input.texasReplay ? { TexasReplaySummary: input.texasReplay } : {}),
  };
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
