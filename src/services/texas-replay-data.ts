import type { TexasReplayInput, TexasReplayRecord } from "./texas-replay";

type RawDatasetMap = Record<string, string>;
type Row = Record<string, string>;

const rawDatasets = import.meta.glob("../data/texas-uri/*.{csv,json,pdf}", {
  eager: true,
  query: "?raw",
  import: "default",
}) as RawDatasetMap;

const REQUIRED_DATASETS = [
  "ercot_load.csv",
  "ercot_generation.csv",
  "noaa_weather.csv",
  "ercot_alerts.csv",
  "ferc_validation.pdf",
] as const;

export function getTexasReplayInput(): TexasReplayInput {
  const records = mergeRecords([
    readSystemDemand(),
    readGenerationByFuel(),
    readForcedOutages(),
    readLoadShed(),
    readFrequency(),
    readEmergencyAlerts(),
    readWeather(),
  ]);

  return {
    metadata: {
      eventName: "Texas Winter Storm Uri - ERCOT February 2021",
      timezone: "America/Chicago",
      resolution: "source-file native",
      sourceNotes: [
        "This loader reads only datasets placed in src/data/texas-uri/.",
        "Benchmark CSV values are loaded as provided; optional outage, load-shed, and frequency CSVs are preferred when present.",
        "When optional telemetry is absent, the replay engine derives deterministic unserved load, forced outage, and frequency from loaded demand and generation.",
        "FERC validation PDF is tracked as a source document, not parsed into hourly telemetry.",
      ],
      sources: listLoadedDatasetNames(),
      missingDatasets: listMissingDatasetNames(),
    },
    records,
  };
}

function readSystemDemand(): readonly Partial<TexasReplayRecord>[] {
  return readCsv("ercot_load.csv").map((row) => ({
    timestamp: readTimestamp(row),
    demandMw: readNumber(row, ["demandMw", "demand_mw", "loadMw", "load_mw", "demand"]),
  }));
}

function readGenerationByFuel(): readonly Partial<TexasReplayRecord>[] {
  return readCsv("ercot_generation.csv").map((row) => {
    const generationByFuel = {
      gasMw: readNumber(row, ["gasMw", "gas_mw", "naturalGasMw", "natural_gas_mw"]),
      coalMw: readNumber(row, ["coalMw", "coal_mw"]),
      nuclearMw: readNumber(row, ["nuclearMw", "nuclear_mw"]),
      windMw: readNumber(row, ["windMw", "wind_mw"]),
      solarMw: readNumber(row, ["solarMw", "solar_mw"]),
      hydroMw: readNumber(row, ["hydroMw", "hydro_mw"]),
      otherMw: readNumber(row, ["otherMw", "other_mw"]),
    };

    return {
      timestamp: readTimestamp(row),
      generationMw:
        readNumber(row, [
          "generationMw",
          "generation_mw",
          "totalGenerationMw",
          "total_generation_mw",
        ]) ?? sumDefined(generationByFuel),
      renewableGenerationMw:
        readNumber(row, ["renewableGenerationMw", "renewable_generation_mw"]) ??
        sumDefined({
          windMw: generationByFuel.windMw,
          solarMw: generationByFuel.solarMw,
          hydroMw: generationByFuel.hydroMw,
        }),
      generationByFuel,
    };
  });
}

function readForcedOutages(): readonly Partial<TexasReplayRecord>[] {
  return readCsv("ercot_forced_outages.csv").map((row) => ({
    timestamp: readTimestamp(row),
    forcedOutageMw: readNumber(row, [
      "forcedOutageMw",
      "forced_outage_mw",
      "outageMw",
      "outage_mw",
    ]),
  }));
}

function readLoadShed(): readonly Partial<TexasReplayRecord>[] {
  return readCsv("ercot_load_shed.csv").map((row) => ({
    timestamp: readTimestamp(row),
    loadShedMw: readNumber(row, ["loadShedMw", "load_shed_mw", "shedMw", "shed_mw"]),
  }));
}

function readFrequency(): readonly Partial<TexasReplayRecord>[] {
  return readCsv("ercot_frequency.csv").map((row) => ({
    timestamp: readTimestamp(row),
    frequencyHz: readNumber(row, ["frequencyHz", "frequency_hz", "hz"]),
  }));
}

function readEmergencyAlerts(): readonly Partial<TexasReplayRecord>[] {
  return readCsv("ercot_alerts.csv").map((row) => {
    const event = readString(row, ["event", "majorEvent", "major_event", "alert"]);
    const message = readString(row, ["message", "description", "notice"]);

    return {
      timestamp: readTimestamp(row),
      majorEvent: [event, message].filter(Boolean).join(" - ") || undefined,
    };
  });
}

function readWeather(): readonly Partial<TexasReplayRecord>[] {
  return readCsv("noaa_weather.csv").map((row) => ({
    timestamp: readTimestamp(row),
    weatherStation: readString(row, ["station", "station_id", "stationName", "station_name"]),
    temperatureCelsius: readNumber(row, [
      "temperatureCelsius",
      "temperature_celsius",
      "temperature_c",
      "tempC",
      "temp_c",
    ]),
    windSpeedKmh: readNumber(row, ["windSpeedKmh", "wind_speed_kmh", "wind_kmh"]),
    precipitationMm: readNumber(row, ["precipitationMm", "precipitation_mm", "precip_mm"]),
  }));
}

function mergeRecords(
  groups: readonly (readonly Partial<TexasReplayRecord>[])[],
): readonly TexasReplayRecord[] {
  const byTimestamp = new Map<string, Partial<TexasReplayRecord>>();

  for (const group of groups) {
    for (const record of group) {
      if (!record.timestamp) continue;
      byTimestamp.set(record.timestamp, { ...byTimestamp.get(record.timestamp), ...record });
    }
  }

  return [...byTimestamp.values()]
    .filter((record): record is TexasReplayRecord => typeof record.timestamp === "string")
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function readCsv(fileName: string): readonly Row[] {
  const raw = readRawDataset(fileName);
  if (!raw) return [];

  const [headerLine, ...lines] = raw.trim().split(/\r?\n/);
  if (!headerLine) return [];

  const headers = parseCsvLine(headerLine).map(normalizeKey);
  return lines
    .filter((line) => line.trim().length > 0)
    .map((line) => toRow(headers, parseCsvLine(line)));
}

function readRawDataset(fileName: string): string | undefined {
  const key = findDatasetKey(fileName);
  return key ? rawDatasets[key] : undefined;
}

function hasRawDataset(fileName: string): boolean {
  return findDatasetKey(fileName) !== undefined;
}

function findDatasetKey(fileName: string): string | undefined {
  return Object.keys(rawDatasets).find(
    (path) => path.endsWith(`/${fileName}`) || path.endsWith(`\\${fileName}`),
  );
}

function toRow(headers: readonly string[], values: readonly string[]): Row {
  return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]));
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function readTimestamp(row: Row): string | undefined {
  return readString(row, ["timestamp", "time", "datetime", "interval_start", "delivery_interval"]);
}

function readString(row: Row, keys: readonly string[]): string | undefined {
  for (const key of keys.map(normalizeKey)) {
    const value = row[key];
    if (value) return value;
  }
  return undefined;
}

function readNumber(row: Row, keys: readonly string[]): number | undefined {
  const value = readString(row, keys);
  if (!value) return undefined;
  const numeric = Number(value.replaceAll(",", ""));
  return Number.isFinite(numeric) ? numeric : undefined;
}

function sumDefined(values: Record<string, number | undefined>): number | undefined {
  const numbers = Object.values(values).filter((value): value is number => value !== undefined);
  return numbers.length > 0 ? numbers.reduce((total, value) => total + value, 0) : undefined;
}

function listLoadedDatasetNames(): readonly string[] {
  return REQUIRED_DATASETS.filter(hasRawDataset);
}

function listMissingDatasetNames(): readonly string[] {
  return REQUIRED_DATASETS.filter((name) => !hasRawDataset(name));
}

function normalizeKey(key: string): string {
  return key
    .trim()
    .replace(/^\uFEFF/, "")
    .replaceAll(/\s+/g, "_")
    .toLowerCase();
}
