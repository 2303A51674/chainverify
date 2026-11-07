// Generates data/products.csv – 60 product lines (SKUs) from fictional brands.
const fs = require("fs");
const path = require("path");

let seed = 42; // deterministic
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const catalog = {
  "Footwear":     { brands: ["Acme Footwear Ltd", "StrideCraft India"], items: ["AeroRun Sneakers", "TrailBlazer Boots", "CloudWalk Sandals", "UrbanStep Loafers", "SprintPro Spikes"], price: [1499, 7999] },
  "Electronics":  { brands: ["Voltix Electronics", "NovaSound Pvt Ltd"], items: ["BassPods Earbuds", "PowerCore 20000 Power Bank", "SmartFit Band 5", "ClearView Webcam 1080p", "PulseSpeaker Mini"], price: [799, 5999] },
  "Pharma":       { brands: ["MediTrust Labs", "CureWell Pharma"], items: ["Paracetamol 500mg (10 tabs)", "Vitamin D3 60K IU Capsules", "ORS Electrolyte Sachets", "Cough Syrup 100ml", "Antacid Gel 200ml"], price: [20, 450] },
  "Cosmetics":    { brands: ["GlowLeaf Naturals", "Aura Beauty Co"], items: ["Vitamin C Face Serum 30ml", "SPF 50 Sunscreen 50g", "Aloe Vera Gel 200ml", "Matte Lipstick - Ruby", "Hair Repair Shampoo 250ml"], price: [149, 1299] },
  "Luxury Goods": { brands: ["Maison Orion", "Heritage Timepieces"], items: ["Orion Leather Wallet", "Classic Chronograph Watch", "Crest Aviator Sunglasses", "Signature Leather Belt", "Heritage Silk Scarf"], price: [2999, 49999] },
  "Auto Parts":   { brands: ["TorqueLine Auto", "RoadSafe Components"], items: ["Ceramic Brake Pads (Front)", "Synthetic Engine Oil 4L", "Iridium Spark Plug", "Cabin Air Filter", "LED Headlamp Bulb H4"], price: [250, 6500] },
};

const rows = [["sku", "name", "category", "manufacturer", "batch", "quantity", "mrp_inr"]];
let n = 1;
for (const [cat, c] of Object.entries(catalog)) {
  for (let i = 0; i < 10; i++) {
    const name = c.items[i % c.items.length];
    const mfr = pick(c.brands);
    const month = String(1 + Math.floor(rnd() * 10)).padStart(2, "0");
    const batch = `B-2026-${month}-${String.fromCharCode(65 + Math.floor(rnd() * 6))}${Math.floor(rnd() * 90 + 10)}`;
    const qty = 5 + Math.floor(rnd() * 11); // 5-15 units per line
    const price = Math.round((c.price[0] + rnd() * (c.price[1] - c.price[0])) / 10) * 10 - 1;
    rows.push([`SKU${String(n++).padStart(4, "0")}`, name, cat, mfr, batch, qty, price]);
  }
}
fs.mkdirSync(path.join(__dirname, "../data"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "../data/products.csv"), rows.map((r) => r.join(",")).join("\n") + "\n");
console.log(`Wrote data/products.csv (${rows.length - 1} product lines, ${rows.slice(1).reduce((a, r) => a + +r[5], 0)} units)`);
