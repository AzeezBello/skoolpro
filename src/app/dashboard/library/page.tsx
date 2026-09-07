"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { BookText, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { useSchoolSettings } from "@/lib/hooks/useSchoolSettings";
import { formatMoney } from "@/lib/money";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/components/i18n/LocaleProvider";

type Book = { id: string; title: string; author: string | null; isbn: string | null; category: string | null; total_copies: number; available_copies: number; shelf: string | null };
type Loan = { id: string; book_id: string; student_id: string | null; teacher_id: string | null; borrowed_at: string; due_date: string; returned_at: string | null; fine_amount: number; fine_paid: boolean; library_books?: { title?: string } | null; students?: { full_name?: string } | null; teachers?: { full_name?: string } | null };

export default function LibraryPage() {
  const { t } = useT();
  const { profile, loading: profileLoading } = useCurrentProfile();
  const { settings } = useSchoolSettings();
  const isStaff = profile?.role === "admin" || profile?.role === "teacher";
  const [tab, setTab] = useState<"books" | "loans">("books");
  const [books, setBooks] = useState<Book[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; full_name: string }>>([]);
  const [search, setSearch] = useState("");
  const [bookForm, setBookForm] = useState({ title: "", author: "", isbn: "", category: "", total_copies: "1", shelf: "" });
  const [loanForm, setLoanForm] = useState({ book_id: "", student_id: "", due_date: "" });
  const [busy, setBusy] = useState(false);
  const lib = settings.library;

  useEffect(() => {
    if (profileLoading) return;
    void load();
    if (isStaff) supabase.from("students").select("id, full_name").eq("status", "active").order("full_name").then(({ data }) => setStudents(data || []));
  }, [profileLoading, isStaff]);

  async function load() {
    const [{ data: b }, { data: l }] = await Promise.all([
      supabase.from("library_books").select("*").order("title"),
      supabase.from("library_loans").select("*, library_books(title), students(full_name), teachers(full_name)").order("borrowed_at", { ascending: false }).limit(500),
    ]);
    setBooks((b as Book[]) || []);
    setLoans((l as Loan[]) || []);
  }

  const filteredBooks = useMemo(() => {
    const q = search.toLowerCase();
    return books.filter((b) => !q || b.title.toLowerCase().includes(q) || (b.author || "").toLowerCase().includes(q) || (b.isbn || "").includes(q) || (b.category || "").toLowerCase().includes(q));
  }, [books, search]);

  async function addBook(e: React.FormEvent) {
    e.preventDefault();
    if (!bookForm.title.trim()) return toast.error("Title is required");
    const copies = Math.max(1, Number(bookForm.total_copies) || 1);
    setBusy(true);
    const { error } = await supabase.from("library_books").insert([{ title: bookForm.title.trim(), author: bookForm.author || null, isbn: bookForm.isbn || null, category: bookForm.category || null, shelf: bookForm.shelf || null, total_copies: copies, available_copies: copies }]);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Book added");
    setBookForm({ title: "", author: "", isbn: "", category: "", total_copies: "1", shelf: "" });
    await load();
  }

  async function removeBook(b: Book) {
    if (b.available_copies < b.total_copies) return toast.error("Some copies are on loan");
    if (!confirm(`Remove "${b.title}" from the catalogue?`)) return;
    const { error } = await supabase.from("library_books").delete().eq("id", b.id);
    if (error) return toast.error(error.message);
    await load();
  }

  async function issueLoan(e: React.FormEvent) {
    e.preventDefault();
    if (!loanForm.book_id || !loanForm.student_id || !loanForm.due_date) return toast.error("Pick a book, a student and a due date");
    const open = loans.filter((l) => !l.returned_at && l.student_id === loanForm.student_id).length;
    if (open >= lib.maxLoans) return toast.error(`This student already has ${open} book(s) out (limit ${lib.maxLoans})`);
    setBusy(true);
    const { error } = await supabase.from("library_loans").insert([{ book_id: loanForm.book_id, student_id: loanForm.student_id, due_date: loanForm.due_date, issued_by: profile?.userId }]);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Book issued");
    setLoanForm({ book_id: "", student_id: "", due_date: "" });
    await load();
  }

  async function returnLoan(l: Loan) {
    const overdueDays = Math.max(0, Math.floor((Date.now() - new Date(l.due_date).getTime()) / 86_400_000));
    const fine = overdueDays * lib.finePerDay;
    const { error } = await supabase.from("library_loans").update({ returned_at: new Date().toISOString().slice(0, 10), fine_amount: fine }).eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success(fine ? `Returned · fine ${formatMoney(fine, settings.currency)}` : "Returned");
    await load();
  }

  async function markFinePaid(l: Loan) {
    const { error } = await supabase.from("library_loans").update({ fine_paid: true }).eq("id", l.id);
    if (error) return toast.error(error.message);
    await load();
  }

  const openLoans = loans.filter((l) => !l.returned_at);
  const today = new Date().toISOString().slice(0, 10);

  if (profileLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{t("page.library.title")}</h1>
        <p className="text-sm text-muted-foreground">{isStaff ? `Catalogue, loans and fines · ${lib.loanDays}-day loans · ${formatMoney(lib.finePerDay, settings.currency)}/day overdue · max ${lib.maxLoans} per student (change under School Profile).` : t("page.library.student")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-input text-sm">
          <button onClick={() => setTab("books")} className={`px-3 py-2 ${tab === "books" ? "bg-white/10" : ""}`}>Catalogue ({books.length})</button>
          <button onClick={() => setTab("loans")} className={`px-3 py-2 ${tab === "loans" ? "bg-white/10" : ""}`}>Loans ({openLoans.length} open)</button>
        </div>
        {tab === "books" && <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, author, ISBN" className="rounded-md border border-input bg-background px-3 py-2 text-sm sm:w-72" />}
      </div>

      {tab === "books" && (
        <>
          {isStaff && (
            <form onSubmit={addBook} className="grid gap-2 rounded-xl border border-border bg-card/80 p-4 shadow-soft md:grid-cols-7">
              <input value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} placeholder="Title" className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2" required />
              <input value={bookForm.author} onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })} placeholder="Author" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <input value={bookForm.isbn} onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })} placeholder="ISBN" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <input value={bookForm.category} onChange={(e) => setBookForm({ ...bookForm, category: e.target.value })} placeholder="Category" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <input type="number" min={1} value={bookForm.total_copies} onChange={(e) => setBookForm({ ...bookForm, total_copies: e.target.value })} placeholder="Copies" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <button type="submit" disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Add book</button>
            </form>
          )}
          {filteredBooks.length === 0 ? (
            <EmptyState icon={<BookText size={20} />} title="No books" description={isStaff ? "Add your first title above." : "The catalogue is empty."} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card/80 shadow-soft">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/40 text-muted-foreground"><tr><th className="p-3">Title</th><th className="p-3">Author</th><th className="p-3">Category</th><th className="p-3">Available</th>{isStaff && <th className="p-3"></th>}</tr></thead>
                <tbody>
                  {filteredBooks.map((b) => (
                    <tr key={b.id} className="border-t border-border/60">
                      <td className="p-3 font-medium">{b.title}{b.isbn && <span className="block text-xs text-muted-foreground">ISBN {b.isbn}</span>}</td>
                      <td className="p-3 text-muted-foreground">{b.author || "—"}</td>
                      <td className="p-3 text-muted-foreground">{b.category || "—"}</td>
                      <td className="p-3"><span className={b.available_copies === 0 ? "text-red-300" : ""}>{b.available_copies}</span> / {b.total_copies}</td>
                      {isStaff && <td className="p-3 text-right"><button onClick={() => removeBook(b)} className="text-xs text-red-400">Remove</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "loans" && (
        <>
          {isStaff && (
            <form onSubmit={issueLoan} className="grid gap-2 rounded-xl border border-border bg-card/80 p-4 shadow-soft md:grid-cols-4">
              <select value={loanForm.book_id} onChange={(e) => setLoanForm({ ...loanForm, book_id: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" required>
                <option value="">Book</option>
                {books.filter((b) => b.available_copies > 0).map((b) => <option key={b.id} value={b.id}>{b.title} ({b.available_copies} left)</option>)}
              </select>
              <select
                value={loanForm.student_id}
                onChange={(e) => {
                  const due = new Date();
                  due.setDate(due.getDate() + lib.loanDays);
                  setLoanForm({ ...loanForm, student_id: e.target.value, due_date: loanForm.due_date || due.toISOString().slice(0, 10) });
                }}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">Student</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
              <input type="date" min={today} value={loanForm.due_date} onChange={(e) => setLoanForm({ ...loanForm, due_date: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" required />
              <button type="submit" disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Issue book</button>
            </form>
          )}
          {loans.length === 0 ? (
            <EmptyState icon={<BookText size={20} />} title="No loans yet" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card/80 shadow-soft">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/40 text-muted-foreground"><tr><th className="p-3">Book</th><th className="p-3">Borrower</th><th className="p-3">Borrowed</th><th className="p-3">Due</th><th className="p-3">Status</th>{isStaff && <th className="p-3"></th>}</tr></thead>
                <tbody>
                  {loans.map((l) => {
                    const overdue = !l.returned_at && l.due_date < today;
                    return (
                      <tr key={l.id} className="border-t border-border/60">
                        <td className="p-3 font-medium">{l.library_books?.title}</td>
                        <td className="p-3 text-muted-foreground">{l.students?.full_name || l.teachers?.full_name || "—"}</td>
                        <td className="p-3 text-muted-foreground">{l.borrowed_at}</td>
                        <td className="p-3 text-muted-foreground">{l.due_date}</td>
                        <td className="p-3">
                          {l.returned_at ? (
                            <span className="text-xs text-muted-foreground">Returned {l.returned_at}{Number(l.fine_amount) > 0 && <> · fine {formatMoney(l.fine_amount, settings.currency)} {l.fine_paid ? "(paid)" : "(unpaid)"}</>}</span>
                          ) : overdue ? (
                            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">Overdue</span>
                          ) : (
                            <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300">On loan</span>
                          )}
                        </td>
                        {isStaff && (
                          <td className="p-3 text-right">
                            {!l.returned_at && <button onClick={() => returnLoan(l)} className="flex items-center gap-1 text-xs text-primary"><RotateCcw size={12} /> Return</button>}
                            {l.returned_at && Number(l.fine_amount) > 0 && !l.fine_paid && <button onClick={() => markFinePaid(l)} className="text-xs text-primary">Mark fine paid</button>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
