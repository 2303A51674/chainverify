# ChainVerify – blockchain product authenticity

**Stack:** Solidity (Hardhat) · Node.js/Express (ethers v6) · plain HTML/JS frontend with QR scan + generate.

```
contracts/ProductRegistry.sol   smart contract (stores keccak256(serial) + product details)
test/                           contract tests
scripts/make-dataset.js         generates data/products.csv (60 SKUs, 639 units)
scripts/seed.js                 registers the dataset on-chain, writes genuine + fake serial lists
scripts/deploy.js               deploys, saves deployments/<network>.json (address + ABI)
server/                         API: /api/verify, /api/register, /api/flag, /api/ledger
public/index.html               Verify · Manufacturer · Ledger UI
```

Requires **Node.js 18+** (20 or 22 recommended).

## 1. Run on localhost (3 terminals, no wallet or .env needed)

```bash
npm install
npm test                 # 8 contract tests should pass

# Terminal 1 – local blockchain (keep running)
npm run node

# Terminal 2 – deploy + load dataset
npm run deploy:local
npm run seed             # registers 639 units; creates data/registered_serials.csv & data/fake_serials.csv

# Terminal 3 – web app
npm start                # open http://localhost:3000
```

**Try it:** open the Verify tab, paste any serial from `data/registered_serials.csv` → ✅ Genuine.
Verify the same one again → ⚠️ already verified (clone warning). Paste one from `data/fake_serials.csv` → ❌ Fake.
Manufacturer tab: admin key is `admin123` locally; it registers new items and shows printable QR labels.
Scan a label with the camera (works on `localhost`) or upload a screenshot of a QR.

> Restarting `npm run node` wipes the chain: re-run `deploy:local` and `seed` (the old serial CSVs become invalid).
> To reset scan counts, delete `data/scans.json`.

## 2. Deploy for real (Polygon Amoy testnet + Render)

1. Create a **new throwaway wallet** in MetaMask, copy its private key, and fund it with free test POL from the Polygon faucet.
2. `cp .env.example .env` and fill in `PRIVATE_KEY`, `ADMIN_KEY` (long random string). Keep `NETWORK=amoy`. Never commit `.env`.
3. `npm run deploy:amoy` → creates `deployments/amoy.json` (address + ABI – safe to commit).
4. Push the project to GitHub (without `.env`).
5. On **Render** → New Web Service → your repo: Build `npm install`, Start `npm start`.
   Environment variables: `NETWORK=amoy`, `NODE_ENV=production`, `AMOY_RPC_URL`, `PRIVATE_KEY`, `ADMIN_KEY`.
6. Open your `https://….onrender.com` URL. HTTPS means phone camera scanning works.
7. Register products **from the deployed site** – the QR labels encode that site's URL, so a phone's normal camera app opens the verification page directly.
8. (Optional) Load the dataset on-chain: with `.env` set and `NETWORK=amoy`, run `npm run seed`.

**Notes**
- Scan counts live in `data/scans.json`. Render's free disk is wiped on redeploy; attach a persistent disk and set `SCANS_FILE=/var/data/scans.json`, or move counts to a database.
- Only the keccak256 hash of each serial is on-chain, never the serial itself.
- The server wallet signs registrations, so protect `PRIVATE_KEY` and `ADMIN_KEY`. Move to mainnet only after a security audit.
