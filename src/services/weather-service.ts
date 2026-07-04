const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const DEFAULT_TIMEZONE = "Asia/Kolkata";

export interface IndianStateCapital {
  readonly state: string;
  readonly capital: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface WeatherCurrentConditions {
  readonly observedAt: string;
  readonly temperatureCelsius: number;
  readonly apparentTemperatureCelsius: number;
  readonly relativeHumidityPercent: number;
  readonly precipitationMm: number;
  readonly rainMm: number;
  readonly showersMm: number;
  readonly cloudCoverPercent: number;
  readonly windSpeedKmh: number;
  readonly windDirectionDegrees: number;
  readonly windGustsKmh: number;
  readonly weatherCode: number;
  readonly weatherDescription: string;
  readonly isDay: boolean;
}

export interface WeatherHourlyPoint {
  readonly time: string;
  readonly temperatureCelsius: number;
  readonly apparentTemperatureCelsius: number;
  readonly relativeHumidityPercent: number;
  readonly precipitationProbabilityPercent: number;
  readonly precipitationMm: number;
  readonly cloudCoverPercent: number;
  readonly windSpeedKmh: number;
  readonly windGustsKmh: number;
  readonly weatherCode: number;
  readonly weatherDescription: string;
}

export interface CapitalWeatherData {
  readonly location: IndianStateCapital;
  readonly timezone: string;
  readonly fetchedAt: string;
  readonly current: WeatherCurrentConditions;
  readonly hourly: readonly WeatherHourlyPoint[];
}

export class WeatherServiceError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "WeatherServiceError";
  }
}

interface OpenMeteoCurrent {
  readonly time?: unknown;
  readonly temperature_2m?: unknown;
  readonly apparent_temperature?: unknown;
  readonly relative_humidity_2m?: unknown;
  readonly precipitation?: unknown;
  readonly rain?: unknown;
  readonly showers?: unknown;
  readonly cloud_cover?: unknown;
  readonly wind_speed_10m?: unknown;
  readonly wind_direction_10m?: unknown;
  readonly wind_gusts_10m?: unknown;
  readonly weather_code?: unknown;
  readonly is_day?: unknown;
}

interface OpenMeteoHourly {
  readonly time?: unknown;
  readonly temperature_2m?: unknown;
  readonly apparent_temperature?: unknown;
  readonly relative_humidity_2m?: unknown;
  readonly precipitation_probability?: unknown;
  readonly precipitation?: unknown;
  readonly cloud_cover?: unknown;
  readonly wind_speed_10m?: unknown;
  readonly wind_gusts_10m?: unknown;
  readonly weather_code?: unknown;
}

interface OpenMeteoResponse {
  readonly timezone?: unknown;
  readonly current?: OpenMeteoCurrent;
  readonly hourly?: OpenMeteoHourly;
}

export const INDIAN_STATE_CAPITALS: readonly IndianStateCapital[] = [
  { state: "Andhra Pradesh", capital: "Amaravati", latitude: 16.5062, longitude: 80.648 },
  { state: "Arunachal Pradesh", capital: "Itanagar", latitude: 27.0844, longitude: 93.6053 },
  { state: "Assam", capital: "Dispur", latitude: 26.1433, longitude: 91.7898 },
  { state: "Bihar", capital: "Patna", latitude: 25.5941, longitude: 85.1376 },
  { state: "Chhattisgarh", capital: "Raipur", latitude: 21.2514, longitude: 81.6296 },
  { state: "Goa", capital: "Panaji", latitude: 15.4909, longitude: 73.8278 },
  { state: "Gujarat", capital: "Gandhinagar", latitude: 23.2156, longitude: 72.6369 },
  { state: "Haryana", capital: "Chandigarh", latitude: 30.7333, longitude: 76.7794 },
  { state: "Himachal Pradesh", capital: "Shimla", latitude: 31.1048, longitude: 77.1734 },
  { state: "Jharkhand", capital: "Ranchi", latitude: 23.3441, longitude: 85.3096 },
  { state: "Karnataka", capital: "Bengaluru", latitude: 12.9716, longitude: 77.5946 },
  { state: "Kerala", capital: "Thiruvananthapuram", latitude: 8.5241, longitude: 76.9366 },
  { state: "Madhya Pradesh", capital: "Bhopal", latitude: 23.2599, longitude: 77.4126 },
  { state: "Maharashtra", capital: "Mumbai", latitude: 19.076, longitude: 72.8777 },
  { state: "Manipur", capital: "Imphal", latitude: 24.817, longitude: 93.9368 },
  { state: "Meghalaya", capital: "Shillong", latitude: 25.5788, longitude: 91.8933 },
  { state: "Mizoram", capital: "Aizawl", latitude: 23.7271, longitude: 92.7176 },
  { state: "Nagaland", capital: "Kohima", latitude: 25.6751, longitude: 94.1086 },
  { state: "Odisha", capital: "Bhubaneswar", latitude: 20.2961, longitude: 85.8245 },
  { state: "Punjab", capital: "Chandigarh", latitude: 30.7333, longitude: 76.7794 },
  { state: "Rajasthan", capital: "Jaipur", latitude: 26.9124, longitude: 75.7873 },
  { state: "Sikkim", capital: "Gangtok", latitude: 27.3314, longitude: 88.6138 },
  { state: "Tamil Nadu", capital: "Chennai", latitude: 13.0827, longitude: 80.2707 },
  { state: "Telangana", capital: "Hyderabad", latitude: 17.385, longitude: 78.4867 },
  { state: "Tripura", capital: "Agartala", latitude: 23.8315, longitude: 91.2868 },
  { state: "Uttar Pradesh", capital: "Lucknow", latitude: 26.8467, longitude: 80.9462 },
  { state: "Uttarakhand", capital: "Dehradun", latitude: 30.3165, longitude: 78.0322 },
  { state: "West Bengal", capital: "Kolkata", latitude: 22.5726, longitude: 88.3639 },
];

/**
 * Fetches current and near-term hourly weather for every predefined Indian state capital.
 */
export async function fetchIndianStateCapitalWeather(): Promise<readonly CapitalWeatherData[]> {
  return Promise.all(INDIAN_STATE_CAPITALS.map((capital) => fetchCapitalWeather(capital)));
}

/**
 * Fetches current and hourly weather for one predefined capital.
 */
export async function fetchWeatherByState(state: string): Promise<CapitalWeatherData> {
  const capital = INDIAN_STATE_CAPITALS.find(
    (candidate) => candidate.state.toLowerCase() === state.trim().toLowerCase(),
  );

  if (!capital) {
    throw new WeatherServiceError(`No predefined Indian state capital found for state: ${state}`);
  }

  return fetchCapitalWeather(capital);
}

/**
 * Fetches weather from Open-Meteo for a single state capital.
 */
export async function fetchCapitalWeather(
  capital: IndianStateCapital,
): Promise<CapitalWeatherData> {
  const url = buildForecastUrl(capital);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new WeatherServiceError(
        `Open-Meteo request failed for ${capital.capital}, ${capital.state}: ${response.status} ${response.statusText}`,
      );
    }

    const payload = (await response.json()) as OpenMeteoResponse;
    return parseOpenMeteoResponse(payload, capital);
  } catch (error) {
    if (error instanceof WeatherServiceError) throw error;
    throw new WeatherServiceError(
      `Unable to fetch weather for ${capital.capital}, ${capital.state}`,
      error,
    );
  }
}

function buildForecastUrl(capital: IndianStateCapital): string {
  const params = new URLSearchParams({
    latitude: String(capital.latitude),
    longitude: String(capital.longitude),
    timezone: DEFAULT_TIMEZONE,
    forecast_days: "2",
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "precipitation",
      "rain",
      "showers",
      "weather_code",
      "cloud_cover",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
    ].join(","),
    hourly: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "precipitation_probability",
      "precipitation",
      "weather_code",
      "cloud_cover",
      "wind_speed_10m",
      "wind_gusts_10m",
    ].join(","),
  });

  return `${OPEN_METEO_FORECAST_URL}?${params.toString()}`;
}

function parseOpenMeteoResponse(
  payload: OpenMeteoResponse,
  capital: IndianStateCapital,
): CapitalWeatherData {
  if (!payload.current || !payload.hourly) {
    throw new WeatherServiceError(
      `Open-Meteo response is missing weather data for ${capital.capital}`,
    );
  }

  return {
    location: capital,
    timezone: readString(payload.timezone, "timezone"),
    fetchedAt: new Date().toISOString(),
    current: parseCurrentConditions(payload.current),
    hourly: parseHourlyForecast(payload.hourly),
  };
}

function parseCurrentConditions(current: OpenMeteoCurrent): WeatherCurrentConditions {
  const weatherCode = readNumber(current.weather_code, "current.weather_code");

  return {
    observedAt: readString(current.time, "current.time"),
    temperatureCelsius: readNumber(current.temperature_2m, "current.temperature_2m"),
    apparentTemperatureCelsius: readNumber(
      current.apparent_temperature,
      "current.apparent_temperature",
    ),
    relativeHumidityPercent: readNumber(
      current.relative_humidity_2m,
      "current.relative_humidity_2m",
    ),
    precipitationMm: readNumber(current.precipitation, "current.precipitation"),
    rainMm: readNumber(current.rain, "current.rain"),
    showersMm: readNumber(current.showers, "current.showers"),
    cloudCoverPercent: readNumber(current.cloud_cover, "current.cloud_cover"),
    windSpeedKmh: readNumber(current.wind_speed_10m, "current.wind_speed_10m"),
    windDirectionDegrees: readNumber(current.wind_direction_10m, "current.wind_direction_10m"),
    windGustsKmh: readNumber(current.wind_gusts_10m, "current.wind_gusts_10m"),
    weatherCode,
    weatherDescription: describeWeatherCode(weatherCode),
    isDay: readNumber(current.is_day, "current.is_day") === 1,
  };
}

function parseHourlyForecast(hourly: OpenMeteoHourly): readonly WeatherHourlyPoint[] {
  const time = readStringArray(hourly.time, "hourly.time");
  const temperature = readNumberArray(hourly.temperature_2m, "hourly.temperature_2m");
  const apparentTemperature = readNumberArray(
    hourly.apparent_temperature,
    "hourly.apparent_temperature",
  );
  const humidity = readNumberArray(hourly.relative_humidity_2m, "hourly.relative_humidity_2m");
  const precipitationProbability = readNumberArray(
    hourly.precipitation_probability,
    "hourly.precipitation_probability",
  );
  const precipitation = readNumberArray(hourly.precipitation, "hourly.precipitation");
  const cloudCover = readNumberArray(hourly.cloud_cover, "hourly.cloud_cover");
  const windSpeed = readNumberArray(hourly.wind_speed_10m, "hourly.wind_speed_10m");
  const windGusts = readNumberArray(hourly.wind_gusts_10m, "hourly.wind_gusts_10m");
  const weatherCode = readNumberArray(hourly.weather_code, "hourly.weather_code");

  return time.map((value, index) => {
    const code = readArrayValue(weatherCode, index, "hourly.weather_code");

    return {
      time: value,
      temperatureCelsius: readArrayValue(temperature, index, "hourly.temperature_2m"),
      apparentTemperatureCelsius: readArrayValue(
        apparentTemperature,
        index,
        "hourly.apparent_temperature",
      ),
      relativeHumidityPercent: readArrayValue(humidity, index, "hourly.relative_humidity_2m"),
      precipitationProbabilityPercent: readArrayValue(
        precipitationProbability,
        index,
        "hourly.precipitation_probability",
      ),
      precipitationMm: readArrayValue(precipitation, index, "hourly.precipitation"),
      cloudCoverPercent: readArrayValue(cloudCover, index, "hourly.cloud_cover"),
      windSpeedKmh: readArrayValue(windSpeed, index, "hourly.wind_speed_10m"),
      windGustsKmh: readArrayValue(windGusts, index, "hourly.wind_gusts_10m"),
      weatherCode: code,
      weatherDescription: describeWeatherCode(code),
    };
  });
}

function readString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new WeatherServiceError(`Open-Meteo response field ${fieldName} is not a string`);
  }
  return value;
}

function readNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new WeatherServiceError(`Open-Meteo response field ${fieldName} is not a number`);
  }
  return value;
}

function readStringArray(value: unknown, fieldName: string): readonly string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new WeatherServiceError(`Open-Meteo response field ${fieldName} is not a string array`);
  }
  return value;
}

function readNumberArray(value: unknown, fieldName: string): readonly number[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "number" && !Number.isNaN(item))
  ) {
    throw new WeatherServiceError(`Open-Meteo response field ${fieldName} is not a number array`);
  }
  return value;
}

function readArrayValue(values: readonly number[], index: number, fieldName: string): number {
  const value = values[index];
  if (value === undefined) {
    throw new WeatherServiceError(
      `Open-Meteo response field ${fieldName} is missing index ${index}`,
    );
  }
  return value;
}

function describeWeatherCode(code: number): string {
  const descriptions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };

  return descriptions[code] ?? `Unknown weather code ${code}`;
}
