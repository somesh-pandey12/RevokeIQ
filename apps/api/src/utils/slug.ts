import crypto from "crypto";

export function makeSlug(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  return `${base || "company"}-${crypto.randomBytes(2).toString("hex")}`;
}