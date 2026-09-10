import type { Metadata } from "next";
import "./globals.css";
import "./brand.css";

export const metadata: Metadata = {
  title: "Purity Ritual | منصة إدارة الخدمات",
  description: "إدارة طلبات وخدمات وعروض أسعار Purity Ritual",
  icons: { icon: "/brand/logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
