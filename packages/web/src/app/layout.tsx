import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "epitaph",
  description:
    "Your dependencies are dying. epitaph finds the bodies. Maintenance health scoring for npm packages.",
  metadataBase: new URL("https://epitaph-dev.vercel.app"),
  openGraph: {
    title: "epitaph",
    description:
      "Scan your dependency manifest and grade every package on maintenance health. Find abandoned, unmaintained, and at-risk dependencies.",
    url: "https://epitaph-dev.vercel.app",
    siteName: "epitaph",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "epitaph",
    description: "Your dependencies are dying. epitaph finds the bodies.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Manrope:wght@200..800&family=JetBrains+Mono:wght@100..700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-dvh flex flex-col">
        {children}
      </body>
    </html>
  );
}
