import { api } from "./api";
import { isKnownPanel } from "../panels/registry";
import { pruneLayout as prune, LAYOUT_SCHEMA_VERSION, type PruneResult, type SerializedLayout } from "./layoutPrune";

export { LAYOUT_SCHEMA_VERSION };
export type { PruneResult, SerializedLayout };

export interface SavedLayout {
  id: string;
  name: string;
  schemaVersion: number;
  layout: SerializedLayout;
  isPreset: boolean;
  isDefault: boolean;
  shareCode: string | null;
  createdBy: { id: string; username: string } | null;
  updatedAt: string;
}

export interface SharedLayoutPreview {
  name: string;
  sharedBy: string | null;
  panelIds: string[];
  schemaVersion: number;
}

export interface LayoutListResponse {
  layouts: SavedLayout[];
  presets: SavedLayout[];
  schemaVersion: number;
}

export function pruneLayout(raw: unknown, schemaVersion: number): PruneResult {
  return prune(raw, schemaVersion, isKnownPanel);
}

export function fetchLayouts() {
  return api.get<LayoutListResponse>("/layouts");
}

export function saveLayout(name: string, layout: SerializedLayout) {
  return api.put<{ layout: SavedLayout }>("/layouts", { name, layout });
}

export function renameLayout(id: string, name: string) {
  return api.patch<{ layout: SavedLayout }>(`/layouts/${id}`, { name });
}

export function setDefaultLayout(id: string) {
  return api.post<{ ok: true }>(`/layouts/${id}/default`);
}

export function deleteLayout(id: string) {
  return api.delete<{ ok: true }>(`/layouts/${id}`);
}

export function shareLayoutAsPreset(name: string, layout: SerializedLayout) {
  return api.post<{ layout: SavedLayout }>("/layouts/presets", { name, layout });
}

export function deletePreset(id: string) {
  return api.delete<{ ok: true }>(`/layouts/presets/${id}`);
}

export function createShareCode(id: string) {
  return api.post<{ shareCode: string; name: string }>(`/layouts/${id}/share`);
}

export function revokeShareCode(id: string) {
  return api.delete<{ ok: true }>(`/layouts/${id}/share`);
}

export function previewSharedLayout(code: string) {
  return api.get<SharedLayoutPreview>(`/layouts/shared/${encodeURIComponent(code)}`);
}

export function importSharedLayout(code: string, name?: string) {
  return api.post<{ layout: SavedLayout }>("/layouts/import", { code, name });
}
