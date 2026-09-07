"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

type Info = { school: { name: string; logo_url: string | null; admissions_open: boolean }; classes: Array<{ id: string; name: string }> };

const empty = { applicant_name: "", date_of_birth: "", gender: "", applying_for_class_id: "", previous_school: "", parent_name: "", parent_email: "", parent_phone: "", address: "", notes: "", website: "" };

export default function ApplyPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || "";
  const [info, setInfo] = useState<Info | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public/admissions?slug=${encodeURIComponent(slug)}`)
      .then(async (r) => (r.ok ? setInfo(await r.json()) : setNotFound(true)))
      .catch(() => setNotFound(true));
  }, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/public/admissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, slug }) });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Could not submit application");
        return;
      }
      setReference(json.reference);
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value }) });

  return (
    <div className="dark force-dark min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-gray-900 text-white">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12">
        {notFound ? (
          <p className="text-center text-muted-foreground">We couldn&apos;t find that school.</p>
        ) : !info ? (
          <p className="text-center text-muted-foreground">Loading…</p>
        ) : reference ? (
          <Card>
            <CardHeader>
              <CardTitle>Application received</CardTitle>
              <CardDescription>Your reference is <strong>{reference}</strong>. {info.school.name} will contact you at {form.parent_email}.</CardDescription>
            </CardHeader>
          </Card>
        ) : !info.school.admissions_open ? (
          <Card>
            <CardHeader>
              <CardTitle>{info.school.name}</CardTitle>
              <CardDescription>Admissions are currently closed. Please check back later.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <form onSubmit={submit}>
              <CardHeader>
                {info.school.logo_url && <img src={info.school.logo_url} alt="" className="mb-2 h-14 w-14 rounded object-contain" />}
                <CardTitle>Apply to {info.school.name}</CardTitle>
                <CardDescription>Fill in the child&apos;s and a parent or guardian&apos;s details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input type="text" tabIndex={-1} autoComplete="off" className="hidden" {...field("website")} />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2"><Label>Child&apos;s full name</Label><Input required {...field("applicant_name")} /></div>
                  <div className="space-y-2"><Label>Date of birth</Label><Input type="date" {...field("date_of_birth")} /></div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <select {...field("gender")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Applying for class</Label>
                    <select {...field("applying_for_class_id")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">Select</option>
                      {info.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2"><Label>Previous school</Label><Input {...field("previous_school")} /></div>
                  <div className="space-y-2"><Label>Parent / guardian name</Label><Input required {...field("parent_name")} /></div>
                  <div className="space-y-2"><Label>Parent email</Label><Input type="email" required {...field("parent_email")} /></div>
                  <div className="space-y-2"><Label>Parent phone</Label><Input {...field("parent_phone")} /></div>
                  <div className="space-y-2"><Label>Home address</Label><Input {...field("address")} /></div>
                  <div className="space-y-2 md:col-span-2"><Label>Anything else we should know?</Label><textarea rows={3} {...field("notes")} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                </div>
                <Button type="submit" disabled={busy} className="w-full">{busy ? "Submitting…" : "Submit application"}</Button>
              </CardContent>
            </form>
          </Card>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
