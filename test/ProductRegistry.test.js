const { expect } = require("chai");
const { ethers } = require("hardhat");

const h = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));

describe("ProductRegistry", () => {
  let reg, owner, mfr, stranger;
  beforeEach(async () => {
    [owner, mfr, stranger] = await ethers.getSigners();
    reg = await (await ethers.getContractFactory("ProductRegistry")).deploy();
  });

  it("owner is an authorised manufacturer by default", async () => {
    expect(await reg.manufacturers(owner.address)).to.equal(true);
  });

  it("registers and verifies a product", async () => {
    await reg.registerProduct(h("PV-AAA"), "Sneaker", "B1", "Acme");
    const r = await reg.verifyProduct(h("PV-AAA"));
    expect(r.exists).to.equal(true);
    expect(r.name).to.equal("Sneaker");
    expect(r.batch).to.equal("B1");
    expect(r.flagged).to.equal(false);
    expect(await reg.totalProducts()).to.equal(1n);
  });

  it("returns exists=false for unknown serials (fake)", async () => {
    expect((await reg.verifyProduct(h("PV-FAKE"))).exists).to.equal(false);
  });

  it("rejects duplicate registration", async () => {
    await reg.registerProduct(h("X"), "n", "b", "m");
    await expect(reg.registerProduct(h("X"), "n", "b", "m")).to.be.revertedWithCustomError(reg, "AlreadyRegistered");
  });

  it("blocks unauthorised accounts", async () => {
    await expect(reg.connect(stranger).registerProduct(h("Y"), "n", "b", "m")).to.be.revertedWithCustomError(reg, "NotManufacturer");
    await expect(reg.connect(stranger).setManufacturer(stranger.address, true)).to.be.revertedWithCustomError(reg, "NotOwner");
  });

  it("owner can add and remove manufacturers", async () => {
    await reg.setManufacturer(mfr.address, true);
    await reg.connect(mfr).registerProduct(h("Z"), "n", "b", "m");
    await reg.setManufacturer(mfr.address, false);
    await expect(reg.connect(mfr).registerProduct(h("Z2"), "n", "b", "m")).to.be.revertedWithCustomError(reg, "NotManufacturer");
  });

  it("registers batches atomically", async () => {
    await reg.registerBatch([h("1"), h("2"), h("3")], "n", "b", "m");
    expect(await reg.totalProducts()).to.equal(3n);
    await expect(reg.registerBatch([h("4"), h("1")], "n", "b", "m")).to.be.revertedWithCustomError(reg, "AlreadyRegistered");
    expect(await reg.totalProducts()).to.equal(3n);
    await expect(reg.registerBatch([], "n", "b", "m")).to.be.revertedWithCustomError(reg, "EmptyInput");
  });

  it("flags products", async () => {
    await reg.registerProduct(h("F"), "n", "b", "m");
    await reg.flagProduct(h("F"));
    expect((await reg.verifyProduct(h("F"))).flagged).to.equal(true);
    await expect(reg.flagProduct(h("nope"))).to.be.revertedWithCustomError(reg, "NotFound");
  });
});
