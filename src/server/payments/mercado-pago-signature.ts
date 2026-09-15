import { createHmac, timingSafeEqual } from "node:crypto";

function signatureParts(header: string | null) {
  return new Map((header ?? "").split(",").flatMap((entry) => {
    const separator = entry.indexOf("=");
    if (separator < 1) return [];
    return [[entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()] as const];
  }));
}

export function verifyMercadoPagoSignature(input: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string;
  secret: string;
}) {
  const parts = signatureParts(input.signatureHeader);
  const timestamp = parts.get("ts");
  const receivedHash = parts.get("v1")?.toLowerCase();
  if (!timestamp || !receivedHash || !/^[a-f0-9]{64}$/.test(receivedHash)) return false;

  const manifest = [
    `id:${input.dataId.toLowerCase()};`,
    input.requestId ? `request-id:${input.requestId};` : "",
    `ts:${timestamp};`,
  ].join("");
  const expectedHash = createHmac("sha256", input.secret).update(manifest).digest("hex");
  return timingSafeEqual(Buffer.from(receivedHash, "hex"), Buffer.from(expectedHash, "hex"));
}
