# Texas Uri Replay Data

Place authentic historical datasets for the February 2021 ERCOT Winter Storm Uri replay in this folder.

Loaded benchmark files:

- `ercot_load.csv`
- `ercot_generation.csv`
- `noaa_weather.csv`
- `ercot_alerts.csv`
- `ferc_validation.pdf`

The loader intentionally does not synthesize, estimate, or interpolate missing observations.
Outage, load-shed, and frequency observations remain unavailable unless those fields are present in a loaded benchmark file.
