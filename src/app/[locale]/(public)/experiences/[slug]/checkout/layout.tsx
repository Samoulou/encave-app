import { Header } from '@/components/layout/Header';

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream-50">
      <Header />
      <main id="main-content">
        {children}
      </main>
    </div>
  );
}
