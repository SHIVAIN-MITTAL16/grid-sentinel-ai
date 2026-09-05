import { createFileRoute } from "@tanstack/react-router";
import { GridEvidenceRoom } from "@/components/grid/grid-evidence-room";

export const Route = createFileRoute("/evidence-room")({
  head: () => ({
    meta: [
      { title: "Evidence Room · Grid Sentinel AI" },
      { name: "description", content: "Fuel optimisation, stock availability, energy distributions, model comparison and backend verification." },
    ],
  }),
  component: GridEvidenceRoom,
});
