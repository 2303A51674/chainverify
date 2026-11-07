// Registers every unit in data/products.csv on the blockchain.
// Outputs: data/registered_serials.csv (genuine, scan-able) and data/fake_serials.csv (never registered).
const fs = require("fs");
const path = require("path");
const { contract, provider } = require("../server/chain");
const { newSerial, hashSerial } = require("../server/serial");

const dataDir = path.join(__dirname, "../data");
const lines = fs.readFileSync(path.join(dataDir, "products.csv"), "utf8").trim().split("\n").slice(1);
const CHUNK = 25;

(async () => {
  const net = await provider.getNetwork();
  console.log("Connected to chain", net.chainId.toString(), "– registering…");
  const out = ["serial,sku,name,category,manufacturer,batch,mrp_inr"];
  let total = 0;
  for (const line of lines) {
    const [sku, name, category, manufacturer, batch, qty, mrp] = line.split(",");
    const serials = Array.from({ length: +qty }, newSerial);
    for (let i = 0; i < serials.length; i += CHUNK) {
      const part = serials.slice(i, i + CHUNK);
      const tx = await contract.registerBatch(part.map(hashSerial), name, batch, manufacturer);
      await tx.wait();
    }
    serials.forEach((s) => out.push([s, sku, name, category, manufacturer, batch, mrp].join(",")));
    total += serials.length;
    process.stdout.write(`\r${sku} done – ${total} units`);
  }
  fs.writeFileSync(path.join(dataDir, "registered_serials.csv"), out.join("\n") + "\n");
  const fakes = ["serial", ...Array.from({ length: 30 }, newSerial)];
  fs.writeFileSync(path.join(dataDir, "fake_serials.csv"), fakes.join("\n") + "\n");
  console.log(`\nDone. ${total} genuine serials → data/registered_serials.csv, 30 fake serials → data/fake_serials.csv`);
  console.log("On-chain total:", (await contract.totalProducts()).toString());
})().catch((e) => { console.error(e); process.exit(1); });
