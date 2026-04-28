import { chromium, type Browser } from "playwright";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const VIDEO_DIR = path.resolve("docs/video");
const TMP_DIR = path.join(VIDEO_DIR, ".tmp-onboarding");
const SCREENSHOT_DIR = path.resolve("docs/screenshots");
const OUTPUT = path.join(VIDEO_DIR, "onboarding.mp4");
const AUDIO = path.join(TMP_DIR, "narration.aiff");
const NARRATION = path.join(TMP_DIR, "narration.txt");

const colors = {
  ink: "#172026",
  muted: "#53636d",
  panel: "#ffffff",
  navy: "#183f58",
  teal: "#087f8c",
  yellow: "#f8c44f",
  line: "#d7dde3",
};

const narration = `
Welcome to PackBridge. This walkthrough shows a new Shopify B2B merchant how to go from install to the first normalized order in about five minutes.

Start in the Shopify App Store and install PackBridge into the store. Shopify sends you through OAuth so you can approve the read-only permissions PackBridge needs: orders, products, companies, and customers for B2B purchasing context. PackBridge does not request write scopes, and it does not change orders, products, or customers in Shopify.

After OAuth, you land on the PackBridge dashboard. The first job is the initial sync. PackBridge mirrors B2B companies, company locations, products, and variants into its own database so the admin can resolve pack rules quickly. The dashboard confirms the latest sync time, active rule count, processed orders, and recent normalization jobs.

Next, create your first pack rule. A rule can apply to all companies, one company, one company location, a product, or a specific variant. Choose the most specific scope you need, set the pack size, then choose the downstream unit code your ERP expects, such as CASE, INNER, or PALLET. Enforcement mode controls what happens when the ordered quantity is not divisible by the pack size. Warn flags the order. Hold marks the job for review. Normalize only emits the translation and records the warning.

For larger catalogs, use the CSV import flow. Download the template, fill in company name, company location name, SKU, pack size, downstream unit code, and enforcement mode, then upload the file. PackBridge previews every row before writing rules. Valid rows are ready to import, and invalid rows explain exactly what needs to be fixed, such as an unknown SKU or a location that does not belong to the selected company.

Now configure delivery. On Settings, paste the HTTPS endpoint for your ERP, EDI, middleware, or warehouse system. PackBridge signs every outbound request with the signing secret shown on this page. Your server verifies the X-PackBridge-Signature header by computing an HMAC over the raw request body.

With rules and settings in place, place a B2B test order in Shopify. When the orders create webhook arrives, PackBridge resolves the purchasing company and location, chooses the most specific matching rule, validates divisibility, and writes a normalization event for each line item.

Open the Jobs page to audit the result. The list shows completed, held, mixed, and failed jobs. Open a job detail page to see the order summary, line item inputs, resolved output quantities, downstream units, validation warnings, and delivery status. If the endpoint returns a temporary 500, PackBridge retries and records the successful recovery.

Finally, verify the payload at your endpoint. A normalized line contains the original input quantity, the resolved pack size, the output quantity, the downstream unit, and the order context your downstream system needs. The delivery ID and HMAC signature make the payload traceable and verifiable.

That is the core PackBridge setup: install, sync, create or import rules, configure a signed webhook, place a B2B order, and confirm the ERP receives clean pack-unit JSON. For help, contact support at support at packbridge dot app, or use the documentation link from the listing.
`.trim();

function h(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function imageData(name: string): Promise<string> {
  const bytes = await fs.readFile(path.join(SCREENSHOT_DIR, name));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

function shell(title: string, eyebrow: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" /><style>
    * { box-sizing:border-box; }
    body { margin:0; width:1920px; height:1080px; overflow:hidden; background:#eef3f6; color:${colors.ink}; font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; letter-spacing:0; }
    .frame { width:1920px; height:1080px; display:grid; grid-template-columns:460px 1fr; gap:54px; padding:72px; align-items:center; }
    .side { height:936px; border-radius:18px; background:${colors.navy}; color:white; padding:46px; display:flex; flex-direction:column; justify-content:space-between; }
    .mark { width:78px; height:78px; border-radius:18px; display:grid; place-items:center; background:${colors.yellow}; color:${colors.navy}; font-size:31px; font-weight:900; margin-bottom:34px; }
    .eyebrow { color:#b8d4df; font-size:20px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; margin-bottom:18px; }
    h1 { margin:0; font-size:58px; line-height:1.04; color:white; }
    p { margin:24px 0 0; color:#d8e8ef; font-size:25px; line-height:1.35; }
    .footer { color:#bdd5df; font-size:19px; line-height:1.5; }
    .panel { background:${colors.panel}; border:1px solid ${colors.line}; border-radius:18px; padding:34px; box-shadow:0 32px 70px rgba(23,32,38,.16); }
    .screen { width:1280px; border-radius:14px; border:1px solid ${colors.line}; box-shadow:0 28px 70px rgba(23,32,38,.22); }
    .steps { display:grid; gap:18px; }
    .step { display:grid; grid-template-columns:46px 1fr; gap:18px; align-items:start; padding:20px; border:1px solid ${colors.line}; border-radius:12px; background:#f8fafb; }
    .num { width:46px; height:46px; border-radius:999px; background:${colors.teal}; color:white; display:grid; place-items:center; font-weight:900; font-size:22px; }
    .step strong { font-size:25px; }
    .step span { display:block; margin-top:7px; color:${colors.muted}; font-size:20px; line-height:1.35; }
    .terminal { background:#081015; color:#e6fff2; border-radius:18px; padding:34px; font:24px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  </style></head><body><main class="frame"><aside class="side"><div><div class="mark">PB</div><div class="eyebrow">${h(eyebrow)}</div><h1>${h(title)}</h1></div><div class="footer">PackBridge onboarding<br />Install to first normalized order</div></aside>${body}</main></body></html>`;
}

function titleScene(): string {
  return shell(
    "Install to first normalized order.",
    "PackBridge",
    `<section class="panel"><div class="steps">
      <div class="step"><div class="num">1</div><div><strong>Install</strong><span>Approve read-only Shopify B2B access through OAuth.</span></div></div>
      <div class="step"><div class="num">2</div><div><strong>Sync</strong><span>Mirror companies, locations, products, and variants.</span></div></div>
      <div class="step"><div class="num">3</div><div><strong>Normalize</strong><span>Turn eaches into CASE, INNER, or PALLET payloads for your ERP.</span></div></div>
    </div></section>`,
  );
}

function installScene(): string {
  return shell(
    "Install from the Shopify App Store.",
    "Step 1",
    `<section class="panel"><div class="steps">
      <div class="step"><div class="num">A</div><div><strong>Open PackBridge</strong><span>Start from the Shopify App Store listing or a reviewer install link.</span></div></div>
      <div class="step"><div class="num">B</div><div><strong>Approve OAuth</strong><span>PackBridge requests read-only orders, products, companies, and customer purchasing context.</span></div></div>
      <div class="step"><div class="num">C</div><div><strong>Land in Admin</strong><span>The embedded app opens directly on the dashboard after authorization.</span></div></div>
    </div></section>`,
  );
}

async function screenshotScene(title: string, eyebrow: string, image: string, note: string): Promise<string> {
  const src = await imageData(image);
  return shell(
    title,
    eyebrow,
    `<section><img class="screen" src="${src}" alt="${h(title)}" /><p style="color:${colors.muted};font-size:24px;margin:22px 0 0">${h(note)}</p></section>`,
  );
}

function payloadScene(): string {
  return shell(
    "Verify the signed payload.",
    "Step 7",
    `<section class="terminal">
      <div style="color:#87a3ad">$ erp-listener --verify-hmac</div>
      <div style="color:#7ee2a8">POST /packbridge/inbound 200 OK</div>
      <br />
      <div>X-PackBridge-Signature: sha256=8c4a...9b21</div>
      <br />
      <div>{</div>
      <div>&nbsp; "order_name": "#10246",</div>
      <div>&nbsp; "sku": "NW-WATER-12",</div>
      <div>&nbsp; "input_quantity": 144,</div>
      <div>&nbsp; "pack_size": 12,</div>
      <div>&nbsp; "output_quantity": 12,</div>
      <div>&nbsp; "output_unit": "CASE"</div>
      <div>}</div>
      <br />
      <div style="color:#7ee2a8">HMAC verification passed</div>
    </section>`,
  );
}

function wrapScene(): string {
  return shell(
    "PackBridge is ready for live orders.",
    "Wrap",
    `<section class="panel"><div class="steps">
      <div class="step"><div class="num">1</div><div><strong>Rules are active</strong><span>Specific scopes win over global fallback rules.</span></div></div>
      <div class="step"><div class="num">2</div><div><strong>Webhook is configured</strong><span>Signed JSON reaches the downstream endpoint.</span></div></div>
      <div class="step"><div class="num">3</div><div><strong>Audit trail is complete</strong><span>Every order, line item, warning, hold, and retry is visible.</span></div></div>
    </div></section>`,
  );
}

async function render(browser: Browser, name: string, html: string) {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(TMP_DIR, name), fullPage: false });
  await page.close();
}

async function main() {
  await fs.rm(TMP_DIR, { recursive: true, force: true });
  await fs.mkdir(TMP_DIR, { recursive: true });
  await fs.mkdir(VIDEO_DIR, { recursive: true });
  await fs.writeFile(NARRATION, narration);

  await execFileAsync("say", ["-v", "Samantha", "-r", "158", "-f", NARRATION, "-o", AUDIO]);

  const browser = await chromium.launch({ headless: true });
  try {
    await render(browser, "01-title.png", titleScene());
    await render(browser, "02-install.png", installScene());
    await render(browser, "03-sync.png", await screenshotScene("Confirm the initial sync.", "Step 2", "01-dashboard.png", "Dashboard stats show synced demo companies, variants, rules, and recent jobs."));
    await render(browser, "04-rule.png", await screenshotScene("Create the first pack rule.", "Step 3", "03-rule-form.png", "Scope by company, location, product, or SKU, then set pack size and downstream unit."));
    await render(browser, "05-import.png", await screenshotScene("Import rules in bulk.", "Step 4", "04-csv-import.png", "CSV preview catches invalid rows before rules are written."));
    await render(browser, "06-settings.png", await screenshotScene("Configure signed delivery.", "Step 5", "07-settings.png", "Set the webhook endpoint and use the signing secret to verify requests."));
    await render(browser, "07-job.png", await screenshotScene("Audit the normalized order.", "Step 6", "06-job-detail.png", "Job detail shows line-level output quantities, delivery status, and retry history."));
    await render(browser, "08-payload.png", payloadScene());
    await render(browser, "09-wrap.png", wrapScene());
  } finally {
    await browser.close();
  }

  const durations = [
    ["01-title.png", 25],
    ["02-install.png", 28],
    ["03-sync.png", 32],
    ["04-rule.png", 40],
    ["05-import.png", 38],
    ["06-settings.png", 36],
    ["07-job.png", 42],
    ["08-payload.png", 34],
    ["09-wrap.png", 30],
  ] as const;

  const concat = durations
    .flatMap(([file, duration]) => [
      `file '${path.join(TMP_DIR, file).replaceAll("'", "'\\''")}'`,
      `duration ${duration}`,
    ])
    .concat(`file '${path.join(TMP_DIR, "09-wrap.png").replaceAll("'", "'\\''")}'`)
    .join("\n");
  const concatPath = path.join(TMP_DIR, "concat.txt");
  await fs.writeFile(concatPath, concat);

  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatPath,
    "-i",
    AUDIO,
    "-vf",
    "fps=30,format=yuv420p,scale=1920:1080",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "22",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-shortest",
    "-movflags",
    "+faststart",
    OUTPUT,
  ]);

  await fs.rm(TMP_DIR, { recursive: true, force: true });
  console.log(`Wrote ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
