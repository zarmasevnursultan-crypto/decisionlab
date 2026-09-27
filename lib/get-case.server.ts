import "server-only";
import { generateCase } from "./generate-case.server";

// Used for a first visit without a restorable session; refresh is handled by app/page.
export async function loadCase(previousTitle = "") {
  return (await generateCase(previousTitle, "local")).bundle;
}
