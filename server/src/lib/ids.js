import { randomBytes } from "crypto";

export function newId() {
  return randomBytes(12).toString("hex");
}

export function isValidObjectId(id) {
  return typeof id === "string" && /^[a-fA-F0-9]{24}$/.test(id);
}

export function asId(value) {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value.id) return String(value.id);
  return String(value);
}
