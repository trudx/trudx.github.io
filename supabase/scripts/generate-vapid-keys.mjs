import { webcrypto } from "node:crypto";

const keys = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const publicKeyJwk = await webcrypto.subtle.exportKey("jwk", keys.publicKey);
const privateKeyJwk = await webcrypto.subtle.exportKey("jwk", keys.privateKey);
const applicationServerKey = Buffer.concat([
  Buffer.from([0x04]),
  Buffer.from(publicKeyJwk.x, "base64url"),
  Buffer.from(publicKeyJwk.y, "base64url"),
]).toString("base64url");
const vapidKeysJson = JSON.stringify({ publicKey: publicKeyJwk, privateKey: privateKeyJwk });

console.log(`NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY=${applicationServerKey}`);
console.log(`VAPID_KEYS_JSON=${vapidKeysJson}`);
