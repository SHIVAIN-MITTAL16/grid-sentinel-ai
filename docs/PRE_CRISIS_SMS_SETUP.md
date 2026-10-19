# Grid Sentinel AI — Pre-crisis SMS module

## Operating mode

- Checks are manual only. No cron, scheduler, deployment setting, or background monitor is configured.
- The check combines live Open-Meteo forecast conditions with the existing seeded Monte Carlo baseline.
- A projected shortfall-risk estimate at or above 20% is recorded as an alert.
- The forecast adjustment is a heuristic. It is not a calibrated probability until validated against historical grid telemetry and known events.
- The risk-check route does not send SMS. The MSG91 adapter is separate and is not called by the manual check.
- Do not enable or call real SMS sending without separate explicit confirmation in the project conversation.

## Supabase setup

Create a Supabase project and run this SQL in its SQL editor:

    create table if not exists public.pre_crisis_alerts (
      id uuid primary key default gen_random_uuid(),
      event_key text not null unique,
      created_at timestamptz not null default now(),
      generated_at timestamptz not null,
      projected_probability_percent numeric not null,
      threshold_percent numeric not null,
      horizon_hours integer not null,
      highest_risk_state text not null,
      forecast_hazard_score numeric not null,
      model_notice text not null,
      notification_status text not null default 'not_sent'
        check (notification_status in ('not_sent', 'pending', 'sent', 'failed')),
      provider_message_id text
    );

    alter table public.pre_crisis_alerts enable row level security;

The server uses the Supabase REST API with the service-role key. Keep that key in server-only environment configuration; never expose it in VITE_* variables or client-side code. The service-role key bypasses RLS, so do not expose the storage service to the browser directly.

Required server environment variables:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

## MSG91 preparation

The adapter expects server-side variables:
- MSG91_AUTH_KEY
- MSG91_TEMPLATE_ID
- MSG91_SENDER_ID
- PRECRISIS_SMS_SEND_ENABLED (must remain unset or false until separately approved)

For Indian domestic SMS, complete applicable DLT entity, sender/header and approved-template requirements with the provider. Do not place real credentials in source control.

## Manual workflow

1. Open Pre-crisis Alerts.
2. Select Run early-warning check.
3. Review the estimated risk, forecast horizon and model notice.
4. When the 20% threshold is crossed, the event is saved with a deterministic key to avoid duplicate records within the same hour.
5. SMS delivery is not attempted by this check. A real SMS test requires separate explicit confirmation.

## Validation limitations

The current grid model is a digital-twin estimate and does not provide live SCADA/PMU telemetry or a production-grade shortfall-probability calibration. Do not use the displayed risk estimate as a sole operational dispatch or emergency decision.
