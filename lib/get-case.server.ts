import "server-only";
import { generateLocalCase } from "./local-case-generator.server";
import { registerLocalCase } from "./local-cases.server";

// Used for a first visit without a restorable session; refresh is handled by app/page.
export async function loadCase(previousTitle = "") {
  return registerLocalCase(generateLocalCase(previousTitle));
}
