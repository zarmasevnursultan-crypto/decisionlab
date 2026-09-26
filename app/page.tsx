import { loadCase } from "@/lib/get-case.server";
import CaseClient from "./case-client";

export default async function Case001Page() {
  const caseBundle = await loadCase();
  return <CaseClient caseBundle={caseBundle} />;
}
