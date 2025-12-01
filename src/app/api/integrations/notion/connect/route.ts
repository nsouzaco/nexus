import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const clientId = process.env.NOTION_CLIENT_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  if (!clientId) {
    return NextResponse.json({ error: "Notion OAuth not configured" }, { status: 500 })
  }

  // Create state with user ID for the callback
  const state = Buffer.from(JSON.stringify({ userId: user.id })).toString("base64")
  
  // Redirect URI must match what's configured in Notion
  const redirectUri = `${appUrl}/api/integrations/notion/callback`

  // Build Notion OAuth URL
  const notionAuthUrl = new URL("https://api.notion.com/v1/oauth/authorize")
  notionAuthUrl.searchParams.set("client_id", clientId)
  notionAuthUrl.searchParams.set("response_type", "code")
  notionAuthUrl.searchParams.set("owner", "user")
  notionAuthUrl.searchParams.set("redirect_uri", redirectUri)
  notionAuthUrl.searchParams.set("state", state)

  return NextResponse.redirect(notionAuthUrl.toString())
}
