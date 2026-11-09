import { useEffect, useState } from "react";
import { useQuery } from "@socially/shared/queryStore";
import { Avatar } from "@socially/shared/components/Avatar";
import { api } from "../lib/api";
import { setSelection, useSelection } from "../lib/selectionBus";
import { publishFocus } from "../lib/realtime";
import { PanelScroll, PanelShell, PanelToolbar, QueryState, Row, Tag, TextInput } from "../components/panelKit";
import type { UserLookupResult } from "../types";

export function UserSearch() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const selected = useSelection("user");

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 250);
    return () => clearTimeout(timer);
  }, [input]);

  const search = useQuery<{ users: UserLookupResult[] }>({
    queryKey: ["staff", "user-search", query],
    queryFn: () => api.get<{ users: UserLookupResult[] }>(`/users?q=${encodeURIComponent(query)}`),
    enabled: query.length > 0,
  });

  const users = query ? search.data?.users ?? [] : [];

  return (
    <PanelShell>
      <PanelToolbar>
        <TextInput value={input} onChange={setInput} placeholder="Search users" className="min-w-0 flex-1" />
      </PanelToolbar>

      <PanelScroll>
        {!query ? <div className="p-4 text-base text-neutral-500">Type to search accounts.</div> : null}

        {query ? (
          <QueryState
            isLoading={search.isLoading}
            error={search.error}
            isEmpty={users.length === 0}
            emptyLabel={`No account matches “${query}”.`}
          />
        ) : null}

        {users.map((user) => (
          <Row
            key={user.id}
            selected={selected === user.username}
            onClick={() => {
              setSelection("user", user.username);
              publishFocus({ channel: "user", id: user.username });
            }}
          >
            <div className="flex items-center gap-2.5">
              <Avatar user={user} size={7} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-neutral-200">@{user.username}</span>
                <span className="block truncate text-[13px] text-neutral-500">{user.displayName}</span>
              </span>
              {user.isVerified ? <Tag tone="low">verified</Tag> : null}
              {user.role && user.role !== "user" ? <Tag tone="low">{user.role}</Tag> : null}
            </div>
          </Row>
        ))}
      </PanelScroll>
    </PanelShell>
  );
}
