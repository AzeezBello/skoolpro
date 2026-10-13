# UI revamp (October 2026)

A ground-up visual refresh of SkoolPro around three ideas: **lots of white space, minimal decoration, and real product imagery** (illustrations and mockups) instead of stock icons in boxes. No runtime behaviour, data access or role logic changed; every page keeps its i18n keys and the product-tour `data-tour` hooks.

## Direction

- **White space first.** Marketing sections use a `.section` rhythm (`max-w-5xl`, `py-24` on mobile, `py-32` on desktop). Lists replace card grids wherever a border added nothing. Dashboard content sits in a `max-w-[1320px]` column with `md:px-12` gutters and `space-y-12` between blocks.
- **Minimal chrome.** Borders are `border-border/70`, cards have no shadow, buttons are solid or text-only. Thin dividers (`border-t border-slate-100`) separate marketing sections instead of background changes.
- **Light by default.** The app now defaults to the light theme (the toggle in the top bar still persists dark). Marketing, auth, onboarding and the public apply page are always light via the `.light` token wrapper in `MarketingLayout`.
- **Typography.** Inter for body and tables, Space Grotesk (`font-display`) for headings. Loaded through `next/font` in `src/app/layout.tsx`.
- **Colour.** Brand green stays the single accent (`--primary`). New semantic tokens: `success`, `warning`, `info`, `chart-1..5`, `chart-grid`, each defined for light and dark in `src/app/globals.css` and mapped in `tailwind.config.js`.

## Brand and imagery

| Asset | File | Used by |
| --- | --- | --- |
| Logo mark + word mark | `src/components/brand/Logo.tsx` | header, sidebar, top bar, platform console, auth, loading states |
| Favicon / PWA icon | `src/app/icon.svg`, `public/brand/icon.svg`, `public/brand/wordmark.svg` | Next.js metadata, `manifest.ts` |
| School campus illustration | `src/components/illustrations/SchoolIllustration.tsx` | landing (how it works), about, auth pages |
| Dashboard mockup (browser frame) | `src/components/illustrations/DashboardMockup.tsx` | landing hero |
| Parent portal phone mockup | `src/components/illustrations/PhoneMockup.tsx` | landing parents section |
| Empty-state spot illustrations | `src/components/illustrations/EmptyIllustration.tsx` | `EmptyState` (folder, inbox, chart, search) |

The mockups are plain markup styled with Tailwind, so they stay sharp at any size, match the palette and never go stale like screenshots. All SVGs use `currentColor` or theme tokens where it matters and carry `aria` labels or `aria-hidden`.

`public/logo.png` is untouched; it is the per-school logo slot described in `public/README.txt`. The PWA manifest now points at `public/brand/icon.svg`.

## Component library (`src/components/ui`)

| Component | What changed |
| --- | --- |
| `Button` | `size` (`sm`, `md`, `lg`, `icon`), `loading` spinner, new `soft` and `link` variants, rounded-lg. |
| `Card` | `variant` (`default`, `interactive`, `glass`, `flat`); no shadow by default. |
| `Badge` | Theme-aware `success`, `warning`, `danger`, `info` tints plus optional status `dot`. The old fixed `text-green-200` tints were unreadable in light mode. |
| `Input`, `Label` | Rounded-lg, hover border, labels in foreground colour. |
| `EmptyState` | Accepts `illustration` (defaults to the folder spot illustration) or an `icon`. |
| `Skeleton`, `SkeletonRows` | New shimmer placeholders for loading states. |
| `PageHeader` | New: eyebrow, title, description, right-aligned actions. |
| `StatCard` | New: metric tile with tone, icon, hint and built-in loading skeleton. |
| `Avatar` | New: initials avatar with a stable gradient derived from the name. |

Global helpers in `globals.css`: `.eyebrow`, `.section`, `.glass`, `.app-shell` table and form styling (upgrades the 28 existing `<table>` screens without editing them), `animate-fade-up`, `animate-float`, `animate-grow`, `scrollbar-thin`.

## Page by page

**Marketing (`/`, `/about`, `/contact`, `/faq`)**
- `MarketingLayout` wraps every public page: light, white canvas, sticky header, footer.
- `SiteHeader`: logo, quiet text nav, mobile menu, language switcher, "Log in" and a single solid "Get started" button.
- Landing: centred hero with the dashboard mockup under it, a quiet stats line, features as an icon list, numbered "how it works" beside the campus illustration, parent portal with the phone mockup, roles, plans (Free / Basic / Pro from the `plans` table ids) and a closing CTA.
- About: hero with illustration, pillars and principles as lists, CTA.
- Contact: two-column layout; the form now submits to `mailto:support@skoolpro.app` (it previously had no handler).
- FAQ: grouped native `<details>` accordions.

**Auth (`/login`, `/register`, `/forgot-password`, `/reset-password`), `/onboarding`, `/apply/[slug]`**
- `AuthLayout`: copy and illustration on the left, borderless form on the right, eye-toggle for passwords, loading buttons.
- Login now checks `/api/platform/me` after sign-in and sends platform admins to `/platform` (see `docs/SUPERADMIN.md`).
- Forgot-password shows a "send again" state after the first email.

**Dashboard shell**
- `src/lib/navigation.ts` is the single source of truth for links, sections, roles and tour hooks; `Sidebar` and `Topbar` both read it.
- Sidebar: logo with console caption, links grouped under Home / School / People / Academics / Campus / Finance / Communication / Insights, quiet active state, user card at the bottom.
- Topbar: breadcrumb (Dashboard / current page), language, notifications, theme, tour, and an account menu holding logout.
- `ProtectedRoute` and the overview page show branded loading and skeletons instead of plain text.
- `AdminOverview`: page header, greeting block with quick actions, six `StatCard`s, theme-aware Chart.js colours via `useTheme`, illustrated empty states. Metric queries are unchanged.

**Platform console (`/platform/*`)**
- Follows the app theme instead of forcing dark; logo with "Platform console" caption, pill nav, account chip.
- Schools: summary stats, create form in a card, search box, badges and buttons from the library.
- School detail: plan and admin forms side by side, staff table with avatars, skeleton loading.
- Audit log: card, skeleton, illustrated empty state.

## i18n

New English keys (other locales fall back to English; French is provided): `nav.section.*`, `topbar.dashboard`, `topbar.account`, `topbar.greeting.*`, `overview.quickActions`, `overview.welcome`.

## Verification

- `npm run typecheck`: pass
- `npm run lint`: pass
- `npm test`: pass
- `npm run build`: pass (all 70 routes compiled)

## Extending

- Add a dashboard page: add it to `DASHBOARD_LINKS` in `src/lib/navigation.ts` with a `section`, `roles` and a `tour` id; the sidebar, breadcrumb and tour pick it up.
- New empty state: `<EmptyState illustration="inbox" title="..." description="..." action={<Button/>} />`.
- New metric: `<StatCard label value icon tone loading />`.
- Keep marketing sections inside `.section`, headings in `text-slate-900`, body copy in `text-slate-500`, and separate sections with `border-t border-slate-100`.
