import { chromium, type Browser } from "playwright";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const VIDEO_DIR = path.resolve("docs/video");
const TMP_DIR = path.join(VIDEO_DIR, ".tmp-demo");
const SCREENSHOT_DIR = path.resolve("docs/screenshots");
const OUTPUT = path.join(VIDEO_DIR, "demo.mp4");

const colors = {
  ink: "#172026",
  muted: "#d9e8ee",
  panel: "#ffffff",
  navy: "#183f58",
  teal: "#087f8c",
  yellow: "#f8c44f",
  line: "#d7dde3",
  green: "#0b7a53",
};

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

function base(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" /><style>
    * { box-sizing: border-box; }
    body { margin:0; width:1920px; height:1080px; overflow:hidden; font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; letter-spacing:0; color:white; background:${colors.navy}; }
    .frame { width:1920px; height:1080px; padding:76px 84px; position:relative; }
    .mark { width:86px; height:86px; border-radius:20px; display:grid; place-items:center; background:${colors.yellow}; color:${colors.navy}; font-size:34px; font-weight:900; }
    h1 { margin:0; font-size:80px; line-height:1.02; font-weight:900; }
    h2 { margin:0; font-size:48px; line-height:1.08; font-weight:900; color:${colors.ink}; }
    p { margin:0; font-size:28px; line-height:1.35; color:${colors.muted}; }
    .pill { display:inline-flex; align-items:center; height:46px; padding:0 18px; border-radius:999px; font-size:20px; font-weight:800; background:rgba(255,255,255,.12); color:white; }
    .panel { background:white; color:${colors.ink}; border-radius:18px; box-shadow:0 38px 90px rgba(0,0,0,.28); border:1px solid ${colors.line}; }
    .screen { width:1160px; border-radius:18px; box-shadow:0 32px 80px rgba(0,0,0,.3); border:1px solid rgba(255,255,255,.35); }
    table { width:100%; border-collapse:collapse; font-size:24px; }
    th, td { padding:18px 20px; border-bottom:1px solid #e7edf1; text-align:left; }
    th { color:#5b6871; font-size:19px; text-transform:uppercase; letter-spacing:.04em; }
    .badge { display:inline-block; border-radius:999px; padding:7px 13px; background:#e8f7ef; color:${colors.green}; font-weight:900; font-size:17px; text-transform:uppercase; }
    .terminal { background:#081015; color:#e6fff2; border-radius:18px; padding:34px; font:24px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; box-shadow:0 38px 90px rgba(0,0,0,.36); }
    .terminal .dim { color:#87a3ad; }
    .terminal .ok { color:#7ee2a8; }
    .footer { position:absolute; left:84px; bottom:62px; color:#bdd5df; font-size:22px; }
  </style></head><body><main class="frame" aria-label="${h(title)}">${body}</main></body></html>`;
}

function titleCard(): string {
  return base(
    "PackBridge title card",
    `<div style="display:grid;align-content:center;height:100%;max-width:1260px">
      <div class="mark" style="margin-bottom:42px">PB</div>
      <h1>PackBridge</h1>
      <p style="font-size:38px;margin-top:24px">Translate Shopify B2B orders into ERP pack units.</p>
      <div style="margin-top:44px"><span class="pill">CASE</span> <span class="pill">INNER</span> <span class="pill">PALLET</span> <span class="pill">Signed webhook</span></div>
    </div>
    <div class="footer">packbridge.app</div>`,
  );
}

function orderScene(): string {
  return base(
    "B2B order created",
    `<div style="display:grid;grid-template-columns:620px 1fr;gap:58px;align-items:center;height:100%">
      <section>
        <div class="mark" style="margin-bottom:34px">PB</div>
        <h1 style="font-size:64px">A buyer places a B2B order in Shopify.</h1>
        <p style="margin-top:24px">PackBridge waits for the order webhook, then resolves the customer-specific pack rules.</p>
      </section>
      <section class="panel" style="padding:34px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:28px">
          <h2>Order #10246</h2>
          <span class="badge">B2B</span>
        </div>
        <table>
          <tbody>
            <tr><th>Company</th><td>Northwind Beverages Co.</td></tr>
            <tr><th>Location</th><td>Chicago Distribution</td></tr>
            <tr><th>Line</th><td>NW-WATER-12 x 144 each</td></tr>
            <tr><th>Expected downstream</th><td><strong>12 CASE</strong></td></tr>
          </tbody>
        </table>
      </section>
    </div>`,
  );
}

async function screenshotScene(title: string, image: string, caption: string): Promise<string> {
  const src = await imageData(image);
  return base(
    title,
    `<div style="display:grid;grid-template-columns:520px 1fr;gap:54px;align-items:center;height:100%">
      <section>
        <div class="mark" style="margin-bottom:34px">PB</div>
        <h1 style="font-size:62px">${h(caption)}</h1>
      </section>
      <img class="screen" src="${src}" alt="${h(title)}" />
    </div>`,
  );
}

async function settingsPayloadScene(): Promise<string> {
  const src = await imageData("07-settings.png");
  return base(
    "Settings and signed payload",
    `<div style="display:grid;grid-template-columns:1fr 620px;gap:38px;align-items:center;height:100%">
      <img class="screen" style="width:1110px" src="${src}" alt="PackBridge settings" />
      <section class="panel" style="padding:34px">
        <h2>Signed webhook payload</h2>
        <p style="color:#5b6871;font-size:24px;margin:18px 0 24px">Each delivery includes an HMAC signature for verification.</p>
        <div style="background:#f1f5f7;border:1px solid #dce5ea;border-radius:12px;padding:22px;font:22px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:${colors.ink}">
          X-PackBridge-Signature:<br />
          sha256=8c4a...9b21<br /><br />
          { "order": "#10246",<br />
          &nbsp;&nbsp;"sku": "NW-WATER-12",<br />
          &nbsp;&nbsp;"output_quantity": 12,<br />
          &nbsp;&nbsp;"output_unit": "CASE" }
        </div>
      </section>
    </div>`,
  );
}

function erpScene(): string {
  return base(
    "ERP terminal",
    `<div style="display:grid;grid-template-columns:590px 1fr;gap:54px;align-items:center;height:100%">
      <section>
        <div class="mark" style="margin-bottom:34px">PB</div>
        <h1 style="font-size:62px">Your ERP receives clean pack-unit JSON.</h1>
        <p style="margin-top:24px">No spreadsheet cleanup. No case-pack math by hand.</p>
      </section>
      <section class="terminal">
        <div class="dim">$ erp-listener --port 443</div>
        <div class="ok">POST /packbridge/inbound 200 OK</div>
        <br />
        <div>{</div>
        <div>&nbsp; "company": "Northwind Beverages Co.",</div>
        <div>&nbsp; "input_quantity": 144,</div>
        <div>&nbsp; "pack_size": 12,</div>
        <div>&nbsp; "output_quantity": 12,</div>
        <div>&nbsp; "output_unit": "CASE"</div>
        <div>}</div>
        <br />
        <div class="ok">HMAC verification passed</div>
      </section>
    </div>`,
  );
}

function endCard(): string {
  return base(
    "PackBridge end card",
    `<div style="display:grid;place-items:center;text-align:center;height:100%">
      <div>
        <div class="mark" style="margin:0 auto 42px">PB</div>
        <h1>PackBridge</h1>
        <p style="font-size:34px;margin-top:24px">$99/mo · 14-day free trial · packbridge.app</p>
      </div>
    </div>`,
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

  const browser = await chromium.launch({ headless: true });
  try {
    await render(browser, "01-title.png", titleCard());
    await render(browser, "02-order.png", orderScene());
    await render(browser, "03-jobs.png", await screenshotScene("Jobs list", "05-jobs-list.png", "PackBridge normalizes it seconds later."));
    await render(browser, "04-settings.png", await settingsPayloadScene());
    await render(browser, "05-erp.png", erpScene());
    await render(browser, "06-dashboard.png", await screenshotScene("Dashboard", "01-dashboard.png", "Operators get a complete audit trail."));
    await render(browser, "07-end.png", endCard());
  } finally {
    await browser.close();
  }

  const durations = [
    ["01-title.png", 5],
    ["02-order.png", 8],
    ["03-jobs.png", 7],
    ["04-settings.png", 7],
    ["05-erp.png", 8],
    ["06-dashboard.png", 15],
    ["07-end.png", 5],
  ] as const;

  const concat = durations
    .flatMap(([file, duration]) => [
      `file '${path.join(TMP_DIR, file).replaceAll("'", "'\\''")}'`,
      `duration ${duration}`,
    ])
    .concat(`file '${path.join(TMP_DIR, "07-end.png").replaceAll("'", "'\\''")}'`)
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
    "-vf",
    "fps=30,format=yuv420p,scale=1920:1080",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "22",
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
