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
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
        <link href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,600,700,900&f[]=jetbrains-mono@400,500,600,700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
