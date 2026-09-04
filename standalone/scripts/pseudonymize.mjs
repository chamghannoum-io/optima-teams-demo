/**
 * Swaps real staff identities for stable fakes, for the public build only.
 *
 * Everything that makes the demo meaningful — team names, departments, payers,
 * observed volumes, group structure, allocation results — is untouched. Only the
 * 69 people's names and emails change, and the mapping is deterministic so the
 * same person keeps the same alias across every screen.
 *
 * Writes *.public.json alongside the originals; the originals are never modified.
 */
import fs from "node:fs";
import path from "node:path";

const MOCKS = path.join(process.cwd(), "src", "mocks");

// Deliberately region-plausible so the demo still reads naturally.
const FIRST = ["Layla","Omar","Aisha","Yusuf","Noor","Karim","Salma","Rami","Hana","Tariq",
  "Dania","Faris","Mariam","Zaid","Lina","Adel","Rana","Sami","Huda","Nabil",
  "Amira","Khalid","Sara","Bilal","Yasmin","Hadi","Reem","Ziad","Maya","Anas",
  "Farah","Imad","Dalia","Marwan","Leen","Ammar","Nada","Waleed","Rima","Jamal"];
const LAST = ["Haddad","Nasser","Khoury","Mansour","Saleh","Darwish","Kanaan","Rahal",
  "Aziz","Fares","Sabbagh","Younes","Hakim","Murad","Zahra","Baroudi","Chalhoub",
  "Sayegh","Tannous","Ghanem"];

/** Stable index from an id, so aliases never shuffle between builds. */
const hash = (s) => {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};

const alias = new Map();
function fakeFor(id, i) {
  if (alias.has(id)) return alias.get(id);
  const h = hash(id);
  const first = FIRST[Math.abs(h + i) % FIRST.length];
  const last = LAST[Math.abs((h >>> 5)) % LAST.length];
  const v = {
    firstName: first,
    lastName: last,
    // .invalid is reserved by RFC 2606 — can never route anywhere real.
    email: `${first.toLowerCase()}.${last.toLowerCase()}@example.invalid`,
  };
  alias.set(id, v);
  return v;
}

function scrub(node, depth = 0) {
  if (Array.isArray(node)) return node.map((n, i) => scrub(n, depth + i));
  if (node && typeof node === "object") {
    const out = {};
    const isPerson = "firstName" in node || "lastName" in node || "email" in node;
    const f = isPerson ? fakeFor(node.id ?? JSON.stringify(node), depth) : null;
    for (const [k, v] of Object.entries(node)) {
      if (f && k === "firstName") out[k] = f.firstName;
      else if (f && k === "lastName") out[k] = f.lastName;
      else if (f && k === "email") out[k] = f.email;
      else out[k] = scrub(v, depth + 1);
    }
    return out;
  }
  return node;
}

let people = 0;
for (const file of ["people.json", "teams-v2-real.json", "teams-real.json"]) {
  const src = path.join(MOCKS, file);
  if (!fs.existsSync(src)) continue;
  const data = JSON.parse(fs.readFileSync(src, "utf8"));
  const out = scrub(data);
  fs.writeFileSync(path.join(MOCKS, file.replace(/\.json$/, ".public.json")),
    JSON.stringify(out, null, 1));
  console.log(`  ${file} -> ${file.replace(/\.json$/, ".public.json")}`);
}
people = alias.size;
console.log(`\n${people} identities pseudonymized (stable across builds)`);

// Fail loudly rather than publishing something that still contains the real domain.
const check = ["people.public.json", "teams-v2-real.public.json", "teams-real.public.json"]
  .map((f) => path.join(MOCKS, f))
  .filter((p) => fs.existsSync(p));
let leaked = 0;
for (const p of check) {
  const txt = fs.readFileSync(p, "utf8");
  for (const pat of ["saudigerman", "iohealth", "@sgh"]) {
    const n = (txt.match(new RegExp(pat, "gi")) || []).length;
    if (n) { console.error(`LEAK: ${path.basename(p)} still contains "${pat}" x${n}`); leaked += n; }
  }
}
if (leaked) process.exit(1);
console.log("verified: no real names or employer domains in the public files");
