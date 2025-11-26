import { redirect } from "next/navigation"
import { getUser } from "@/lib/supabase/server"
import { Navbar } from "@/components/layout/navbar"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <main className="pt-16">{children}</main>
    </div>
  )
}
