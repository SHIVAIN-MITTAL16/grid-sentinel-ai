export interface PreCrisisAlertRecord {
  readonly id?: string;
  readonly event_key: string;
  readonly created_at?: string;
  readonly generated_at: string;
  readonly projected_probability_percent: number;
  readonly threshold_percent: number;
  readonly horizon_hours: number;
  readonly highest_risk_state: string;
  readonly forecast_hazard_score: number;
  readonly model_notice: string;
  readonly notification_status: "not_sent" | "pending" | "sent" | "failed";
  readonly provider_message_id?: string | null;
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.");
  return { url: url.replace(/\/$/, ""), key };
}

export async function savePreCrisisAlert(record: PreCrisisAlertRecord): Promise<PreCrisisAlertRecord> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(url + "/rest/v1/pre_crisis_alerts?on_conflict=event_key", {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify(record),
  });
  if (!response.ok) throw new Error("Supabase alert write failed (" + response.status + "). Check the table schema and server credentials.");
  const rows = await response.json() as PreCrisisAlertRecord[];
  return rows[0] ?? record;
}

export async function listPreCrisisAlerts(limit = 20): Promise<PreCrisisAlertRecord[]> {
  const { url, key } = getSupabaseConfig();
  const boundedLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const response = await fetch(url + "/rest/v1/pre_crisis_alerts?select=*&order=created_at.desc&limit=" + boundedLimit, {
    headers: { apikey: key, Authorization: "Bearer " + key },
  });
  if (!response.ok) throw new Error("Supabase alert history read failed (" + response.status + ").");
  return await response.json() as PreCrisisAlertRecord[];
}
