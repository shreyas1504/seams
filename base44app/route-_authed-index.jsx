import { createFileRoute } from "@tanstack/react-router";
import SeamsApp from "@/components/seams/SeamsApp";
import { explainIssue, explainIssuePublic, askSeams, askSeamsPublic } from "@/lib/server-fns";

// The Seams bundle reaches the AI through these two globals. Signed-in visitors use the functions
// that also have the Base44 AI gateway; anyone else falls back to the public ones (Nemotron).
async function signedInOrPublic(signedIn, open, payload) {
  try {
    return await signedIn({ data: payload });
  } catch {
    return await open({ data: payload });
  }
}
if (typeof window !== "undefined") {
  globalThis.__seamsExplainIssue = (payload) => signedInOrPublic(explainIssue, explainIssuePublic, payload);
  globalThis.__seamsAsk = (payload) => signedInOrPublic(askSeams, askSeamsPublic, payload);
}

export const Route = createFileRoute("/_authed/")({
  head: () => ({ meta: [{ title: "Seams · Nothing Slips Through" }] }),
  component: SeamsApp,
});
