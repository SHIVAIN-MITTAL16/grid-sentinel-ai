import { createFileRoute } from "@tanstack/react-router";
import { DigitalTwinDashboard } from "@/routes/digital-twin";

export const Route = createFileRoute("/grid-overview")({
  head: () => ({ meta: [{ title: "Grid Overview · Grid Sentinel AI" }] }),
  component: DigitalTwinDashboard,
});
