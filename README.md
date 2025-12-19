# SkoolPro — Next.js + Supabase (TypeScript) Scaffold

This is a deploy-ready scaffold for the SkoolPro MVP. It includes:
- Next.js (App Router) TypeScript setup
- Supabase client
- Key API routes for invoices, payments (Paystack/Flutterwave), webhooks
- PDF receipt generation (pdfkit)
- Resend email integration
- Dashboard pages (invoices view, receipts, send reminder)
- Public endpoints for students, fee_items, invoices

## Quick start

1. Copy `.env.example` to `.env.local` and fill in your keys.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development:
   ```bash
   npm run dev
   ```
4. Deploy to Vercel (recommended).

> NOTE: This scaffold contains essential routes and UI components. Review the code and adjust according to your Supabase schema and security requirements.

