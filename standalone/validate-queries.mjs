/**
 * Validates every GraphQL document in the UI against the executable schema.
 *
 * The build and tsc cannot see inside a gql template, so a field renamed in the
 * schema shows up only when a user opens the page. This closes that gap.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { parse, validate } from "graphql";

await build({
  entryPoints: ["src/mocks/schema-v2.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: "./.validate-bundle.mjs",
  loader: { ".json": "json" },
  external: ["graphql", "@graphql-tools/schema"],
  logLevel: "silent",
});
const { schemaV2 } = await import("./.validate-bundle.mjs?t=" + Date.now());

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|ts)$/.test(p)) files.push(p);
  }
})("src");

// gql`...` literals, minus the ${FRAGMENT} interpolations we splice back in.
const FRAGMENT_RE = /const\s+(\w+)\s*=\s*gql`([\s\S]*?)`;/g;
const fragments = new Map();
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(FRAGMENT_RE)) {
    if (m[2].includes("fragment ")) fragments.set(m[1], m[2]);
  }
}

let checked = 0;
let failed = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/gql`([\s\S]*?)`;/g)) {
    let body = m[1];
    if (body.includes("fragment ") && !body.includes("query") && !body.includes("mutation"))
      continue;
    // Splice in any ${FRAGMENT} this document interpolates.
    body = body.replace(/\$\{(\w+)\}/g, (_, name) => fragments.get(name) ?? "");
    let doc;
    try {
      doc = parse(body);
    } catch (e) {
      console.log(`  PARSE  ${f}: ${e.message.split("\n")[0]}`);
      failed += 1;
      continue;
    }
    const errors = validate(schemaV2, doc);
    checked += 1;
    const op = body.match(/(query|mutation)\s+(\w+)/);
    const label = op ? `${op[1]} ${op[2]}` : "anonymous";
    if (errors.length) {
      failed += 1;
      console.log(`  FAIL   ${label}  (${f})`);
      for (const e of errors.slice(0, 4)) console.log(`         ${e.message}`);
    } else {
      console.log(`  ok     ${label}`);
    }
  }
}

console.log(`\n${checked} documents checked, ${failed} invalid\n`);
process.exit(failed ? 1 : 0);
