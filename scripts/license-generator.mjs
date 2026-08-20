#!/usr/bin/env node
/**
 * ManagByte License Generator CLI (offline, Ed25519).
 *
 * Usage:
 *   node scripts/license-generator.mjs keygen
 *     → generates ~/.managbyte/keys/{private,public}.pem
 *       and prints the base64url public key to embed in src/core/license.ts
 *
 *   node scripts/license-generator.mjs issue \
 *     --machine  1A3C72956371D459 \   ← Machine ID from /activate page
 *     --customer "Ahmed Ali" \
 *     --company  "ACME SARL" \
 *     --type     subscription          # trial | subscription | lifetime | enterprise
 *     --days     365                   # omit for lifetime/enterprise
 *     --features pos,reports,backup
 *
 *   Use --machine "*" to issue a wildcard/developer key (any machine).
 *
 * Give the printed "MB1.xxxx.yyyy" key to the customer. Only YOU hold the
 * private key, so no one else can produce valid licenses.
 */
import {
  generateKeyPairSync,
  sign,
  randomBytes,
} from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createPrivateKey } from "node:crypto";

const KEYS_DIR = join(homedir(), ".managbyte", "keys");
const PRIV     = join(KEYS_DIR, "private.pem");
const PUB      = join(KEYS_DIR, "public.pem");

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function keygen() {
  mkdirSync(KEYS_DIR, { recursive: true });
  if (existsSync(PRIV)) {
    console.error("Keys already exist at", KEYS_DIR);
    console.error("Delete them first if you want to regenerate (this will invalidate all issued licenses).");
    process.exit(1);
  }
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  writeFileSync(PRIV, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  writeFileSync(PUB,  publicKey.export({ type: "spki",  format: "pem" }));

  const spkiDer = publicKey.export({ type: "spki", format: "der" });
  console.log("\n✅ Keys generated at:", KEYS_DIR);
  console.log("\nPaste this into VENDOR_PUBLIC_KEY_B64URL in src/core/license.ts:\n");
  console.log(b64url(spkiDer));
  console.log("\n⚠️  Keep private.pem safe — back it up encrypted, never commit it to git.\n");
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

function issue(argv) {
  if (!existsSync(PRIV)) {
    console.error("Private key not found. Run `node scripts/license-generator.mjs keygen` first.");
    process.exit(1);
  }
  const a = parseArgs(argv);
  const required = ["machine", "customer", "company", "type"];
  for (const r of required) {
    if (!a[r]) { console.error(`Missing required argument: --${r}`); process.exit(1); }
  }

  const types = ["trial", "subscription", "lifetime", "enterprise"];
  if (!types.includes(a.type)) {
    console.error(`--type must be one of: ${types.join(", ")}`);
    process.exit(1);
  }

  const payload = {
    customer:  a.customer,
    company:   a.company,
    machineId: a.machine,
    type:      a.type,
    issuedAt:  new Date().toISOString(),
    expiresAt: a.days
      ? new Date(Date.now() + Number(a.days) * 86_400_000).toISOString()
      : undefined,
    features: (a.features ?? "pos,reports").split(",").filter(Boolean),
    nonce:    b64url(randomBytes(8)),
  };

  // Remove undefined keys
  if (!payload.expiresAt) delete payload.expiresAt;

  const payloadBytes = Buffer.from(JSON.stringify(payload));
  const priv         = createPrivateKey(readFileSync(PRIV));
  const sig          = sign(null, payloadBytes, priv);
  const key          = `MB1.${b64url(payloadBytes)}.${b64url(sig)}`;

  console.log("\n✅ License key (send this to the customer):\n");
  console.log(key);
  console.log("\nPayload:", JSON.stringify(payload, null, 2));
}

const cmd = process.argv[2];
if (cmd === "keygen") keygen();
else if (cmd === "issue") issue(process.argv.slice(3));
else {
  console.log("Usage:");
  console.log("  node scripts/license-generator.mjs keygen");
  console.log("  node scripts/license-generator.mjs issue --machine <ID> --customer <name> --company <name> --type <type> [--days <n>] [--features a,b,c]");
  process.exit(1);
}
