import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"))
  }

  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: "GitHub client ID not configured" }, { status: 500 })
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/github/callback`
  
  // Generate state to prevent CSRF
  const state = Buffer.from(JSON.stringify({ userId: user.id })).toString("base64")

  const authUrl = new URL("https://github.com/login/oauth/authorize")
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("scope", "repo read:user")
  authUrl.searchParams.set("state", state)

  return NextResponse.redirect(authUrl.toString())
}


