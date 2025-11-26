import { redirect } from "next/navigation"
import { getUser, createClient } from "@/lib/supabase/server"
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

  // Fetch user's conversations
  const supabase = await createClient()
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, title")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(20)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar user={user} conversations={conversations || []} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
