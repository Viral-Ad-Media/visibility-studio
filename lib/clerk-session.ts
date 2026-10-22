import crypto from "node:crypto";

export const CLERK_SESSION_COOKIE = "vis_clerk_session";
export const CLERK_DEFAULT_SESSION_SECONDS = 60 * 60 * 24 * 7; // 7 days
const CLOCK_SKEW_SECONDS = 5;

export type VerifiedClerkSession = {
  subject: string;
  issuer: string;
  sessionId?: string;
};

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecodeToBuffer(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

export function signClerkSessionToken(params: {
  subject: string;
  issuer: string;
  secretKey: string;
  sessionId?: string;
  nowSeconds?: number;
  expiresInSeconds?: number;
}): string {
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const exp = now + (params.expiresInSeconds ?? CLERK_DEFAULT_SESSION_SECONDS);
  const header = { alg: "HS256", typ: "vis-clerk-session" };
  const payload: Record<string, unknown> = {
    iss: params.issuer,
    sub: params.subject,
    iat: now,
    nbf: now,
    exp,
  };
  if (params.sessionId) {
    payload.sid = params.sessionId;
  }
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = crypto
    .createHmac("sha256", params.secretKey)
    .update(signingInput)
    .digest("base64url");
  return `${signingInput}.${signature}`;
}

export function verifyClerkSessionToken(
  token: string | undefined | null,
  options: {
    issuer: string;
    secretKey: string;
    jwksKeys?: crypto.JsonWebKey[];
    authorizedOrigins?: string[];
    nowSeconds?: number;
  },
): VerifiedClerkSession | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  if (!headerPart || !payloadPart || !signaturePart) return null;

  let header: { alg?: string; typ?: string; kid?: string };
  let payload: {
    iss?: string;
    sub?: string;
    sid?: string;
    exp?: number;
    nbf?: number;
    azp?: string;
  };
  try {
    header = JSON.parse(base64UrlDecodeToBuffer(headerPart).toString("utf8"));
    payload = JSON.parse(base64UrlDecodeToBuffer(payloadPart).toString("utf8"));
  } catch {
    return null;
  }

  const signingInput = `${headerPart}.${payloadPart}`;
  const sigBytes = base64UrlDecodeToBuffer(signaturePart);

  if (header.alg === "HS256" && header.typ === "vis-clerk-session") {
    const expected = crypto
      .createHmac("sha256", options.secretKey)
      .update(signingInput)
      .digest();
    if (
      sigBytes.length !== expected.length ||
      !crypto.timingSafeEqual(sigBytes, expected)
    ) {
      return null;
    }
  } else if (header.alg === "RS256" && options.jwksKeys?.length) {
    const matchingKey =
      options.jwksKeys.find((k: any) => !header.kid || k.kid === header.kid) ??
      options.jwksKeys[0];
    try {
      const publicKey = crypto.createPublicKey({
        key: matchingKey as any,
        format: "jwk",
      });
      const valid = crypto.verify(
        "RSA-SHA256",
        Buffer.from(signingInput, "utf8"),
        publicKey,
        sigBytes,
      );
      if (!valid) return null;
    } catch {
      return null;
    }
  } else {
    return null;
  }

  if (payload.iss !== options.issuer) return null;
  if (
    typeof payload.sub !== "string" ||
    !payload.sub.startsWith("user_") ||
    payload.sub.length < 8
  ) {
    return null;
  }

  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || now > payload.exp + CLOCK_SKEW_SECONDS) {
    return null;
  }
  if (
    typeof payload.nbf === "number" &&
    now + CLOCK_SKEW_SECONDS < payload.nbf
  ) {
    return null;
  }
  if (
    payload.azp &&
    options.authorizedOrigins &&
    options.authorizedOrigins.length > 0 &&
    !options.authorizedOrigins.includes(payload.azp)
  ) {
    return null;
  }

  return {
    subject: payload.sub,
    issuer: payload.iss,
    ...(typeof payload.sid === "string" ? { sessionId: payload.sid } : {}),
  };
}
