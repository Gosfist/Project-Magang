import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";

export const metadata: Metadata = {
  title: "PT UNZANET",
  description: "Internet fiber optik cepat dan stabil.",
  icons: {
    icon: "/favico.ico?v=1",
    shortcut: "/favico.ico?v=1",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
