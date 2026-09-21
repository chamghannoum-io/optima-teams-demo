/**
 * Screenshots the Teams module so the UI can be judged, not guessed at.
 *
 * Starts nothing: point it at a running `npm run dev`. Captures each view at a
 * laptop width and a narrow width, because most of what goes wrong in this page
 * goes wrong when a flex row runs out of space.
 *
 *   npm run dev                  # in one terminal
 *   node shots.mjs [outDir]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const URL = process.env.UI ?? "http://127.0.0.1:5173/";
const OUT = process.argv[2] ?? "./.shots";
mkdirSync(OUT, { recursive: true });

const WIDTHS = [
  { name: "laptop", width: 1440, height: 1000 },
  { name: "narrow", width: 900, height: 1000 },
];

const browser = await chromium.launch();
const errors = [];

for (const vp of WIDTHS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[${vp.name}] ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`[${vp.name}] ${e.message}`));

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const shot = async (name) => {
    const path = join(OUT, `${name}-${vp.name}.png`);
    await page.screenshot({ path, fullPage: true });
    console.log(`  ${path}`);
  };

  // Dashboard is the default tab.
  await shot("1-dashboard");

  // Teams list.
  const teamsTab = page.getByRole("tab", { name: /teams/i });
  if (await teamsTab.count()) {
    await teamsTab.first().click();
    await page.waitForTimeout(600);
    await shot("2-teams");

    // Expand one team's routing rule.
    const chevron = page.locator('button[aria-label="Show routing rule"]').first();
    if (await chevron.count()) {
      await chevron.click();
      await page.waitForTimeout(300);
      await shot("3-teams-rule-expanded");
    }

    // The wizard, step by step.
    const edit = page.locator('button[aria-label*="Edit"], button:has(svg.lucide-pencil)').first();
    if (await edit.count()) {
      await edit.click();
      await page.waitForTimeout(900);
      await shot("4-wizard-step1-criteria");

      for (const [n, label] of [
        [2, "groups"],
        [3, "policies"],
        [4, "review"],
      ]) {
        const next = page.getByRole("button", { name: /^Next$/ });
        if (await next.count()) {
          await next.first().click();
          await page.waitForTimeout(700);
          await shot(`5-wizard-step${n}-${label}`);
        }
      }
    }
  }

  await page.close();
}

await browser.close();

if (errors.length) {
  console.log("\nconsole errors:");
  for (const e of [...new Set(errors)].slice(0, 15)) console.log("  " + e);
} else {
  console.log("\nno console errors");
}
