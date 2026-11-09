import { hasPermission } from "../config/roles.js";

export function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const userRole = req.user.role;
    const allowed = permissions.some((perm) => hasPermission(userRole, perm));

    if (!allowed) {
      return res.status(403).json({ message: "Forbidden: insufficient permissions." });
    }

    next();
  };
}
