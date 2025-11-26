import { redirect } from "next/navigation"
import { getUser } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"

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
    <div className="flex min-h-screen bg-background">
      <Sidebar user={user} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
