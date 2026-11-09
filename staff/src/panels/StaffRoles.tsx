import { useState } from "react";
import { useQuery } from "@socially/shared/queryStore";
import { api } from "../lib/api";
import { setSelection } from "../lib/selectionBus";
import {
  ActionButton,
  Meta,
  PanelScroll,
  PanelShell,
  PanelToolbar,
  QueryState,
  Row,
  Segmented,
  Tag,
} from "../components/panelKit";
import { UserPicker } from "../components/UserPicker";
import { RANK_LEVEL } from "../types";
import type { AssignableRole, PlatformRole, StaffMember, UserLookupResult } from "../types";

interface MembersResponse {
  users: StaffMember[];
  actorRole: PlatformRole;
  assignableRoles: AssignableRole[];
}

const TONE: Record<string, "high" | "medium" | "low"> = {
  owner: "high",
  developer: "high",
  admin: "medium",
  staff: "low",
};

export function StaffRoles() {
  const [picked, setPicked] = useState<UserLookupResult | null>(null);
  const [target, setTarget] = useState<AssignableRole>("staff");
  const [error, setError] = useState<string | null>(null);

  const query = useQuery<MembersResponse>({
    queryKey: ["staff", "members"],
    queryFn: () => api.get<MembersResponse>("/staff-members"),
  });

  const members = query.data?.users ?? [];
  const assignable = query.data?.assignableRoles ?? [];
  const actorLevel = RANK_LEVEL[query.data?.actorRole ?? "user"] ?? 0;

  const setRole = (name: string, role: AssignableRole) => {
    setError(null);
    api
      .post(`/users/${encodeURIComponent(name)}/role`, { role })
      .then(() => {
        setPicked(null);
        return query.refetch();
      })
      .catch((err: Error) => setError(err.message));
  };

  const promotable = assignable.filter((role) => role !== "user");

  return (
    <PanelShell>
      <PanelToolbar>
        <UserPicker
          value={picked}
          onChange={setPicked}
          placeholder="Search an account"
          label="Account to assign a role"
          className="flex-1"
        />
        {promotable.length > 1 ? (
          <Segmented value={target} options={promotable} onChange={setTarget} />
        ) : null}
        <ActionButton
          onClick={() => picked && setRole(picked.username, target)}
          tone="primary"
          disabled={!picked || promotable.length === 0}
          title={picked ? `Make @${picked.username} ${target}` : "Pick an account first"}
        >
          Make {target}
        </ActionButton>
        <span className="ml-auto text-[13px] text-neutral-500">{members.length}</span>
      </PanelToolbar>

      {error ? (
        <div className="border-b border-severity-high/30 bg-severity-high/10 px-3.5 py-2 text-[13px] text-severity-high">
          {error}
        </div>
      ) : null}

      <PanelScroll>
        <QueryState
          isLoading={query.isLoading}
          error={query.error}
          isEmpty={members.length === 0}
          emptyLabel="No staff members."
        />

        {members.map((member) => {
          const outranksViewer = (RANK_LEVEL[member.role] ?? 0) >= actorLevel;
          const options = assignable.filter((role) => role !== member.role);

          return (
            <Row key={member.id}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelection("user", member.username)}
                  className="truncate text-sm font-medium text-neutral-200 hover:text-white"
                >
                  @{member.username}
                </button>
                <Tag tone={TONE[member.role] ?? "low"}>{member.role}</Tag>
              </div>

              <Meta>
                {outranksViewer ? (
                  <span>
                    {member.role === "owner"
                      ? "The owner rank is fixed."
                      : "Ranked at or above you."}
                  </span>
                ) : (
                  options.map((role) => (
                    <ActionButton
                      key={role}
                      onClick={() => setRole(member.username, role)}
                      tone={role === "user" ? "danger" : "neutral"}
                      title={`Set @${member.username} to ${role}`}
                    >
                      {role === "user" ? "Remove" : `Make ${role}`}
                    </ActionButton>
                  ))
                )}
              </Meta>
            </Row>
          );
        })}
      </PanelScroll>
    </PanelShell>
  );
}
