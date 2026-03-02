import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { auth } from "@/auth";
import { AuthProvider } from "@/lib/context/AuthContext";
import { PatientProvider } from "@/lib/context/PatientContext";
import { EditorProvider } from "@/lib/context/EditorContext";
import { SidebarProvider } from "@/lib/context/SidebarContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "XPC EMR - Electronic Medical Records",
  description: "Modern EMR document editor built with Next.js",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider session={session}>
          <PatientProvider>
            <EditorProvider>
              <SidebarProvider>
                {children}
              </SidebarProvider>
            </EditorProvider>
          </PatientProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
