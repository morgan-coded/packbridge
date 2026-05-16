import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashPayload, signPayload } from "./outbound.server";

describe("signPayload", () => {
  it("returns an HMAC-SHA256 signature in `sha256=<hex>` form", () => {
    const body = '{"hello":"world"}';
    const secret = "shhhh";

    const expected =
      "sha256=" +
      crypto.createHmac("sha256", secret).update(body).digest("hex");

    expect(signPayload(body, secret)).toBe(expected);
  });

  it("produces a different signature for a different body", () => {
    const secret = "s";
    expect(signPayload("a", secret)).not.toBe(signPayload("b", secret));
  });

  it("produces a different signature for a different secret", () => {
    const body = "payload";
    expect(signPayload(body, "k1")).not.toBe(signPayload(body, "k2"));
  });

  it("is deterministic for identical inputs", () => {
    expect(signPayload("payload", "k")).toBe(signPayload("payload", "k"));
  });
});

describe("hashPayload", () => {
  it("returns a SHA-256 hex digest of the body", () => {
    const body = '{"a":1}';
    const expected = crypto.createHash("sha256").update(body).digest("hex");
    expect(hashPayload(body)).toBe(expected);
  });

  it("is deterministic for identical inputs", () => {
    expect(hashPayload("x")).toBe(hashPayload("x"));
  });
});
