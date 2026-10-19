create table if not exists public.pre_crisis_alerts (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  created_at timestamptz not null default now(),
  generated_at timestamptz not null,
  projected_probability_percent numeric not null check (projected_probability_percent >= 0 and projected_probability_percent <= 100),
  threshold_percent numeric not null check (threshold_percent >= 0 and threshold_percent <= 100),
  horizon_hours integer not null check (horizon_hours > 0),
  highest_risk_state text not null,
  forecast_hazard_score numeric not null check (forecast_hazard_score >= 0 and forecast_hazard_score <= 100),
  model_notice text not null,
  notification_status text not null default 'not_sent' check (notification_status in ('not_sent', 'pending', 'sent', 'failed')),
  provider_message_id text
);

alter table public.pre_crisis_alerts enable row level security;
