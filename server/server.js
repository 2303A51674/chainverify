const express = require("express");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const cfg = require("./config");
const { provider, contract } = require("./chain");
const { newSerial, hashSerial, SERIAL_RE } = require("./serial");

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "20kb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 120 }));

/* ---- scan counter (clone detection) ---- */
let scans = {};
try { scans = JSON.parse(fs.readFileSync(cfg.SCANS_FILE, "utf8")); } catch { /* first run */ }
function recordScan(serial) {
  const now = Date.now();
  const s = scans[serial] || { count: 0, first: now };
  s.count += 1; s.last = now; scans[serial] = s;
  try { fs.writeFileSync(cfg.SCANS_FILE, JSON.stringify(scans)); } catch (e) { console.error("scan save failed", e.message); }
  return s;
}

const isAdmin = (req) => {
  const a = Buffer.from(String(req.get("x-api-key") || ""));
  const b = Buffer.from(cfg.ADMIN_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: e.shortMessage || e.reason || e.message || "Server error" });
});
const clean = (v, d) => String(v ?? d).trim().slice(0, 100) || d;

/* ---- public: verify ---- */
app.get("/api/verify/:serial", wrap(async (req, res) => {
  const serial = String(req.params.serial).trim().toUpperCase();
  if (!SERIAL_RE.test(serial)) return res.json({ status: "invalid", serial });
  const r = await contract.verifyProduct(hashSerial(serial));
  if (!r.exists) return res.json({ status: "fake", serial });
  const product = {
    name: r.name, batch: r.batch, manufacturer: r.manufacturer,
    registeredAt: Number(r.registeredAt) * 1000, registeredBy: r.registeredBy,
  };
  if (r.flagged) return res.json({ status: "flagged", serial, product });
  const s = recordScan(serial);
  res.json({ status: s.count === 1 ? "genuine" : "reused", serial, product, scans: s });
}));

/* ---- public: ledger ----
   Event history is read with eth_getLogs. Many free public RPCs reject or limit that call, so we try
   several RPC URLs in turn, and fall back to this server's own record of what it registered. */
const FALLBACK_RPCS = [
  "https://rpc-amoy.polygon.technology",
  "https://polygon-amoy-bor-rpc.publicnode.com",
  "https://polygon-amoy.drpc.org",
  "https://polygon-amoy.api.onfinality.io/public",
];
const LOG_RPCS = process.env.LOG_RPC_URLS
  ? process.env.LOG_RPC_URLS.split(",").map((x) => x.trim()).filter(Boolean)
  : [...new Set([cfg.RPC_URL, ...(cfg.NETWORK === "localhost" ? [] : FALLBACK_RPCS)])];

async function jsonRpc(url, method, params) {
  const r = await fetch(url, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`${new URL(url).host} replied HTTP ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(`${new URL(url).host}: ${j.error.message || JSON.stringify(j.error)}`);
  return j.result;
}

const EVENT_TOPIC = contract.interface.getEvent("ProductRegistered").topicHash;
const evCache = { items: [], next: cfg.DEPLOY_BLOCK };
async function scanWith(url, chunk) {
  const latest = parseInt(await jsonRpc(url, "eth_blockNumber", []), 16);
  for (let calls = 0; evCache.next <= latest && calls < 100; calls++) {
    const to = Math.min(evCache.next + chunk - 1, latest);
    const logs = await jsonRpc(url, "eth_getLogs", [{
      address: cfg.ADDRESS, topics: [EVENT_TOPIC],
      fromBlock: "0x" + evCache.next.toString(16), toBlock: "0x" + to.toString(16),
    }]);
    for (const l of logs) {
      const a = contract.interface.parseLog(l).args;
      evCache.items.push({
        serialHash: a.serialHash, name: a.name, batch: a.batch, manufacturer: a.manufacturer,
        block: parseInt(l.blockNumber, 16), tx: l.transactionHash
      });
    }
    evCache.next = to + 1; // progress is kept even if a later chunk fails
  }
}
let goodRpc = null; // remember the RPC that last worked and try it first next time
async function syncEvents() {
  let lastErr;
  const order = goodRpc ? [goodRpc, ...LOG_RPCS.filter((u) => u !== goodRpc)] : LOG_RPCS;
  for (const url of order) for (const chunk of [1000, 100]) {
    try { await scanWith(url, chunk); goodRpc = url; return; }
    catch (e) { lastErr = e; console.warn(`ledger: ${e.message} (chunk ${chunk})`); }
  }
  throw lastErr;
}

// this server's own record of registrations (used only if no RPC will serve event history)
const LEDGER_FILE = process.env.LEDGER_FILE || path.join(__dirname, "..", "data", "ledger.json");
let localLedger = [];
try { localLedger = JSON.parse(fs.readFileSync(LEDGER_FILE, "utf8")); } catch { /* none yet */ }
function recordLocal(items) {
  localLedger.push(...items);
  try { fs.writeFileSync(LEDGER_FILE, JSON.stringify(localLedger)); } catch (e) { console.error("ledger save failed", e.message); }
}

let syncing = null, failedAt = 0, failNote = "";
app.get("/api/ledger", wrap(async (req, res) => {
  let note;
  if (Date.now() - failedAt < 30_000) note = failNote;
  else {
    try { await (syncing ||= syncEvents().finally(() => { syncing = null; })); }
    catch (e) {
      failedAt = Date.now();
      failNote = `The RPC servers refused the event-history request (${e.message}). Showing items registered through this server instead.`;
      note = failNote;
    }
  }
  const total = Number(await contract.totalProducts());
  const items = (note ? localLedger : evCache.items).slice(-50).reverse();
  res.json({ total, contract: cfg.ADDRESS, network: cfg.NETWORK, items, note });
}));

/* ---- admin: register ---- */
app.post("/api/register", wrap(async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Invalid admin key" });
  const qty = Math.floor(Number(req.body.quantity));
  if (!(qty >= 1 && qty <= 200)) return res.status(400).json({ error: "quantity must be 1-200" });
  const name = clean(req.body.name, "Product"), batch = clean(req.body.batch, "-"), mfr = clean(req.body.manufacturer, "-");
  const serials = Array.from({ length: qty }, newSerial);
  const txs = [];
  for (let i = 0; i < serials.length; i += 25) { // keep each tx well under the block gas limit
    const chunk = serials.slice(i, i + 25);
    const tx = await contract.registerBatch(chunk.map(hashSerial), name, batch, mfr);
    const rc = await tx.wait();
    txs.push(tx.hash);
    recordLocal(chunk.map((x) => ({ serialHash: hashSerial(x), name, batch, manufacturer: mfr, block: rc.blockNumber, tx: tx.hash })));
  }
  res.json({ serials, txs, name, batch, manufacturer: mfr });
}));

/* ---- admin: flag as compromised ---- */
app.post("/api/flag", wrap(async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Invalid admin key" });
  const serial = String(req.body.serial || "").trim().toUpperCase();
  if (!SERIAL_RE.test(serial)) return res.status(400).json({ error: "Invalid serial" });
  const tx = await contract.flagProduct(hashSerial(serial));
  await tx.wait();
  res.json({ ok: true, tx: tx.hash });
}));

app.get("/api/health", (req, res) => res.json({ ok: true, network: cfg.NETWORK, contract: cfg.ADDRESS }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.listen(cfg.PORT, () => console.log(`ChainVerify running → http://localhost:${cfg.PORT}  (network: ${cfg.NETWORK}, contract: ${cfg.ADDRESS})`));