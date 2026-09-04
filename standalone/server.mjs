/**
 * Local OPTIMA stand-in for n8n.
 *
 * Serves the same executable schema the UI uses, over HTTP, plus a thin
 * `/api/tool/:code` wrapper that mimics the cortex gateway's tool convention.
 * That means the v2 workflow can point at this instead of the live gateway and
 * run end to end against the local v2 teams — same operations, same request
 * shapes, no production access required.
 *
 *   node server.mjs            → http://localhost:4000
 *   POST /graphql              → the schema directly
 *   POST /api/tool/T-0001      → gateway-shaped tool call
 */
import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { build } from "esbuild";
import { readFileSync, existsSync, unlinkSync } from "node:fs";

const PORT = Number(process.env.PORT ?? 4000);
const BUNDLE = "./.schema-bundle.mjs";

// The schema is TypeScript; bundle it once so node can import it.
await build({
  entryPoints: ["src/mocks/schema-v2.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: BUNDLE,
  loader: { ".json": "json" },
  external: ["graphql", "@graphql-tools/schema"],
  logLevel: "silent",
});
const { schemaV2 } = await import(BUNDLE + `?t=${Date.now()}`);

/**
 * Gateway tool codes → the operation each one runs.
 * Mirrors how the real gateway resolves a component code to a stored operation,
 * so the workflow's node bodies need no changes.
 */
const TOOLS = {
  "T-0001": {
    name: "assignmentUnassignedEntities",
    query: `mutation ($input: UnassignedEntitiesInput!) {
      assignmentUnassignedEntities(input: $input) {
        branchId facilityId workItemType
        workItems { id priority encounterType department claimStatus startDate net insurancePayer }
      }
    }`,
  },
  "T-0002": {
    name: "optimaTeams",
    query: `query ($filter: OptimaTeamFilterInput) {
      optimaTeams(filter: $filter) {
        id name active division encounterScope logicAxis facilityId
        branches { id name healthLicense }
        groups {
          id name active workItemTypes encounterScope
          departments payers payerCatchAll claimStatuses
          members { id firstName lastName }
        }
      }
    }`,
  },
  "T-0003": {
    name: "usersWorkTypeAssignedCounts",
    query: `query ($userIds: [ID!]!, $workItemTypes: [String!], $fromDate: String, $toDate: String) {
      usersWorkTypeAssignedCounts(
        userIds: $userIds, workItemTypes: $workItemTypes, fromDate: $fromDate, toDate: $toDate
      ) { userId assigned workItemType }
    }`,
  },
  "T-004": {
    name: "effectiveAssignmentSettings",
    query: `query ($teamId: ID, $userIds: [ID!]!) {
      effectiveAssignmentSettings(teamId: $teamId, userIds: $userIds) {
        userId teamId maxClaim maxAuth source
      }
    }`,
  },
  "T-0005": {
    name: "assignWorkItems",
    query: `mutation ($input: AssignWorkItemsInput!) {
      assignWorkItems(input: $input) { success message totalCount }
    }`,
  },
};

const yoga = createYoga({ schema: schemaV2, graphqlEndpoint: "/graphql", logging: false });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Local demo server: allow any origin so the UI and n8n can both call it.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, x-api-key, authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // Gateway-shaped tool endpoint: POST /api/tool/T-0001 with the variables as the body.
  if (url.pathname.startsWith("/api/tool/") && req.method === "POST") {
    const code = url.pathname.split("/").pop();
    // Component codes may be suffixed (e.g. "T-0001-abc"); match on prefix.
    const key = Object.keys(TOOLS).find((k) => code === k || code?.startsWith(k));
    if (!key) {
      res.writeHead(404, { "content-type": "application/json" });
      return res.end(JSON.stringify({ errors: [{ message: `Unknown tool code: ${code}` }] }));
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let variables = {};
    try {
      variables = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      return res.end(JSON.stringify({ errors: [{ message: "Body is not valid JSON" }] }));
    }

    const { graphql } = await import("graphql");
    const result = await graphql({
      schema: schemaV2,
      source: TOOLS[key].query,
      variableValues: variables,
    });
    process.stdout.write(
      `  ${key.padEnd(7)} ${TOOLS[key].name.padEnd(30)} ` +
        (result.errors ? `ERROR ${result.errors[0].message}` : "ok") +
        "\n"
    );
    res.writeHead(result.errors ? 400 : 200, { "content-type": "application/json" });
    return res.end(JSON.stringify(result));
  }

  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: true, tools: Object.keys(TOOLS) }));
  }

  return yoga(req, res);
});

// Listen on :: (all interfaces, IPv4 *and* IPv6). Node dual-stacks this by default,
// which matters because clients resolving "localhost" often try ::1 first — binding
// 0.0.0.0 alone gives them ECONNREFUSED on ::1.
// A stale server from a previous run holds the port and n8n then gets ECONNREFUSED
// against a half-dead process. Fail with an actionable message instead of a stack trace.
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`
Port ${PORT} is already in use — another copy of this server is running.`);
    console.error(`Stop it, then start again:`);
    console.error(`  Windows : npx kill-port ${PORT}`);
    console.error(`  or      : netstat -ano | findstr :${PORT}   then  taskkill /PID <pid> /F`);
    console.error(`Or run on a different port:  PORT=4001 node server.mjs
`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, "::", () => {
  console.log(`local OPTIMA stand-in on http://localhost:${PORT}`);
  console.log(`  POST /graphql              schema directly`);
  console.log(`  POST /api/tool/{code}      ${Object.keys(TOOLS).join(", ")}`);
  console.log(``);
  console.log(`  n8n on this machine   -> http://localhost:${PORT}/api/tool`);
  console.log(`  n8n in Docker         -> http://host.docker.internal:${PORT}/api/tool`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    if (existsSync(BUNDLE)) unlinkSync(BUNDLE);
    server.close(() => process.exit(0));
  });
}
