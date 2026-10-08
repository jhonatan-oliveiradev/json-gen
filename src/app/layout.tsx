import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JSON Gen · Campanhas Aéreas",
  description: "Gerador local e validado de JSON para vitrines de campanhas aéreas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
