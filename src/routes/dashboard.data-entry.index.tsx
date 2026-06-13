import { createFileRoute } from "@tanstack/react-router";
import { DataEntryPage } from "./dashboard.data-entry";

export const Route = createFileRoute("/dashboard/data-entry/")({
  component: DataEntryPage,
});
