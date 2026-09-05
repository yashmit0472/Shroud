import crypto from "crypto";

const TOKEN_PREFIX = "shroud_";

export function generateApiToken() {
  const secret = crypto.randomBytes(32).toString("hex");
  const token = `${TOKEN_PREFIX}${secret}`;

  return {
    token,
    prefix: token.slice(0, 15),
    hash: hashApiToken(token),
  };
}

export function hashApiToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
