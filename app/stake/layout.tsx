import ClientWalletProvider from "../providers/ClientWalletProvider";

export default function StakeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClientWalletProvider>{children}</ClientWalletProvider>;
}
