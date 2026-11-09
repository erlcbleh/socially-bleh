import { effectiveRole } from "../config/roles.js";

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(effectiveRole(req.user))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}
