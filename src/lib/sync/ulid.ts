/** Générateur ULID minimal (identifiants uniques triables, sans collision entre postes). */
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function randomChars(len: number) {
  const bytes = new Uint8Array(len);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  let out = "";
  for (let i = 0; i < len; i++) out += ENCODING[bytes[i]! % 32];
  return out;
}

export function ulid(now: number = Date.now()): string {
  let time = "";
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = ENCODING[t % 32] + time;
    t = Math.floor(t / 32);
  }
  return time + randomChars(16);
}
