/**
 * POSTs a run to the workflow's webhook in a real n8n.
 *
 * Two modes, because where n8n runs decides what it can reach:
 *
 *   fixture  the payload carries every tool response, so n8n calls nothing.
 *            Works with hosted n8n, no tunnel, nothing exposed.
 *   live     n8n calls the local gateway at `--gateway`. Needs n8n and the
 *            gateway to be mutually reachable, so either n8n is on this
 *            machine or the gateway is behind a tunnel.
 *
 *   node workflow/post-to-n8n.mjs <webhook-url>
 *   node workflow/post-to-n8n.mjs <webhook-url> --live --gateway https://x.trycloudflare.com/api/tool
 *   node workflow/post-to-n8n.mjs <webhook-url> --commit      # lets T-0005 fire
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(here, "..", "..", "docs", "n8n-fixture-payload-v3.json");

const args = process.argv.slice(2);
const url = args.find((a) => a.startsWith("http"));
const live = args.includes("--live");
const commit = args.includes("--commit");
const gateway = args[args.indexOf("--gateway") + 1];

if (!url) {
  console.log("usage: node workflow/post-to-n8n.mjs <webhook-url> [--live --gateway <url>] [--commit]");
  process.exit(1);
}
if (live && (!gateway || !gateway.startsWith("http"))) {
  console.log("--live needs --gateway <url>, the address n8n can reach the gateway on.");
  process.exit(1);
}

/*
 * Refuse to commit in fixture mode.
 *
 * The four read tools are gated, but Step 4 - Assign is not: it always makes a
 * real HTTP call. Fixture mode drops gatewayBaseUrl, so that call falls back to
 * the node's default, which is the production gateway. Committing without an
 * explicit gateway would therefore write to production from a run that looks
 * entirely local.
 */
if (commit && !live) {
  console.log("Refusing: --commit needs --live --gateway <url>.\n");
  console.log("  Step 4 - Assign has no fixture, so it always calls a real gateway.");
  console.log("  Without --gateway it falls back to the production default in the");
  console.log("  node, and a run that looks local would write to production.");
  process.exit(1);
}

if (!fs.existsSync(FIXTURE)) {
  console.log(`missing ${path.basename(FIXTURE)}. Run: node server.mjs, then npm run simulate`);
  process.exit(1);
}
const payload = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));

// dryRun defaults on. T-0005 is the only step that writes, so committing is
// always something you ask for rather than something you forget to turn off.
payload.dryRun = !commit;

if (live) {
  // extractInfo reads `fixtures ?? null`, and the Fixtures? gates branch on
  // it being non-null, so dropping the key is what puts the run on HTTP.
  delete payload.fixtures;
  payload.gatewayBaseUrl = gateway;
} else {
  delete payload.gatewayBaseUrl;
}

const size = Math.round(JSON.stringify(payload).length / 1024);
console.log(`mode     ${live ? `live, gateway ${gateway}` : "fixture, n8n calls nothing"}`);
console.log(`dryRun   ${payload.dryRun}${commit ? "  (T-0005 WILL write)" : ""}`);
console.log(`payload  ${size} KB`);
console.log(`posting  ${url}\n`);

const started = Date.now();
const res = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json", "x-correlation-id": `local-${Date.now()}` },
  body: JSON.stringify(payload),
});
const text = await res.text();
const secs = ((Date.now() - started) / 1000).toFixed(1);

console.log(`HTTP ${res.status} in ${secs}s`);
let json;
try {
  json = JSON.parse(text);
} catch {
  console.log(text.slice(0, 1500));
  process.exit(res.ok ? 0 : 1);
}

const t = json.totals ?? json;
if (t.ranked != null) {
  console.log(`\nranked ${t.ranked} · matched ${t.matched} · assigned ${t.assigned} · unmatched ${t.unmatched} · overflow ${t.overflow}`);
}
if (Array.isArray(json.byGroup)) {
  console.log("\nby group:");
  for (const g of json.byGroup.slice(0, 8)) console.log(`  ${String(g.matched).padStart(4)}  ${g.group ?? g.groupName}`);
}
if (!t.ranked) console.log(JSON.stringify(json, null, 1).slice(0, 1500));
process.exit(res.ok ? 0 : 1);
