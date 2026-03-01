import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PatientProvider>
          <EditorProvider>
            <SidebarProvider>
              {children}
            </SidebarProvider>
          </EditorProvider>
        </PatientProvider>
      </body>
    </html>
  );
}
