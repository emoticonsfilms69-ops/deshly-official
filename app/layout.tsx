import type { Metadata } from "next";
import "./globals.css"; // THIS LINE IS CRITICAL!

export const metadata: Metadata = {
  title: "Deshly",
  description: "The community app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
