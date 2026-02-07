import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { QueryProvider } from "@/providers/query-provider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Task Management App",
  description: "A collaborative task management application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
          <Toaster richColors position="top-right" />
        </QueryProvider>
      </body>
    </html>
  );
}
