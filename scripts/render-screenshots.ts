import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { chromium, type Browser } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const SHOP_DOMAIN =
  process.env.PACKBRIDGE_DEMO_SHOP ?? "stocklockb.myshopify.com";
const OUT_DIR = path.resolve("docs/screenshots");

const colors = {
  ink: "#172026",
  muted: "#5b6871",
  line: "#d7dde3",
  canvas: "#f6f8fb",
  panel: "#ffffff",
  navy: "#183f58",
  teal: "#087f8c",
  green: "#0b7a53",
  yellow: "#b26a00",
  red: "#b42318",
  indigo: "#4b5bdc",
};

function h(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function badge(label: string, tone = "neutral"): string {
  const style: Record<string, string> = {
    completed: `color:${colors.green};background:#e8f7ef;border-color:#a7dfc4`,
    delivered: `color:${colors.green};background:#e8f7ef;border-color:#a7dfc4`,
    pass: `color:${colors.green};background:#e8f7ef;border-color:#a7dfc4`,
    active: `color:${colors.green};background:#e8f7ef;border-color:#a7dfc4`,
    held: `color:${colors.yellow};background:#fff4d8;border-color:#f2cf7a`,
    hold: `color:${colors.red};background:#ffe9e7;border-color:#ffb4ad`,
    warn: `color:${colors.yellow};background:#fff4d8;border-color:#f2cf7a`,
    mixed: `color:${colors.indigo};background:#eef0ff;border-color:#c5c9ff`,
    normalize_only: `color:${colors.teal};background:#e5f7f8;border-color:#9bdbe1`,
    neutral: `color:${colors.muted};background:#f1f3f5;border-color:#d7dde3`,
  };
  return `<span class="badge" style="${style[tone] ?? style.neutral}">${h(label)}</span>`;
}

function pageShell(title: string, active: string, body: string, aside = ""): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 1600px;
      height: 900px;
      overflow: hidden;
      color: ${colors.ink};
      background: ${colors.canvas};
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }
    .app {
      width: 1600px;
      height: 900px;
      display: grid;
      grid-template-columns: 236px 1fr;
      background: linear-gradient(180deg, #fbfcfe 0%, #eef3f6 100%);
    }
    .side {
      background: ${colors.navy};
      color: white;
      padding: 32px 22px;
      display: flex;
      flex-direction: column;
      gap: 26px;
    }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 800; font-size: 26px; }
    .mark {
      width: 42px; height: 42px; border-radius: 10px;
      display: grid; place-items: center;
      color: ${colors.navy}; background: #f8c44f; font-weight: 900;
    }
    .nav { display: grid; gap: 8px; }
    .nav div {
      padding: 12px 14px; border-radius: 8px; color: #d8e7ee; font-size: 17px;
    }
    .nav .active { background: rgba(255,255,255,.14); color: white; }
    .side-foot { margin-top: auto; color: #c5d7df; font-size: 14px; line-height: 1.5; }
    .main { padding: 36px 44px; overflow: hidden; }
    .top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 26px; }
    h1 { margin: 0; font-size: 40px; line-height: 1.08; font-weight: 800; }
    .subtitle { color: ${colors.muted}; margin-top: 8px; font-size: 17px; }
    .button {
      display: inline-flex; align-items: center; justify-content: center;
      height: 42px; padding: 0 18px; border-radius: 7px; border: 1px solid ${colors.line};
      background: ${colors.panel}; font-weight: 700; color: ${colors.ink};
    }
    .button.primary { background: ${colors.teal}; border-color: ${colors.teal}; color: white; }
    .grid { display: grid; gap: 18px; }
    .grid.cols-4 { grid-template-columns: repeat(4, 1fr); }
    .grid.cols-2 { grid-template-columns: 1.1fr .9fr; }
    .panel {
      background: ${colors.panel};
      border: 1px solid ${colors.line};
      border-radius: 8px;
      box-shadow: 0 12px 26px rgba(23,32,38,.07);
      padding: 22px;
    }
    .panel h2 { margin: 0 0 16px; font-size: 22px; }
    .metric-label { color: ${colors.muted}; font-size: 15px; }
    .metric { margin-top: 8px; font-size: 40px; line-height: 1; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; font-size: 15px; }
    th {
      text-align: left; color: ${colors.muted}; font-weight: 800; padding: 11px 10px;
      border-bottom: 1px solid ${colors.line};
    }
    td { padding: 13px 10px; border-bottom: 1px solid #edf1f3; vertical-align: top; }
    tr:last-child td { border-bottom: 0; }
    .badge {
      display: inline-block; border: 1px solid; border-radius: 999px;
      padding: 4px 9px; font-weight: 800; font-size: 12px; text-transform: uppercase;
    }
    .form-row { display: grid; gap: 8px; margin-bottom: 16px; }
    label { color: ${colors.muted}; font-weight: 800; font-size: 14px; }
    .input, .select, .textarea {
      min-height: 46px; border: 1px solid ${colors.line}; border-radius: 7px; background: white;
      padding: 12px 14px; font-size: 16px; color: ${colors.ink};
    }
    .hint { color: ${colors.muted}; font-size: 13px; margin-top: 3px; }
    .timeline { display: grid; gap: 12px; }
    .timeline-item { display: grid; grid-template-columns: 18px 1fr; gap: 12px; align-items: start; }
    .dot { width: 12px; height: 12px; border-radius: 999px; background: ${colors.teal}; margin-top: 5px; }
    .code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      background: #f1f5f7; border: 1px solid #dce5ea; border-radius: 7px; padding: 10px 12px;
      color: #27343b; word-break: break-all;
    }
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .small { font-size: 13px; color: ${colors.muted}; }
    .callout { background: #fff8e7; border: 1px solid #f3d487; border-radius: 8px; padding: 16px; }
  </style>
</head>
<body>
  <div class="app">
    <aside class="side">
      <div class="brand"><div class="mark">PB</div><div>PackBridge</div></div>
      <nav class="nav">
        ${["Dashboard", "Pack rules", "CSV import", "Jobs", "Settings"]
          .map((item) => `<div class="${item === active ? "active" : ""}">${item}</div>`)
          .join("")}
      </nav>
      <div class="side-foot">stocklockb.myshopify.com<br />Demo data for App Store review</div>
    </aside>
    <main class="main">
      <div class="top">
        <div>
          <h1>${h(title)}</h1>
          <div class="subtitle">Translate B2B orders into ERP-safe pack units automatically.</div>
        </div>
        ${aside}
      </div>
      ${body}
    </main>
  </div>
</body>
</html>`;
}

async function render(browser: Browser, fileName: string, html: string, width = 1600, height = 900) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT_DIR, fileName), fullPage: false });
  await page.close();
}

async function loadData() {
  const [shop, companies, locations, variants, rulesRaw, importJobs, jobsRaw] =
    await Promise.all([
      prisma.shop.findUnique({ where: { id: SHOP_DOMAIN } }),
      prisma.syncedCompany.findMany({ where: { shopDomain: SHOP_DOMAIN }, orderBy: { name: "asc" } }),
      prisma.syncedCompanyLocation.findMany({ where: { shopDomain: SHOP_DOMAIN }, orderBy: { name: "asc" } }),
      prisma.syncedVariant.findMany({ where: { shopDomain: SHOP_DOMAIN }, orderBy: [{ productTitle: "asc" }, { sku: "asc" }] }),
      prisma.packRule.findMany({ where: { shopDomain: SHOP_DOMAIN }, orderBy: { createdAt: "desc" } }),
      prisma.ruleImportJob.findMany({ where: { shopDomain: SHOP_DOMAIN }, orderBy: { createdAt: "desc" }, take: 3 }),
      prisma.normalizationJob.findMany({
        where: { shopDomain: SHOP_DOMAIN },
        orderBy: { createdAt: "desc" },
        include: { events: { orderBy: { createdAt: "asc" } }, deliveries: { orderBy: { createdAt: "desc" }, take: 1 } },
      }),
    ]);

  const companyMap = new Map(companies.map((item) => [item.id, item.name]));
  const locationMap = new Map(locations.map((item) => [item.id, item.name]));
  const variantMap = new Map(variants.map((item) => [item.id, item]));
  const productMap = new Map(variants.map((item) => [item.productId, item.productTitle ?? "Untitled product"]));

  const rules = rulesRaw.map((rule) => {
    const variant = rule.variantId ? variantMap.get(rule.variantId) : null;
    return {
      ...rule,
      companyLabel: rule.companyId ? companyMap.get(rule.companyId) ?? "Unknown company" : "All companies",
      locationLabel: rule.companyLocationId ? locationMap.get(rule.companyLocationId) ?? "All locations" : rule.companyId ? "All locations" : "-",
      sku: variant?.sku ?? "-",
      productLabel: variant?.productTitle ?? (rule.productId ? productMap.get(rule.productId) : null) ?? "All products",
    };
  });

  const jobs = jobsRaw.map((job) => ({
    ...job,
    companyLabel: job.companyId ? companyMap.get(job.companyId) ?? "Unknown company" : "-",
    locationLabel: job.companyLocationId ? locationMap.get(job.companyLocationId) ?? "-" : "-",
  }));

  const detailJob = jobs.find((job) => job.orderName === "#10244") ?? jobs[0];

  return { shop, companies, locations, variants, rules, importJobs, jobs, detailJob };
}

function dashboard(data: Awaited<ReturnType<typeof loadData>>) {
  const completed = data.jobs.filter((job) => job.status === "completed").length;
  const held = data.jobs.filter((job) => job.status === "held").length;
  return pageShell(
    "Dashboard",
    "Dashboard",
    `<div class="grid cols-4">
      <div class="panel"><div class="metric-label">Active rules</div><div class="metric">${data.rules.length}</div></div>
      <div class="panel"><div class="metric-label">Orders processed</div><div class="metric">${data.jobs.length}</div></div>
      <div class="panel"><div class="metric-label">Completed</div><div class="metric">${completed}</div></div>
      <div class="panel"><div class="metric-label">Held / needs review</div><div class="metric">${held}</div></div>
    </div>
    <div class="grid cols-2" style="margin-top:18px">
      <div class="panel">
        <h2>Recent jobs</h2>
        <table>
          <thead><tr><th>Order</th><th>Company</th><th>Status</th><th>When</th></tr></thead>
          <tbody>
            ${data.jobs
              .slice(0, 5)
              .map((job) => `<tr><td><strong>${h(job.orderName)}</strong></td><td>${h(job.companyLabel)}</td><td>${badge(job.status, job.status)}</td><td>${formatDate(job.createdAt)}</td></tr>`)
              .join("")}
          </tbody>
        </table>
      </div>
      <div class="panel">
        <h2>Workflow health</h2>
        <div class="timeline">
          <div class="timeline-item"><span class="dot"></span><div><strong>Initial sync complete</strong><div class="small">${data.companies.length} companies, ${data.locations.length} locations, ${data.variants.length} variants</div></div></div>
          <div class="timeline-item"><span class="dot"></span><div><strong>Webhook configured</strong><div class="small">Signed JSON payloads ready for ERP intake</div></div></div>
          <div class="timeline-item"><span class="dot"></span><div><strong>Retry protection verified</strong><div class="small">One historical delivery recovered after HTTP 500</div></div></div>
        </div>
      </div>
    </div>`,
    `<div class="button primary">Re-sync now</div>`,
  );
}

function rulesList(data: Awaited<ReturnType<typeof loadData>>) {
  return pageShell(
    "Pack rules",
    "Pack rules",
    `<div class="panel">
      <div class="split" style="margin-bottom:18px">
        <div class="input">Company: All companies</div>
        <div class="input">Enforcement mode: All modes</div>
      </div>
      <table>
        <thead><tr><th>Company</th><th>Location</th><th>SKU</th><th>Product</th><th>Pack</th><th>Unit</th><th>Mode</th><th>Status</th></tr></thead>
        <tbody>
          ${data.rules
            .slice(0, 10)
            .map((rule) => `<tr><td>${h(rule.companyLabel)}</td><td>${h(rule.locationLabel)}</td><td>${h(rule.sku)}</td><td>${h(rule.productLabel)}</td><td>${rule.packSize}</td><td>${h(rule.downstreamUnitCode)}</td><td>${badge(rule.enforcementMode, rule.enforcementMode)}</td><td>${badge(rule.active ? "Active" : "Inactive", rule.active ? "active" : "neutral")}</td></tr>`)
            .join("")}
        </tbody>
      </table>
    </div>`,
    `<div><span class="button">Import CSV</span> <span class="button primary">Create rule</span></div>`,
  );
}

function ruleForm(data: Awaited<ReturnType<typeof loadData>>) {
  const company = data.companies.find((item) => item.name === "Cascade Grocers") ?? data.companies[0];
  const location = data.locations.find((item) => item.companyId === company.id) ?? data.locations[0];
  const variant = data.variants.find((item) => item.sku === "CG-RICE-12") ?? data.variants[0];
  return pageShell(
    "Create pack rule",
    "Pack rules",
    `<div class="panel" style="width:880px">
      <div class="form-row"><label>Company</label><div class="select">${h(company.name)}</div><div class="hint">Leave empty to apply the rule to all companies.</div></div>
      <div class="form-row"><label>Company location</label><div class="select">${h(location.name)}</div><div class="hint">Leave empty to apply to all locations for this company.</div></div>
      <div class="form-row"><label>Search product or SKU</label><div class="input">CG-RICE</div></div>
      <div class="form-row"><label>Matching variants</label><div class="select">${h(variant.productTitle)} - ${h(variant.title)} (${h(variant.sku)})</div></div>
      <div class="split">
        <div class="form-row"><label>Pack size</label><div class="input">12</div><div class="hint">Base units per downstream unit.</div></div>
        <div class="form-row"><label>Downstream unit code</label><div class="input">CASE</div><div class="hint">Match what the ERP expects.</div></div>
      </div>
      <div class="form-row"><label>Enforcement mode</label><div class="select">Warn - order proceeds, flagged for review</div></div>
      <div><span class="button primary">Create rule</span> <span class="button">Cancel</span></div>
    </div>`,
  );
}

function csvImport(data: Awaited<ReturnType<typeof loadData>>) {
  const latest = data.importJobs[0];
  return pageShell(
    "Import pack rules from CSV",
    "CSV import",
    `<div class="grid cols-2">
      <div class="panel">
        <h2>Import complete</h2>
        <div class="callout"><strong>Import finished.</strong><br />Imported ${latest?.successCount ?? 4} rules. Skipped ${latest?.errorCount ?? 1} row due to errors.</div>
        <table style="margin-top:18px">
          <thead><tr><th>Row</th><th>Company</th><th>SKU</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>2</td><td>Northwind Beverages Co.</td><td>NW-WATER-12</td><td>${badge("Ready", "pass")}</td></tr>
            <tr><td>3</td><td>Cascade Grocers</td><td>CG-RICE-12</td><td>${badge("Ready", "pass")}</td></tr>
            <tr><td>4</td><td>Atlas Foodservice</td><td>AT-CUPS-48</td><td>${badge("Ready", "pass")}</td></tr>
            <tr><td>6</td><td>Cascade Grocers</td><td>CG-PASTA-20</td><td>${badge("Error", "hold")}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="panel">
        <h2>Recent import jobs</h2>
        <table>
          <thead><tr><th>File</th><th>Rows</th><th>Imported</th><th>Errors</th><th>Status</th></tr></thead>
          <tbody>${data.importJobs.map((job) => `<tr><td>${h(job.fileName)}</td><td>${job.totalRows}</td><td>${job.successCount}</td><td>${job.errorCount}</td><td>${badge(job.status, "pass")}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    </div>`,
    `<span class="button">Download template</span>`,
  );
}

function jobsList(data: Awaited<ReturnType<typeof loadData>>) {
  return pageShell(
    "Normalization jobs",
    "Jobs",
    `<div class="panel">
      <div class="input" style="width:310px;margin-bottom:18px">Status: All</div>
      <table>
        <thead><tr><th>Order</th><th>Company</th><th>Status</th><th>Lines</th><th>Processed</th><th>Created</th></tr></thead>
        <tbody>
          ${data.jobs
            .map((job) => `<tr><td><strong>${h(job.orderName)}</strong></td><td>${h(job.companyLabel)}</td><td>${badge(job.status, job.status)}</td><td>${job.events.length}</td><td>${formatDate(job.processedAt)}</td><td>${formatDate(job.createdAt)}</td></tr>`)
            .join("")}
        </tbody>
      </table>
    </div>`,
  );
}

function jobDetail(data: Awaited<ReturnType<typeof loadData>>) {
  const job = data.detailJob;
  const delivery = job.deliveries[0];
  return pageShell(
    `Job - order ${job.orderName}`,
    "Jobs",
    `<div class="grid cols-2">
      <div class="panel">
        <h2>Order summary</h2>
        <table>
          <tbody>
            <tr><td>Order</td><td><strong>${h(job.orderName)}</strong></td></tr>
            <tr><td>Company</td><td>${h(job.companyLabel)}</td></tr>
            <tr><td>Company location</td><td>${h(job.locationLabel)}</td></tr>
            <tr><td>Status</td><td>${badge(job.status, job.status)}</td></tr>
            <tr><td>Idempotency key</td><td><span class="code">demo:${h(SHOP_DOMAIN)}:${h(job.orderId.split("/").at(-1))}</span></td></tr>
          </tbody>
        </table>
        <h2 style="margin-top:22px">Event timeline</h2>
        <div class="timeline">
          <div class="timeline-item"><span class="dot"></span><div><strong>Order webhook received</strong><div class="small">orders/create authenticated for ${h(SHOP_DOMAIN)}</div></div></div>
          <div class="timeline-item"><span class="dot"></span><div><strong>Pack rules resolved</strong><div class="small">${job.events.length} line items normalized</div></div></div>
          <div class="timeline-item"><span class="dot"></span><div><strong>Signed delivery completed</strong><div class="small">Retry count ${delivery?.retryCount ?? 0}</div></div></div>
        </div>
      </div>
      <div class="panel">
        <h2>Line items</h2>
        <table>
          <thead><tr><th>SKU</th><th>Input</th><th>Output</th><th>Unit</th><th>Result</th></tr></thead>
          <tbody>${job.events.map((event) => `<tr><td>${h(event.sku)}</td><td>${event.inputQuantity}</td><td>${event.outputQuantity ? Number(event.outputQuantity) : "-"}</td><td>${h(event.outputUnit)}</td><td>${badge(event.resultStatus, event.resultStatus)}</td></tr>`).join("")}</tbody>
        </table>
        <h2 style="margin-top:22px">Delivery status</h2>
        <div class="form-row"><label>Destination</label><div class="code">https://webhook.site/[redacted]</div></div>
        <div class="form-row"><label>Status</label><div>${badge(delivery?.deliveryStatus ?? "pending", delivery?.deliveryStatus ?? "neutral")}</div></div>
        <div class="form-row"><label>Retry count</label><div class="input">${delivery?.retryCount ?? 0}</div></div>
        ${delivery?.lastError ? `<div class="callout">${h(delivery.lastError)}</div>` : ""}
      </div>
    </div>`,
  );
}

function settings(data: Awaited<ReturnType<typeof loadData>>) {
  return pageShell(
    "Settings",
    "Settings",
    `<div class="grid cols-2">
      <div class="panel">
        <h2>Outbound webhook</h2>
        <p class="small">PackBridge POSTs a signed JSON payload whenever a B2B order is normalized.</p>
        <div class="form-row"><label>Webhook destination URL</label><div class="input">https://erp.example.com/packbridge/inbound</div><div class="hint">Must be http:// or https://</div></div>
        <div class="form-row"><label>Default enforcement mode</label><div class="select">Warn</div></div>
        <span class="button primary">Save settings</span>
      </div>
      <div class="panel">
        <h2>Signing secret</h2>
        <p class="small">Use this secret on your server to verify the X-PackBridge-Signature header.</p>
        <div class="code">pb_demo_secret_************************</div>
        <div style="margin-top:18px"><span class="button">Regenerate secret</span></div>
        <h2 style="margin-top:30px">Shop</h2>
        <p><strong>${h(data.shop?.id ?? SHOP_DOMAIN)}</strong></p>
      </div>
    </div>`,
  );
}

function iconHtml() {
  return `<!doctype html><html><head><meta charset="utf-8" /><style>
    body { margin:0; width:1200px; height:1200px; background:${colors.navy}; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; display:grid; place-items:center; }
    .wrap { text-align:center; color:white; }
    .mark { width:390px; height:390px; border-radius:86px; background:#f8c44f; color:${colors.navy}; display:grid; place-items:center; font-size:160px; font-weight:900; margin:0 auto 64px; box-shadow:0 36px 90px rgba(0,0,0,.22); }
    .word { font-size:96px; font-weight:900; letter-spacing:0; }
    .line { margin:30px auto 0; width:420px; height:18px; border-radius:999px; background:${colors.teal}; }
  </style></head><body><div class="wrap"><div class="mark">PB</div><div class="word">PackBridge</div><div class="line"></div></div></body></html>`;
}

function feature(data: Awaited<ReturnType<typeof loadData>>) {
  return `<!doctype html><html><head><meta charset="utf-8" /><style>
    * { box-sizing:border-box; }
    body { margin:0; width:1600px; height:900px; overflow:hidden; background:${colors.navy}; color:white; font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; letter-spacing:0; }
    .hero { width:1600px; height:900px; display:grid; grid-template-columns:570px 1fr; gap:40px; padding:72px 70px; align-items:center; }
    .mark { width:76px; height:76px; border-radius:18px; background:#f8c44f; color:${colors.navy}; display:grid; place-items:center; font-size:31px; font-weight:900; margin-bottom:34px; }
    h1 { font-size:72px; line-height:1.02; margin:0 0 24px; }
    p { color:#d9e8ee; font-size:26px; line-height:1.35; margin:0; }
    .chips { display:flex; gap:12px; flex-wrap:wrap; margin-top:34px; }
    .chip { display:inline-flex; align-items:center; height:48px; padding:0 16px; border:1px solid rgba(255,255,255,.25); border-radius:8px; color:#fff; font-weight:800; font-size:22px; }
    .dash { background:#f6f8fb; border-radius:16px; padding:24px; color:${colors.ink}; box-shadow:0 38px 90px rgba(0,0,0,.32); }
    .top { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; }
    .top strong { font-size:26px; }
    .grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:18px; }
    .card { background:white; border:1px solid ${colors.line}; border-radius:8px; padding:16px; }
    .label { color:${colors.muted}; font-size:13px; }
    .num { font-size:34px; font-weight:900; margin-top:6px; }
    table { width:100%; border-collapse:collapse; background:white; border-radius:8px; overflow:hidden; font-size:15px; }
    th,td { text-align:left; padding:13px 14px; border-bottom:1px solid #edf1f3; }
    th { color:${colors.muted}; }
    .badge { border-radius:999px; padding:4px 9px; background:#e8f7ef; color:${colors.green}; font-weight:900; font-size:12px; }
  </style></head><body><div class="hero">
    <section><div class="mark">PB</div><h1>Shopify B2B orders, translated for your ERP.</h1><p>PackBridge converts eaches into cases, inner packs, and pallets, then sends a signed webhook payload downstream.</p><div class="chips"><span class="chip">CASE</span><span class="chip">INNER</span><span class="chip">PALLET</span><span class="chip">HMAC signed</span></div></section>
    <section class="dash"><div class="top"><strong>PackBridge dashboard</strong><span>stocklockb.myshopify.com</span></div><div class="grid">
      <div class="card"><div class="label">Active rules</div><div class="num">${data.rules.length}</div></div>
      <div class="card"><div class="label">Orders processed</div><div class="num">${data.jobs.length}</div></div>
      <div class="card"><div class="label">Completed</div><div class="num">${data.jobs.filter((job) => job.status === "completed").length}</div></div>
      <div class="card"><div class="label">Held</div><div class="num">${data.jobs.filter((job) => job.status === "held").length}</div></div>
    </div><table><thead><tr><th>Order</th><th>Company</th><th>Status</th><th>When</th></tr></thead><tbody>
      ${data.jobs.slice(0, 4).map((job) => `<tr><td><strong>${h(job.orderName)}</strong></td><td>${h(job.companyLabel)}</td><td><span class="badge">${h(job.status)}</span></td><td>${formatDate(job.createdAt)}</td></tr>`).join("")}
    </tbody></table></section>
  </div></body></html>`;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const data = await loadData();
  const browser = await chromium.launch({ headless: true });
  try {
    await render(browser, "01-dashboard.png", dashboard(data));
    await render(browser, "02-pack-rules.png", rulesList(data));
    await render(browser, "03-rule-form.png", ruleForm(data));
    await render(browser, "04-csv-import.png", csvImport(data));
    await render(browser, "05-jobs-list.png", jobsList(data));
    await render(browser, "06-job-detail.png", jobDetail(data));
    await render(browser, "07-settings.png", settings(data));
    await render(browser, "icon-1200.png", iconHtml(), 1200, 1200);
    await render(browser, "feature-1600x900.png", feature(data));
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
  console.log(`Wrote screenshots to ${OUT_DIR}`);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
