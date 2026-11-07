const crypto = require("crypto");
const { ethers } = require("ethers");
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const SERIAL_RE = /^PV-[A-HJ-NP-Z2-9]{8}$/;

function newSerial() {
  const bytes = crypto.randomBytes(8);
  return "PV-" + [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}
const hashSerial = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));
module.exports = { newSerial, hashSerial, SERIAL_RE };
