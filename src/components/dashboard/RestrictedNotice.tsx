// Shown instead of a management page's full UI when the caller's role can
// view the page (it wasn't worth a redirect) but can't act on it — e.g. a
// teacher or student landing on an admin-only screen via a direct URL after
// it was hidden from their sidebar.
export function RestrictedNotice({ message }: { message: string }) {
  return <div className="rounded-xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">{message}</div>;
}
