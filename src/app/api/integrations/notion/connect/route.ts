import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"))
  }

  const clientId = process.env.NOTION_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: "Notion client ID not configured" }, { status: 500 })
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/notion/callback`
  
  // Generate state to prevent CSRF
  const state = Buffer.from(JSON.stringify({ userId: user.id })).toString("base64")

  const authUrl = new URL("https://api.notion.com/v1/oauth/authorize")
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("owner", "user")
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("state", state)

  return NextResponse.redirect(authUrl.toString())
}

