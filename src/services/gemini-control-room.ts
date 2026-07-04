import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/start-server-core";

import { getNationalGridSnapshot } from "./grid-snapshot";
import { optimizeGridDispatch } from "./grid-optimizer";
import { askGeminiGridAssistant, type TexasReplayPromptContext } from "./gemini-service";
import { runMonteCarloSimulation } from "./monte-carlo";
import { getTexasReplayInput } from "./texas-replay-data";
import { runTexas2021Replay } from "./texas-replay";

const AI_ENDPOINT_TIMEOUT_MS = 30_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_FALLBACK_KEY = "unknown-client";
const GENERIC_AI_ERROR = "The AI assistant is temporarily unavailable. Please retry.";
const REPLAY_UNAVAILABLE = "Unavailable from current replay dataset.";

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const previousReplayResponseByClient = new Map<string, boolean>();

interface ControlRoomQuestion {
  readonly question: string;
}

export const askGeminiControlRoom = createServerFn({ method: "POST" })
  .validator(validateQuestion)
  .handler(async ({ data }) => {
    try {
      logControlRoomStage("Received operator question", {
        questionLength: data.question.length,
        question: data.question,
      });

      enforceRateLimit();

      return await withTimeout(async () => {
        logControlRoomStage("Grid snapshot loading");
        const snapshot = await getNationalGridSnapshot();
        logControlRoomStage("Grid snapshot loaded", {
          timestamp: snapshot.timestamp,
          stateCount: snapshot.states.length,
        });

        const monteCarlo = runMonteCarloSimulation(snapshot);
        logControlRoomStage("Monte Carlo completion", {
          blackoutProbability: monteCarlo.blackoutProbability,
          meanReserveMargin: monteCarlo.meanReserveMargin,
        });

        const optimizer = optimizeGridDispatch({ snapshot, monteCarlo });
        logControlRoomStage("Optimizer completion", {
          actionCount: optimizer.recommendedActions.length,
          residualRiskScore: optimizer.residualRiskScore,
        });

        const clientKey = readRateLimitKey();
        const replayIntent = detectReplayIntent(
          data.question,
          previousReplayResponseByClient.get(clientKey) === true,
        );
        logControlRoomStage("Texas replay intent detection", replayIntent);

        const texasReplay = replayIntent.loadTexasReplay
          ? await buildTexasReplayContext()
          : undefined;

        const answer = await askGeminiGridAssistant({
          question: data.question,
          snapshot,
          monteCarlo,
          optimizer,
          texasReplay,
        });
        previousReplayResponseByClient.set(clientKey, texasReplay !== undefined);
        return answer;
      }, AI_ENDPOINT_TIMEOUT_MS);
    } catch (error) {
      logControlRoomException(error);
      throw new Error(sanitizeEndpointError(error));
    }
  });

function validateQuestion(input: unknown): ControlRoomQuestion {
  if (!input || typeof input !== "object") {
    throw new Error("Question is required.");
  }

  const question = (input as { question?: unknown }).question;
  if (typeof question !== "string" || question.trim().length === 0) {
    throw new Error("Question is required.");
  }

  return { question: question.trim() };
}

function enforceRateLimit(): void {
  const now = Date.now();
  const key = readRateLimitKey();
  const bucket = rateLimitBuckets.get(key);

  removeExpiredBuckets(now);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }

  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    throw new Error("Too many AI requests. Please wait before retrying.");
  }

  bucket.count += 1;
}

function readRateLimitKey(): string {
  try {
    return getRequestIP({ xForwardedFor: true }) ?? RATE_LIMIT_FALLBACK_KEY;
  } catch {
    return RATE_LIMIT_FALLBACK_KEY;
  }
}

function removeExpiredBuckets(now: number): void {
  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) rateLimitBuckets.delete(key);
  }
}

async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("AI request timed out. Please retry.")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function sanitizeEndpointError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";

  if (message === "Too many AI requests. Please wait before retrying.") return message;
  if (message === "AI request timed out. Please retry.") return message;

  return GENERIC_AI_ERROR;
}

function detectReplayIntent(question: string, previousAssistantUsedReplay: boolean) {
  const concepts = extractQuestionConcepts(question);
  const hasHistoricalContext =
    concepts.has("replay") || concepts.has("historical") || concepts.has("texas");
  const hasReplayOperationalMetric = [
    "blackout",
    "reserve",
    "loadshed",
    "renewable",
    "peakdemand",
    "generation",
    "timeline",
    "emergency",
    "outage",
  ].some((concept) => concepts.has(concept));

  return {
    loadTexasReplay:
      hasHistoricalContext || hasReplayOperationalMetric || previousAssistantUsedReplay,
    previousAssistantUsedReplay,
    concepts: [...concepts],
  };
}

function extractQuestionConcepts(question: string): Set<string> {
  const tokens = question
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(stemToken);
  const tokenSet = new Set(tokens);
  const concepts = new Set<string>();

  addConcept(concepts, "texas", tokenSet, ["texa", "ercot", "uri"]);
  addConcept(concepts, "replay", tokenSet, ["replay", "simulation", "reconstruct", "benchmark"]);
  addConcept(concepts, "historical", tokenSet, ["historical", "history", "past", "event", "storm"]);
  addConcept(concepts, "blackout", tokenSet, ["blackout", "outage", "collapse"]);
  addConcept(concepts, "reserve", tokenSet, ["reserve", "margin"]);
  addConcept(concepts, "loadshed", tokenSet, ["shed", "curtail", "unserved"]);
  addConcept(concepts, "renewable", tokenSet, ["renewable", "solar", "wind", "hydro"]);
  addConcept(concepts, "peakdemand", tokenSet, ["peak", "demand", "load"]);
  addConcept(concepts, "generation", tokenSet, ["generation", "generat", "supply", "output"]);
  addConcept(concepts, "timeline", tokenSet, ["timeline", "hour", "time", "when"]);
  addConcept(concepts, "emergency", tokenSet, ["emergency", "alert", "eea", "warning"]);
  addConcept(concepts, "outage", tokenSet, ["outage", "failure", "forced", "trip"]);

  return concepts;
}

function addConcept(
  concepts: Set<string>,
  concept: string,
  tokenSet: ReadonlySet<string>,
  indicators: readonly string[],
): void {
  if (indicators.some((indicator) => tokenSet.has(indicator))) concepts.add(concept);
}

function stemToken(token: string): string {
  return token.replace(/ies$/, "y").replace(/ing$/, "").replace(/ed$/, "").replace(/s$/, "");
}

async function buildTexasReplayContext(): Promise<TexasReplayPromptContext> {
  logControlRoomStage("Texas replay context loading");
  const replay = await runTexas2021Replay(getTexasReplayInput());
  logControlRoomStage("Texas replay context loaded", {
    timelinePoints: replay.timeline.length,
    sources: replay.metadata.sources,
    missingDatasets: replay.metadata.missingDatasets ?? [],
  });

  if (replay.timeline.length === 0) {
    const replaySummary = validateReplaySummary(undefined, {});
    return {
      requested: true,
      dataAvailable: false,
      status:
        "Texas Replay was requested, but no authentic historical datasets are loaded in src/data/texas-uri/.",
      replayStart: REPLAY_UNAVAILABLE,
      replayEnd: REPLAY_UNAVAILABLE,
      peakDemandMw: REPLAY_UNAVAILABLE,
      peakRenewableGenerationMw: REPLAY_UNAVAILABLE,
      minimumReserveMarginPercent: REPLAY_UNAVAILABLE,
      maximumBlackoutProbability: REPLAY_UNAVAILABLE,
      maximumBlackoutProbabilityHour: REPLAY_UNAVAILABLE,
      majorTimelineEvents: [],
      summaryStatistics: replaySummary,
      unavailableFields: [
        "replayStart",
        "replayEnd",
        "peakDemandMw",
        "peakRenewableGenerationMw",
        "minimumReserveMarginPercent",
        "maximumBlackoutProbability",
        "majorTimelineEvents",
        "summaryStatistics",
        "outages",
        "frequency",
        "generation failures",
        "replay recommendations",
        ...(replay.metadata.missingDatasets ?? []),
      ],
    };
  }

  const timeline = replay.timeline.map((point, index) => sanitizeTimelinePoint(point, index));
  const peakDemandMw = maxValue(timeline, (point) => point.demandMw);
  const peakRenewableGenerationMw = maxValue(timeline, (point) => point.renewableGenerationMw);
  const minimumReserveMarginPercent = minValue(timeline, (point) => point.reserveMarginPercent);
  const maximumBlackoutProbabilityHour = maxPoint(timeline, (point) => point.blackoutProbability);
  const maximumBlackoutProbability = maximumBlackoutProbabilityHour?.blackoutProbability;
  const maximumLoadShedMw = maxValue(timeline, (point) => point.loadShedMw);
  const maximumForcedOutageMw = maxValue(timeline, (point) => point.forcedOutageMw);
  const safePeakRenewableGenerationMw = metricOrUnavailable(
    peakRenewableGenerationMw,
    "TexasReplaySummary.peakRenewableGenerationMw",
  );
  const replaySummary = validateReplaySummary(replay.summary, {
    peakDemandMw,
    peakRenewableGenerationMw,
    minimumReserveMarginPercent,
    maximumBlackoutProbability,
    maximumLoadShedMw,
    maximumForcedOutageMw,
  });

  logReplaySummary(replaySummary);
  logTexasReplayContextFields({
    timeline,
    replaySummary,
    peakDemandMw,
    peakRenewableGenerationMw: safePeakRenewableGenerationMw,
    minimumReserveMarginPercent,
    maximumBlackoutProbability,
    maximumLoadShedMw,
    maximumForcedOutageMw,
    maximumBlackoutProbabilityHour,
  });

  return {
    requested: true,
    dataAvailable: true,
    status: "Texas Replay backend returned historical replay data.",
    replayStart: timeline[0]?.timestamp ?? REPLAY_UNAVAILABLE,
    replayEnd: timeline.at(-1)?.timestamp ?? REPLAY_UNAVAILABLE,
    peakDemandMw: peakDemandMw ?? REPLAY_UNAVAILABLE,
    peakRenewableGenerationMw: safePeakRenewableGenerationMw,
    minimumReserveMarginPercent: minimumReserveMarginPercent ?? REPLAY_UNAVAILABLE,
    maximumBlackoutProbability: maximumBlackoutProbability ?? REPLAY_UNAVAILABLE,
    maximumBlackoutProbabilityHour: maximumBlackoutProbabilityHour ?? REPLAY_UNAVAILABLE,
    majorTimelineEvents: timeline,
    summaryStatistics: replaySummary,
    unavailableFields: replay.metadata.missingDatasets ?? [],
  };
}

function maxValue<T>(
  items: readonly T[],
  selector: (item: T) => number | null | undefined,
): number | undefined {
  const values = items.map(selector).filter(isUsableNumber);
  return values.length > 0 ? Math.max(...values) : undefined;
}

function minValue<T>(
  items: readonly T[],
  selector: (item: T) => number | null | undefined,
): number | undefined {
  const values = items.map(selector).filter(isUsableNumber);
  return values.length > 0 ? Math.min(...values) : undefined;
}

function maxPoint<T>(
  items: readonly T[],
  selector: (item: T) => number | null | undefined,
): T | undefined {
  return items.reduce<T | undefined>((best, item) => {
    const value = selector(item);
    if (!isUsableNumber(value)) return best;
    if (!best) return item;

    const bestValue = selector(best);
    return !isUsableNumber(bestValue) || value > bestValue ? item : best;
  }, undefined);
}

function sanitizeTimelinePoint(
  point: Awaited<ReturnType<typeof runTexas2021Replay>>["timeline"][number],
  index: number,
) {
  return {
    timestamp: safeString(point.timestamp, `timeline[${index}].timestamp`),
    temperatureCelsius: safeNumber(
      point.temperatureCelsius,
      `timeline[${index}].temperatureCelsius`,
    ),
    weatherStation: safeString(point.weatherStation, `timeline[${index}].weatherStation`),
    windSpeedKmh: safeNumber(point.windSpeedKmh, `timeline[${index}].windSpeedKmh`),
    precipitationMm: safeNumber(point.precipitationMm, `timeline[${index}].precipitationMm`),
    demandMw: safeNumber(point.demandMw, `timeline[${index}].demandMw`),
    generationMw: safeNumber(point.generationMw, `timeline[${index}].generationMw`),
    generationByFuel: point.generationByFuel,
    renewableGenerationMw: safeNumber(
      point.renewableGenerationMw,
      `timeline[${index}].renewableGenerationMw`,
    ),
    reserveMarginPercent: safeNumber(
      point.reserveMarginPercent,
      `timeline[${index}].reserveMarginPercent`,
    ),
    blackoutProbability: safeNumber(
      point.blackoutProbability,
      `timeline[${index}].blackoutProbability`,
    ),
    lossOfLoadProbability: safeNumber(
      point.lossOfLoadProbability,
      `timeline[${index}].lossOfLoadProbability`,
    ),
    expectedUnservedEnergyMwh: safeNumber(
      point.expectedUnservedEnergyMwh,
      `timeline[${index}].expectedUnservedEnergyMwh`,
    ),
    loadShedMw: safeNumber(point.loadShedMw, `timeline[${index}].loadShedMw`),
    frequencyHz: safeNumber(point.frequencyHz, `timeline[${index}].frequencyHz`),
    forcedOutageMw: safeNumber(point.forcedOutageMw, `timeline[${index}].forcedOutageMw`),
    predictedBlackout: point.predictedBlackout,
    majorEvent: safeString(point.majorEvent, `timeline[${index}].majorEvent`),
    recommendation: safeString(point.recommendation, `timeline[${index}].recommendation`),
  };
}

function validateReplaySummary(
  summary: Awaited<ReturnType<typeof runTexas2021Replay>>["summary"] | undefined,
  derived: Partial<Record<ReplaySummaryMetric, number | undefined>>,
) {
  return {
    eventName: stringMetric(summary?.eventName, "replaySummary.eventName"),
    replayStart: stringMetric(summary?.replayStart, "replaySummary.replayStart"),
    replayEnd: stringMetric(summary?.replayEnd, "replaySummary.replayEnd"),
    replayStartTime: stringMetric(summary?.replayStartTime, "replaySummary.replayStartTime"),
    replayEndTime: stringMetric(summary?.replayEndTime, "replaySummary.replayEndTime"),
    replayDurationHours: summaryMetric(
      summary?.replayDurationHours,
      derived.replayDurationHours,
      "replaySummary.replayDurationHours",
    ),
    timelineEventCount: summaryMetric(
      summary?.timelineEventCount,
      derived.timelineEventCount,
      "replaySummary.timelineEventCount",
    ),
    peakDemandMw: summaryMetric(
      summary?.peakDemandMw,
      derived.peakDemandMw,
      "replaySummary.peakDemandMw",
    ),
    minimumDemandMw: summaryMetric(
      summary?.minimumDemandMw,
      derived.minimumDemandMw,
      "replaySummary.minimumDemandMw",
    ),
    averageDemandMw: summaryMetric(
      summary?.averageDemandMw,
      derived.averageDemandMw,
      "replaySummary.averageDemandMw",
    ),
    peakGenerationMw: summaryMetric(
      summary?.peakGenerationMw,
      derived.peakGenerationMw,
      "replaySummary.peakGenerationMw",
    ),
    minimumGenerationMw: summaryMetric(
      summary?.minimumGenerationMw,
      derived.minimumGenerationMw,
      "replaySummary.minimumGenerationMw",
    ),
    averageGenerationMw: summaryMetric(
      summary?.averageGenerationMw,
      derived.averageGenerationMw,
      "replaySummary.averageGenerationMw",
    ),
    peakRenewableGenerationMw: summaryMetric(
      summary?.peakRenewableGenerationMw,
      derived.peakRenewableGenerationMw,
      "replaySummary.peakRenewableGenerationMw",
    ),
    minimumRenewableGenerationMw: summaryMetric(
      summary?.minimumRenewableGenerationMw,
      derived.minimumRenewableGenerationMw,
      "replaySummary.minimumRenewableGenerationMw",
    ),
    averageRenewableGenerationMw: summaryMetric(
      summary?.averageRenewableGenerationMw,
      derived.averageRenewableGenerationMw,
      "replaySummary.averageRenewableGenerationMw",
    ),
    peakGenerationShortageMw: summaryMetric(
      summary?.peakGenerationShortageMw,
      derived.peakGenerationShortageMw,
      "replaySummary.peakGenerationShortageMw",
    ),
    peakForcedOutageMw: summaryMetric(
      summary?.peakForcedOutageMw,
      derived.maximumForcedOutageMw,
      "replaySummary.peakForcedOutageMw",
    ),
    peakLoadShedMw: summaryMetric(
      summary?.peakLoadShedMw,
      derived.maximumLoadShedMw,
      "replaySummary.peakLoadShedMw",
    ),
    maximumForcedOutageMw: summaryMetric(
      summary?.maximumForcedOutageMw,
      derived.maximumForcedOutageMw,
      "replaySummary.maximumForcedOutageMw",
    ),
    maximumLoadShedMw: summaryMetric(
      summary?.maximumLoadShedMw,
      derived.maximumLoadShedMw,
      "replaySummary.maximumLoadShedMw",
    ),
    minimumReserveMarginPercent: summaryMetric(
      summary?.minimumReserveMarginPercent,
      derived.minimumReserveMarginPercent,
      "replaySummary.minimumReserveMarginPercent",
    ),
    maximumReserveMarginPercent: summaryMetric(
      summary?.maximumReserveMarginPercent,
      derived.maximumReserveMarginPercent,
      "replaySummary.maximumReserveMarginPercent",
    ),
    maximumBlackoutProbability: summaryMetric(
      summary?.maximumBlackoutProbability,
      derived.maximumBlackoutProbability,
      "replaySummary.maximumBlackoutProbability",
    ),
    maximumExpectedUnservedEnergyMwh: summaryMetric(
      summary?.maximumExpectedUnservedEnergyMwh,
      derived.maximumExpectedUnservedEnergyMwh,
      "replaySummary.maximumExpectedUnservedEnergyMwh",
    ),
    worstEventTimestamp: stringMetric(
      summary?.worstEventTimestamp,
      "replaySummary.worstEventTimestamp",
    ),
    totalExpectedUnservedEnergyMwh: summaryMetric(
      summary?.totalExpectedUnservedEnergyMwh,
      derived.totalExpectedUnservedEnergyMwh,
      "replaySummary.totalExpectedUnservedEnergyMwh",
    ),
    blackoutHours: summaryMetric(
      summary?.blackoutHours,
      derived.blackoutHours,
      "replaySummary.blackoutHours",
    ),
    sourceNotes: Array.isArray(summary?.sourceNotes) ? summary.sourceNotes : [],
    sources: Array.isArray(summary?.sources) ? summary.sources : [],
  };
}

type ReplaySummaryMetric =
  | "replayDurationHours"
  | "timelineEventCount"
  | "peakDemandMw"
  | "minimumDemandMw"
  | "averageDemandMw"
  | "peakGenerationMw"
  | "minimumGenerationMw"
  | "averageGenerationMw"
  | "peakRenewableGenerationMw"
  | "minimumRenewableGenerationMw"
  | "averageRenewableGenerationMw"
  | "peakGenerationShortageMw"
  | "maximumForcedOutageMw"
  | "maximumLoadShedMw"
  | "minimumReserveMarginPercent"
  | "maximumReserveMarginPercent"
  | "maximumBlackoutProbability"
  | "maximumExpectedUnservedEnergyMwh"
  | "totalExpectedUnservedEnergyMwh"
  | "blackoutHours";

function summaryMetric(
  summaryValue: number | null | undefined,
  derivedValue: number | undefined,
  field: string,
): number | typeof REPLAY_UNAVAILABLE {
  const value = safeNumber(summaryValue, field) ?? derivedValue;
  if (value === undefined) return REPLAY_UNAVAILABLE;
  return value;
}

function stringMetric(value: string | null | undefined, field: string): string {
  return safeString(value, field) ?? REPLAY_UNAVAILABLE;
}

function metricOrUnavailable(
  value: number | undefined,
  field: string,
): number | typeof REPLAY_UNAVAILABLE {
  return safeNumber(value, field) ?? REPLAY_UNAVAILABLE;
}

function safeNumber(value: number | null | undefined, field: string): number | undefined {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    logReplayFieldIssue(field, value);
    return undefined;
  }
  return value;
}

function safeString(value: string | null | undefined, field: string): string | undefined {
  if (value === null || value === undefined || value.trim().length === 0) {
    logReplayFieldIssue(field, value);
    return undefined;
  }
  return value;
}

function isUsableNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function logTexasReplayContextFields(details: Record<string, unknown>): void {
  console.info("Texas replay Gemini context fields", details);
}

function logReplaySummary(summary: unknown): void {
  console.info("Texas replay summary before Gemini context", summary);
}

function logReplayFieldIssue(field: string, value: unknown): void {
  console.warn("Texas replay Gemini context unavailable field", {
    field,
    value,
  });
}

function logControlRoomStage(stage: string, details?: Record<string, unknown>): void {
  console.info("Gemini control room pipeline", {
    stage,
    ...(details ?? {}),
  });
}

function logControlRoomException(error: unknown): void {
  console.error("Gemini control room exception", {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}
