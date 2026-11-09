import { useState } from "react";
import { useQuery } from "@socially/shared/queryStore";
import { useConfirm } from "@socially/shared/components/ConfirmDialog";
import { usePrompt } from "@socially/shared/components/PromptDialog";
import { api } from "../lib/api";
import { openPanel } from "../lib/panelBus";
import { PANEL_MAP } from "./registry";
import { relativeTime } from "../lib/time";
import { ActionButton, PanelScroll, PanelTitle,
  PanelShell, PanelToolbar, QueryState, Tag } from "../components/panelKit";
import type { SavedSearch, SavedSearchesResponse } from "../types";

function describe(query: Record<string, unknown>) {
  const parts = Object.entries(query)
    .filter(([, value]) => value !== "" && value !== null && value !== undefined)
    .map(([key, value]) => `${key}: ${String(value)}`);
  return parts.length ? parts.join(" · ") : "no filters";
}

export function SavedSearches() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm(busy);
  const { prompt, dialog: promptDialog } = usePrompt(busy);

  const query = useQuery<SavedSearchesResponse>({
    queryKey: ["staff", "saved-searches"],
    queryFn: () => api.get<SavedSearchesResponse>("/saved-searches"),
  });

  const own = query.data?.searches ?? [];
  const shared = query.data?.shared ?? [];

  const run = (promise: Promise<unknown>) => {
    setBusy(true);
    setError(null);
    promise
      .then(() => query.refetch())
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  const apply = (search: SavedSearch) => {
    openPanel({ panelId: search.panelId, params: search.query });
  };

  const renderRow = (search: SavedSearch, owned: boolean) => {
    const panel = PANEL_MAP.get(search.panelId);

    return (
      <div key={search.id} className="flex flex-col gap-1 border-b border-white/[0.08] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => apply(search)}
            className="truncate text-sm font-medium text-neutral-200 hover:text-white"
          >
            {search.name}
          </button>
          {search.isShared ? <Tag tone="low">shared</Tag> : null}
          {!panel ? <Tag tone="high">panel gone</Tag> : null}
          <span className="ml-auto shrink-0 text-[12px] text-neutral-500">
            {relativeTime(search.updatedAt)}
          </span>
        </div>

        <div className="text-[13px] text-neutral-500">
          {panel?.title ?? search.panelId} · {describe(search.query)}
        </div>

        {!owned && search.owner ? (
          <div className="text-[12px] text-neutral-500">shared by @{search.owner.username}</div>
        ) : null}

        <div className="flex items-center gap-1">
          <ActionButton onClick={() => apply(search)} disabled={!panel}>
            Open
          </ActionButton>
          {owned ? (
            <>
              <ActionButton
                disabled={busy}
                onClick={() =>
                  run(
                    api.put("/saved-searches", {
                      name: search.name,
                      panelId: search.panelId,
                      query: search.query,
                      isShared: !search.isShared,
                    })
                  )
                }
              >
                {search.isShared ? "Unshare" : "Share"}
              </ActionButton>
              <ActionButton
                disabled={busy}
                onClick={() =>
                  prompt({
                    title: "Rename saved search",
                    label: "Name",
                    initialValue: search.name,
                    confirmLabel: "Rename",
                    maxLength: 60,
                    validate: (value) =>
                      value.toLowerCase() !== search.name.toLowerCase() &&
                      own.some((entry) => entry.name.toLowerCase() === value.toLowerCase())
                        ? "You already have a saved search with that name."
                        : null,
                    onSubmit: (name) =>
                      run(
                        api
                          .put("/saved-searches", {
                            name,
                            panelId: search.panelId,
                            query: search.query,
                            isShared: search.isShared,
                          })
                          .then(() => api.delete(`/saved-searches/${search.id}`))
                      ),
                  })
                }
              >
                Rename
              </ActionButton>
              <ActionButton
                tone="danger"
                disabled={busy}
                onClick={() =>
                  confirm({
                    title: `Delete “${search.name}”?`,
                    description: search.isShared
                      ? "It disappears for every moderator using it."
                      : "This cannot be undone.",
                    confirmLabel: "Delete",
                    tone: "danger",
                    onConfirm: () => run(api.delete(`/saved-searches/${search.id}`)),
                  })
                }
              >
                Delete
              </ActionButton>
            </>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <PanelShell>
      {confirmDialog}
      {promptDialog}
      <PanelToolbar>
        <PanelTitle>Saved Searches</PanelTitle>
        <Tag>{own.length + shared.length}</Tag>
        {error ? <span className="text-[12px] text-severity-high">{error}</span> : null}
      </PanelToolbar>

      <PanelScroll>
        <QueryState
          isLoading={query.isLoading && own.length + shared.length === 0}
          error={query.error}
          isEmpty={own.length + shared.length === 0 && !query.isLoading}
          emptyLabel="No saved searches yet."
        />

        {own.length > 0 ? (
          <>
            <div className="px-3.5 py-1.5 text-[12px] font-semibold text-neutral-500">Yours</div>
            {own.map((search) => renderRow(search, true))}
          </>
        ) : null}

        {shared.length > 0 ? (
          <>
            <div className="px-3.5 py-1.5 text-[12px] font-semibold text-neutral-500">Shared with you</div>
            {shared.map((search) => renderRow(search, false))}
          </>
        ) : null}
      </PanelScroll>
    </PanelShell>
  );
}
