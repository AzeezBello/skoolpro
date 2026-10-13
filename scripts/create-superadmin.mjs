#!/usr/bin/env node
/**
 * Create (or update) a SkoolPro platform superadmin.
 *
 * A platform admin is an auth user listed in public.platform_admins. That
 * table has no RLS policies for anon/authenticated roles, so this script
 * must run with the service-role key (never from the browser).
 *
 * Usage:
 *   node scripts/create-superadmin.mjs --email you@example.com --password 'S3cret!' [--name "Full Name"]
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY from the
 * environment, falling back to .env.local in the project root. Idempotent:
 * re-running updates the password and keeps the allowlist entry.
 */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const fileEnv = loadEnvFile(resolve(root, ".env.local"));
const env = (k) => process.env[k] ?? fileEnv[k];

const email = String(args.email ?? env("SUPERADMIN_EMAIL") ?? "").trim().toLowerCase();
const password = String(args.password ?? env("SUPERADMIN_PASSWORD") ?? "");
const fullName = String(args.name ?? env("SUPERADMIN_NAME") ?? "Platform Admin").trim();
const url = env("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = env("SUPABASE_SERVICE_KEY");

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

if (!email || !email.includes("@")) fail("Provide --email (or SUPERADMIN_EMAIL).");
if (password.length < 8) fail("Provide --password with at least 8 characters (or SUPERADMIN_PASSWORD).");
if (!url || /your-project\.supabase\.co/.test(url)) fail("NEXT_PUBLIC_SUPABASE_URL is missing or still the placeholder. Set it in .env.local.");
if (!serviceKey || serviceKey.length < 40) fail("SUPABASE_SERVICE_KEY is missing or looks invalid. Use the service_role key from Supabase → Project Settings → API.");

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUserByEmail(target) {
  const perPage = 200;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((u) => (u.email || "").toLowerCase() === target);
    if (match) return match;
    if (data.users.length < perPage) return null;
  }
  return null;
}

async function main() {
  console.log(`\nSkoolPro superadmin → ${email}`);
  console.log(`Project: ${new URL(url).host}`);

  // 1) Auth user: create with a confirmed email, or update the password.
  let user = await findUserByEmail(email);
  if (user) {
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(user.user_metadata || {}), full_name: fullName },
    });
    if (error) throw error;
    user = data.user;
    console.log(`• Auth user exists (${user.id}); password updated and email confirmed.`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    user = data.user;
    console.log(`• Auth user created (${user.id}) with a confirmed email.`);
  }

  // 2) Platform allowlist (service role bypasses RLS by design).
  {
    const { error } = await supabase
      .from("platform_admins")
      .upsert({ id: user.id, full_name: fullName }, { onConflict: "id" });
    if (error) {
      if (/relation .*platform_admins.* does not exist/i.test(error.message)) {
        fail("public.platform_admins is missing. Apply supabase/migrations/20260730_000011_platform_admin.sql first.");
      }
      throw error;
    }
    console.log("• Added to public.platform_admins.");
  }

  // 3) Profile row so dashboard hooks have a name to show. The role stays
  //    whatever it already is (admin of a school, if assigned) or the default
  //    unassigned "student" for a brand-new account; platform access does not
  //    depend on it.
  {
    const { data: existing, error: readError } = await supabase.from("profiles").select("id, full_name").eq("id", user.id).maybeSingle();
    if (readError) throw readError;
    if (!existing) {
      const { error } = await supabase.from("profiles").insert({ id: user.id, full_name: fullName, role: "student" });
      if (error) throw error;
      console.log("• Profile created (no school; platform access does not need one).");
    } else if (!existing.full_name && fullName) {
      const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
      if (error) throw error;
      console.log("• Profile name filled in.");
    } else {
      console.log("• Profile already present; left unchanged.");
    }
  }

  console.log(`\n✔ Done. Sign in at /login with ${email}; you will land on /platform.\n`);
}

main().catch((err) => {
  fail(err?.message || String(err));
});
