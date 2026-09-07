export type TenantContext = {
  column: string;
  value: string;
};

// Tenant scoping is unconditional. It used to be gated behind
// SAAS_ENABLE_TENANCY (default false), which meant every service-role query
// in the API layer ran unfiltered across schools unless an operator opted in.
// The only remaining knob is which column carries the school reference.
export function getTenantColumn() {
  return (process.env.SAAS_TENANT_COLUMN || "").trim() || "school_id";
}

export function resolveTenantContext(profile: Record<string, unknown> | null | undefined): TenantContext | null {
  if (!profile) return null;

  const column = getTenantColumn();
  const value = profile[column];
  if (typeof value === "string" && value.trim()) {
    return { column, value };
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
