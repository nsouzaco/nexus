import type { Metadata } from "next"
import { Outfit } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
})

export const metadata: Metadata = {
  title: "Adapt Clone - AI-Powered Business Intelligence",
  description: "Connect your data sources and ask questions in natural language. Get instant answers with source citations.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${outfit.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
