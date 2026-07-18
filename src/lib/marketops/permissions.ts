export type PresentationalPermissionGroupName =
  | "portfolio"
  | "campaigns"
  | "content"
  | "automation"
  | "operations"
  | "integrations";

export const permissionPresentationalGroupsByPermission = {
  "initiatives.view": "portfolio",
  "mediums.view": "portfolio",
  "campaigns.view": "campaigns",
  "campaigns.edit": "campaigns",
  "campaigns.discover-customers": "campaigns",
  "campaigns.plan-outreach": "campaigns",
  "content.view": "content",
  "content.edit": "content",
  "automation.approve": "automation",
  "agents.view": "automation",
  "alerts.resolve": "operations",
  "integrations.manage": "integrations",
  "receipts.view": "operations",
} as const satisfies Record<string, PresentationalPermissionGroupName>;

export type MarketOpsPermission = keyof typeof permissionPresentationalGroupsByPermission;

export type PresentationalPermissionGroup = {
  group: PresentationalPermissionGroupName;
  permissions: readonly MarketOpsPermission[];
};

export const marketOpsPermissions = Object.keys(
  permissionPresentationalGroupsByPermission
) as MarketOpsPermission[];

export const presentationalPermissionGroupNames = [
  "portfolio",
  "campaigns",
  "content",
  "automation",
  "operations",
  "integrations",
] as const satisfies readonly PresentationalPermissionGroupName[];

export const permissionGroupsByName = presentationalPermissionGroupNames.reduce(
  (groups, group) => {
    groups[group] = marketOpsPermissions.filter(
      (permission) => permissionPresentationalGroupsByPermission[permission] === group
    );
    return groups;
  },
  {} as {
    [group in PresentationalPermissionGroupName]: MarketOpsPermission[];
  }
) as {
  readonly [group in PresentationalPermissionGroupName]: readonly MarketOpsPermission[];
};

export const permissionGroups = (
  Object.entries(permissionGroupsByName) as readonly [
    PresentationalPermissionGroupName,
    readonly MarketOpsPermission[],
  ][]
).map(([group, permissions]) => ({
  group,
  permissions,
})) as readonly PresentationalPermissionGroup[];
