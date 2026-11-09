import { UserBadges } from "./UserBadges";
import type { User } from "../../types";

export function StaffBadge({ className = "h-4 w-4", role }: { className?: string; role: User["role"] }) {
  return <UserBadges user={{ role }} className={className} />;
}
