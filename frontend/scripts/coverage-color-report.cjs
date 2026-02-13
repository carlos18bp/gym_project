/**
 * coverage-color-report.cjs
 *
 * Parses the Istanbul text coverage output (coverage-e2e/coverage.txt) and
 * generates a custom HTML report with a 6-tier color gradient:
 *
 *   0–30%  → Deep Red    (Critical)
 *  30–50%  → Light Red   (Low)
 *  50–65%  → Orange      (Needs work)
 *  65–80%  → Amber       (Acceptable)
 *  80–90%  → Light Green (Good)
 *  90–100% → Green       (Excellent)
 *
 * Usage:  node scripts/coverage-color-report.cjs
 * Output: coverage-e2e/coverage-color-report.html
 */

const fs = require("fs");
const path = require("path");

// ── Color tiers ──────────────────────────────────────────────────────────────
const TIERS = [
  { min: 0,  max: 30,  label: "Critical",    bg: "#FEE2E2", text: "#991B1B", bar: "#DC2626", badge: "#DC2626" },
  { min: 30, max: 50,  label: "Low",         bg: "#FECACA", text: "#B91C1C", bar: "#EF4444", badge: "#EF4444" },
  { min: 50, max: 65,  label: "Needs work",  bg: "#FED7AA", text: "#9A3412", bar: "#F97316", badge: "#F97316" },
  { min: 65, max: 80,  label: "Acceptable",  bg: "#FEF3C7", text: "#92400E", bar: "#F59E0B", badge: "#EAB308" },
  { min: 80, max: 90,  label: "Good",        bg: "#DCFCE7", text: "#166534", bar: "#22C55E", badge: "#16A34A" },
  { min: 90, max: 101, label: "Excellent",   bg: "#BBF7D0", text: "#14532D", bar: "#15803D", badge: "#15803D" },
];

function getTier(pct) {
  for (const t of TIERS) {
    if (pct >= t.min && pct < t.max) return t;
  }
  return TIERS[TIERS.length - 1];
}

// ── Parse coverage.txt ──────────────────────────────────────────────────────
const coveragePath = path.resolve(__dirname, "..", "coverage-e2e", "coverage.txt");
if (!fs.existsSync(coveragePath)) {
  console.error("❌  coverage-e2e/coverage.txt not found. Run e2e:coverage first.");
  process.exit(1);
}

const raw = fs.readFileSync(coveragePath, "utf-8");
const lines = raw.split("\n");

// Find the table header line
const headerIdx = lines.findIndex((l) => l.includes("% Stmts") && l.includes("% Branch"));
if (headerIdx < 0) {
  console.error("❌  Could not find table header in coverage.txt");
  process.exit(1);
}

// Find the summary block
const summaryMatch = raw.match(
  /Statements\s*:\s*([\d.]+)%.*?\nBranches\s*:\s*([\d.]+)%.*?\nFunctions\s*:\s*([\d.]+)%.*?\nLines\s*:\s*([\d.]+)%/
);

const summary = summaryMatch
  ? {
      stmts: parseFloat(summaryMatch[1]),
      branch: parseFloat(summaryMatch[2]),
      funcs: parseFloat(summaryMatch[3]),
      lines: parseFloat(summaryMatch[4]),
    }
  : null;

// Parse data rows (skip separators and header)
const SEP = /^-+\|/;
const rows = [];
for (let i = headerIdx + 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim() || SEP.test(line.trim())) continue;
  // Each row: File | % Stmts | % Branch | % Funcs | % Lines | Uncovered
  const parts = line.split("|").map((s) => s.trim());
  if (parts.length < 6) continue;

  const fileName = parts[0].replace(/\s+/g, " ");
  const stmts = parseFloat(parts[1]);
  const branch = parseFloat(parts[2]);
  const funcs = parseFloat(parts[3]);
  const pctLines = parseFloat(parts[4]);
  const uncovered = parts[5] || "";

  if (isNaN(stmts)) continue;

  // Determine depth for indentation (directories have trailing /)
  const isDir = fileName.endsWith("/") || fileName === "All files";
  rows.push({ fileName, stmts, branch, funcs, lines: pctLines, uncovered, isDir });
}

// ── Generate HTML ────────────────────────────────────────────────────────────

function pctCell(pct) {
  const tier = getTier(pct);
  const barWidth = Math.min(100, Math.max(0, pct));
  return `
    <td style="background:${tier.bg}; color:${tier.text}; font-weight:600; text-align:right; padding:8px 12px; white-space:nowrap;">
      ${pct.toFixed(2)}%
    </td>
    <td style="padding:4px 8px; vertical-align:middle;">
      <div style="background:#E5E7EB; border-radius:9999px; height:10px; width:100px; overflow:hidden;" title="${pct.toFixed(2)}%">
        <div style="background:${tier.bar}; height:100%; width:${barWidth}%; border-radius:9999px; transition:width .3s;"></div>
      </div>
    </td>`;
}

function summaryCard(label, pct) {
  const tier = getTier(pct);
  return `
    <div style="flex:1; min-width:180px; background:${tier.bg}; border-radius:12px; padding:20px; text-align:center; border:2px solid ${tier.bar};">
      <div style="font-size:28px; font-weight:800; color:${tier.text};">${pct.toFixed(2)}%</div>
      <div style="font-size:13px; color:${tier.text}; opacity:.75; margin-top:4px;">${label}</div>
      <div style="margin-top:8px;">
        <span style="background:${tier.badge}; color:#fff; padding:3px 10px; border-radius:9999px; font-size:11px; font-weight:600;">${tier.label}</span>
      </div>
    </div>`;
}

const timestamp = new Date().toLocaleString("es-CO", {
  dateStyle: "long",
  timeStyle: "short",
});

const legendItems = TIERS.map(
  (t) =>
    `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:16px;">
      <span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${t.bar};"></span>
      <span style="font-size:12px;color:#374151;">${t.min}–${t.max === 101 ? 100 : t.max}% ${t.label}</span>
    </span>`
).join("");

const tableRows = rows
  .map((r) => {
    const avgPct = (r.stmts + r.branch + r.funcs + r.lines) / 4;
    const tier = getTier(avgPct);
    const nameStyle = r.isDir
      ? "font-weight:700; color:#111827;"
      : "padding-left:24px; color:#374151;";
    const rowBg = r.fileName === "All files" ? `background:${tier.bg};` : "";
    const fontWeight = r.fileName === "All files" ? "font-weight:700;" : "";
    return `
      <tr style="${rowBg} border-bottom:1px solid #E5E7EB; ${fontWeight}">
        <td style="${nameStyle} padding:8px 12px; white-space:nowrap; max-width:350px; overflow:hidden; text-overflow:ellipsis;" title="${r.fileName}">${r.fileName}</td>
        ${pctCell(r.stmts)}
        ${pctCell(r.branch)}
        ${pctCell(r.funcs)}
        ${pctCell(r.lines)}
        <td style="padding:8px 12px; font-size:11px; color:#6B7280; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${r.uncovered}">${r.uncovered}</td>
      </tr>`;
  })
  .join("");

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E2E Coverage Report — Color</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F9FAFB; color: #111827; }
    .container { max-width: 1400px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; font-weight: 800; color: #111827; }
    .subtitle { font-size: 13px; color: #6B7280; margin-top: 4px; }
    .summary-cards { display: flex; gap: 16px; flex-wrap: wrap; margin: 24px 0; }
    .legend { margin: 16px 0 24px; padding: 12px 16px; background: #fff; border: 1px solid #E5E7EB; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    thead th { background: #1F2937; color: #F9FAFB; padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }
    thead th.num { text-align: right; }
    tbody tr:hover { background: #F3F4F6 !important; }
    .footer { margin-top: 24px; text-align: center; font-size: 12px; color: #9CA3AF; }
    @media print {
      body { background: #fff; }
      .container { padding: 12px; }
      table { box-shadow: none; border: 1px solid #D1D5DB; }
    }
  </style>
</head>
<body>
<div class="container">
  <h1>📊 E2E Coverage Report</h1>
  <p class="subtitle">Generado: ${timestamp}</p>

  ${
    summary
      ? `<div class="summary-cards">
          ${summaryCard("Statements", summary.stmts)}
          ${summaryCard("Branches", summary.branch)}
          ${summaryCard("Functions", summary.funcs)}
          ${summaryCard("Lines", summary.lines)}
        </div>`
      : ""
  }

  <div class="legend">
    <strong style="font-size:12px;color:#374151;margin-right:12px;">Escala de colores:</strong>
    ${legendItems}
  </div>

  <table>
    <thead>
      <tr>
        <th>Archivo</th>
        <th class="num" colspan="2">% Stmts</th>
        <th class="num" colspan="2">% Branch</th>
        <th class="num" colspan="2">% Funcs</th>
        <th class="num" colspan="2">% Lines</th>
        <th>Sin cobertura</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <p class="footer">
    G&M Consultores — Coverage Color Report &middot; Powered by Istanbul + custom post-processing
  </p>
</div>
</body>
</html>`;

// ── Write output ─────────────────────────────────────────────────────────────
const outDir = path.resolve(__dirname, "..", "coverage-e2e");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const outPath = path.join(outDir, "coverage-color-report.html");
fs.writeFileSync(outPath, html, "utf-8");

// ── Terminal summary with ANSI colors ────────────────────────────────────────
const ANSI = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  brightRed: "\x1b[91m",
  orange: "\x1b[38;5;208m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  brightGreen: "\x1b[92m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

function ansiColor(pct) {
  if (pct < 30) return ANSI.red;
  if (pct < 50) return ANSI.brightRed;
  if (pct < 65) return ANSI.orange;
  if (pct < 80) return ANSI.yellow;
  if (pct < 90) return ANSI.green;
  return ANSI.brightGreen;
}

function tierLabel(pct) {
  return getTier(pct).label;
}

console.log("");
console.log(`${ANSI.bold}📊 E2E Coverage Color Report${ANSI.reset}`);
console.log(`${ANSI.dim}────────────────────────────────────────${ANSI.reset}`);

if (summary) {
  const metrics = [
    ["Statements", summary.stmts],
    ["Branches ", summary.branch],
    ["Functions ", summary.funcs],
    ["Lines    ", summary.lines],
  ];
  for (const [label, pct] of metrics) {
    const color = ansiColor(pct);
    const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
    console.log(`  ${label}  ${color}${ANSI.bold}${pct.toFixed(2).padStart(6)}%${ANSI.reset}  ${color}${bar}${ANSI.reset}  ${ANSI.dim}${tierLabel(pct)}${ANSI.reset}`);
  }
  console.log(`${ANSI.dim}────────────────────────────────────────${ANSI.reset}`);
}

// Show bottom 10 files by lines coverage (excluding directories and "All files")
const fileRows = rows.filter((r) => !r.isDir && r.fileName !== "All files");
fileRows.sort((a, b) => a.lines - b.lines);
const bottom10 = fileRows.slice(0, 10);

if (bottom10.length > 0) {
  console.log(`${ANSI.bold}  ⚠  10 archivos con menor cobertura (Lines):${ANSI.reset}`);
  for (const r of bottom10) {
    const color = ansiColor(r.lines);
    console.log(`  ${color}${r.lines.toFixed(1).padStart(6)}%${ANSI.reset}  ${r.fileName}`);
  }
  console.log(`${ANSI.dim}────────────────────────────────────────${ANSI.reset}`);
}

console.log(`${ANSI.green}  ✅ HTML report: coverage-e2e/coverage-color-report.html${ANSI.reset}`);
console.log("");
