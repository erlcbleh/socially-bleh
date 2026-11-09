export const LAYOUT_SCHEMA_VERSION = 1;

type GridNode =
  | { type: "branch"; data: GridNode[]; size?: number }
  | { type: "leaf"; data: { views: string[]; activeView?: string; id: string }; size?: number };

export interface SerializedLayout {
  grid: { root: GridNode; width: number; height: number; orientation: string };
  panels: Record<string, { id: string; contentComponent?: string; title?: string; params?: Record<string, unknown> }>;
  activeGroup?: string;
  floatingGroups?: { data: { views: string[]; activeView?: string; id: string }; position?: unknown }[];
  popoutGroups?: unknown[];
}

export interface PruneResult {
  layout: SerializedLayout | null;
  removedPanels: string[];
  migratedFrom?: number;
}

type Migration = (layout: SerializedLayout) => SerializedLayout | null;

export const LAYOUT_MIGRATIONS: Record<number, Migration> = {};

export function migrateLayout(
  raw: SerializedLayout,
  fromVersion: number
): { layout: SerializedLayout | null; migrated: boolean } {
  if (fromVersion === LAYOUT_SCHEMA_VERSION) return { layout: raw, migrated: false };
  if (fromVersion > LAYOUT_SCHEMA_VERSION || fromVersion < 1) return { layout: null, migrated: false };

  let current: SerializedLayout | null = raw;

  for (let version = fromVersion; version < LAYOUT_SCHEMA_VERSION; version += 1) {
    const migration = LAYOUT_MIGRATIONS[version];
    if (!migration || !current) return { layout: null, migrated: false };
    current = migration(current);
  }

  return { layout: current, migrated: current !== null };
}

function isBranch(node: GridNode): node is Extract<GridNode, { type: "branch" }> {
  return node?.type === "branch" && Array.isArray(node.data);
}

function isLeaf(node: GridNode): node is Extract<GridNode, { type: "leaf" }> {
  return node?.type === "leaf" && !!node.data && Array.isArray(node.data.views);
}

function pruneNode(node: GridNode, valid: Set<string>, groupIds: Set<string>): GridNode | null {
  if (isLeaf(node)) {
    const views = node.data.views.filter((view) => valid.has(view));
    if (views.length === 0) return null;

    groupIds.add(node.data.id);
    const activeView = node.data.activeView && views.includes(node.data.activeView) ? node.data.activeView : views[0];
    return { ...node, data: { ...node.data, views, activeView } };
  }

  if (isBranch(node)) {
    const children = node.data.map((child) => pruneNode(child, valid, groupIds)).filter((c): c is GridNode => c !== null);
    if (children.length === 0) return null;
    return { ...node, data: children };
  }

  return null;
}

export function pruneLayout(
  raw: unknown,
  schemaVersion: number,
  isKnown: (componentId: string) => boolean
): PruneResult {
  const incoming = raw as SerializedLayout | null;
  if (!incoming || typeof incoming !== "object") return { layout: null, removedPanels: [] };
  if (!incoming.grid || !incoming.grid.root || !incoming.panels) return { layout: null, removedPanels: [] };

  const { layout, migrated } = migrateLayout(incoming, schemaVersion);
  if (!layout) return { layout: null, removedPanels: [] };
  if (!layout.grid || !layout.grid.root || !layout.panels) return { layout: null, removedPanels: [] };

  const valid = new Set<string>();
  const removedPanels: string[] = [];
  const panels: SerializedLayout["panels"] = {};

  for (const [panelId, panel] of Object.entries(layout.panels)) {
    const component = panel?.contentComponent || panelId;
    if (isKnown(component)) {
      valid.add(panelId);
      panels[panelId] = panel;
    } else {
      removedPanels.push(panelId);
    }
  }

  if (valid.size === 0) return { layout: null, removedPanels };

  const groupIds = new Set<string>();
  const root = pruneNode(layout.grid.root, valid, groupIds);
  if (!root) return { layout: null, removedPanels };

  const floatingGroups = (layout.floatingGroups ?? [])
    .map((group) => {
      const views = (group?.data?.views ?? []).filter((view) => valid.has(view));
      if (views.length === 0) return null;
      groupIds.add(group.data.id);
      const activeView =
        group.data.activeView && views.includes(group.data.activeView) ? group.data.activeView : views[0];
      return { ...group, data: { ...group.data, views, activeView } };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  const pruned: SerializedLayout = {
    ...layout,
    grid: { ...layout.grid, root },
    panels,
    floatingGroups,
  };

  if (pruned.activeGroup && !groupIds.has(pruned.activeGroup)) delete pruned.activeGroup;
  if (pruned.popoutGroups) delete pruned.popoutGroups;

  return migrated
    ? { layout: pruned, removedPanels, migratedFrom: schemaVersion }
    : { layout: pruned, removedPanels };
}
