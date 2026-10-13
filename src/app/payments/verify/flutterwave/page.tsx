import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { PaymentVerifyStatus } from "@/components/payments/PaymentVerifyStatus";

export default function VerifyFlutterwavePage() {
  return (
    <MarketingLayout>
      <main className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center px-6 py-24">
        <PaymentVerifyStatus gateway="flutterwave" />
      </main>
    </MarketingLayout>
  );
}
