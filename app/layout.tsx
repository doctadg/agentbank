import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentBank — AI Trading Vault",
  description: "Stake. Earn. Repeat. The first tokenized AI trading vault on Solana.",
  openGraph: {
    title: "AgentBank — AI Trading Vault",
    description: "Stake $ABANK. Earn daily from AI trading. No complexity.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
