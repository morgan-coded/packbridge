import crypto from "node:crypto";
import prisma from "../db.server";

/**
 * Ensure the Shop row exists and has a signing secret for outbound HMAC.
 * Called from `afterAuth` so every shop has a secret from install onward.
 * Does not overwrite an existing secret.
 */
export async function ensureShopSettings(shopDomain: string): Promise<void> {
  const existing = await prisma.shop.findUnique({
    where: { id: shopDomain },
    select: { id: true, signingSecret: true },
  });

  if (!existing) {
    await prisma.shop.create({
      data: {
        id: shopDomain,
        signingSecret: crypto.randomBytes(32).toString("hex"),
      },
    });
    return;
  }

  if (!existing.signingSecret) {
    await prisma.shop.update({
      where: { id: shopDomain },
      data: { signingSecret: crypto.randomBytes(32).toString("hex") },
    });
  }
}

/**
 * Rotate the signing secret for a shop. Returns the new secret.
 * Called from the settings page.
 */
export async function regenerateSigningSecret(
  shopDomain: string,
): Promise<string> {
  const secret = crypto.randomBytes(32).toString("hex");
  await prisma.shop.update({
    where: { id: shopDomain },
    data: { signingSecret: secret },
  });
  return secret;
}
