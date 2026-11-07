const { ethers } = require("ethers");
const cfg = require("./config");

// Polygon networks (incl. Amoy) reject transactions whose priority fee is below ~25 gwei.
// Some public RPCs suggest a lower value, which ethers reports as "could not coalesce error".
// So on non-local networks we enforce a safe minimum tip.
const MIN_TIP = ethers.parseUnits(process.env.MIN_TIP_GWEI || "30", "gwei");

class FeeSafeProvider extends ethers.JsonRpcProvider {
    async getFeeData() {
        const fd = await super.getFeeData();
        const tip = fd.maxPriorityFeePerGas ?? 0n;
        if (cfg.NETWORK === "localhost" || tip >= MIN_TIP) return fd;
        const maxFee = (fd.maxFeePerGas ?? 0n) + (MIN_TIP - tip);
        return new ethers.FeeData(fd.gasPrice, maxFee, MIN_TIP);
    }
}

const provider = new FeeSafeProvider(cfg.RPC_URL);
const signer = new ethers.NonceManager(new ethers.Wallet(cfg.PRIVATE_KEY, provider));
const contract = new ethers.Contract(cfg.ADDRESS, cfg.ABI, signer);
module.exports = { provider, contract };