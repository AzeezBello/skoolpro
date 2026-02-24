export type TenantContext = {
  column: string;
  value: string;
};

const DEFAULT_TENANT_COLUMNS = ["organization_id", "school_id", "tenant_id"] as const;

function isTenancyEnabled() {
  return process.env.SAAS_ENABLE_TENANCY === "true";
}

export function isTenancyStrict() {
  return process.env.SAAS_TENANCY_STRICT === "true";
}

export function resolveTenantContext(profile: Record<string, unknown> | null | undefined): TenantContext | null {
  if (!isTenancyEnabled() || !profile) return null;

  const configuredColumn = (process.env.SAAS_TENANT_COLUMN || "").trim();
  const columns = configuredColumn ? [configuredColumn] : [...DEFAULT_TENANT_COLUMNS];

  for (const column of columns) {
    const value = profile[column];
    if (typeof value === "string" && value.trim()) {
      return { column, value };
    }
  }

  return null;
}

export function applyTenantFilter<T>(query: T, tenant: TenantContext | null) {
  if (!tenant) return query;

  const withEq = query as T & { eq?: (column: string, value: string) => T };
  if (typeof withEq.eq !== "function") return query;

  return withEq.eq(tenant.column, tenant.value);
}

export function withTenantPayload<T extends Record<string, unknown>>(payload: T, tenant: TenantContext | null) {
  if (!tenant) return payload;
  if (Object.prototype.hasOwnProperty.call(payload, tenant.column)) return payload;
  return { ...payload, [tenant.column]: tenant.value } as T;
}
