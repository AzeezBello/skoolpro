import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PaymentVerifyStatus } from "@/components/payments/PaymentVerifyStatus";

export default function VerifyFlutterwavePage() {
  return (
    <div className="dark force-dark min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-gray-900 text-white">
      <SiteHeader />
      <main className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center px-6 py-16">
        <PaymentVerifyStatus gateway="flutterwave" />
      </main>
      <SiteFooter />
    </div>
  );
}
