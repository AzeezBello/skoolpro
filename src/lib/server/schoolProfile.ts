import fs from "fs";
import path from "path";
import dns from "dns/promises";
import net from "net";
import { supabaseAdmin } from "@/lib/supabaseServer";
import type { TenantContext } from "@/lib/server/tenant";

export type SchoolProfile = {
  id: string | null;
  name: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  motto: string | null;
  principalName: string | null;
  establishedYear: number | null;
  currency: string;
};

const DEFAULT_SCHOOL_NAME = "SkoolPro";

const EMPTY_PROFILE: SchoolProfile = {
  id: null,
  name: DEFAULT_SCHOOL_NAME,
  logoUrl: null,
  address: null,
  phone: null,
  email: null,
  motto: null,
  principalName: null,
  establishedYear: null,
  currency: "NGN",
};

// Queries the schools table itself, so the filter is on `id`, not school_id.
// Without a tenant there is nothing to look up — previously this fell back to
// `.limit(1)` and returned an arbitrary school's branding.
export async function getSchoolProfile(tenant: TenantContext | null): Promise<SchoolProfile> {
  if (!tenant) return EMPTY_PROFILE;

  const { data } = await supabaseAdmin
    .from("schools")
    .select("id, name, logo_url, address, phone, email, motto, principal_name, established_year, currency")
    .eq("id", tenant.value)
    .maybeSingle();

  if (!data) return EMPTY_PROFILE;

  return {
    id: data.id,
    name: data.name || DEFAULT_SCHOOL_NAME,
    logoUrl: data.logo_url || null,
    address: data.address || null,
    phone: data.phone || null,
    email: data.email || null,
    motto: data.motto || null,
    principalName: data.principal_name || null,
    establishedYear: data.established_year ?? null,
    currency: data.currency || "NGN",
  };
}

function isPrivateAddress(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const lower = ip.toLowerCase();
  return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80") || lower.startsWith("::ffff:");
}

// School admins control logo_url, and the server fetches it to embed in PDFs.
// Restrict to public https hosts so the field can't be used to probe internal
// services (blind SSRF): resolve the host first and refuse private ranges.
async function isSafeLogoUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;

  const host = url.hostname;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (net.isIP(host)) return !isPrivateAddress(host);

  try {
    const records = await dns.lookup(host, { all: true });
    return records.length > 0 && records.every((r) => !isPrivateAddress(r.address));
  } catch {
    return false;
  }
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export async function loadLogoBuffer(logoUrl?: string | null): Promise<Buffer | null> {
  if (logoUrl && (await isSafeLogoUrl(logoUrl))) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(logoUrl, { signal: controller.signal, redirect: "error" });
      clearTimeout(timer);

      const contentType = res.headers.get("content-type") || "";
      const length = Number(res.headers.get("content-length") || 0);
      if (res.ok && contentType.startsWith("image/") && length <= MAX_LOGO_BYTES) {
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength <= MAX_LOGO_BYTES) return Buffer.from(arrayBuffer);
      }
    } catch {
      // fall through to the bundled default
    }
  }

  const fallbackPath = path.join(process.cwd(), "public", "logo.png");
  if (fs.existsSync(fallbackPath)) {
    return fs.readFileSync(fallbackPath);
  }

  return null;
}
