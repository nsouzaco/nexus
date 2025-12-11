import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  if (error) {
    return NextResponse.redirect(`${appUrl}/dashboard?error=notion_auth_denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/dashboard?error=notion_auth_failed`)
  }

  // Decode state to get user ID
  let userId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString())
    userId = decoded.userId
  } catch {
    return NextResponse.redirect(`${appUrl}/dashboard?error=invalid_state`)
  }

  // Exchange code for access token
  const clientId = process.env.NOTION_CLIENT_ID
  const clientSecret = process.env.NOTION_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/dashboard?error=notion_not_configured`)
  }

  try {
    const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${appUrl}/api/integrations/notion/callback`,
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      console.error("Notion token exchange failed:", error)
      return NextResponse.redirect(`${appUrl}/dashboard?error=notion_token_failed`)
    }

    const tokenData = await tokenResponse.json()

    // Store in Supabase
    const supabase = await createClient()
    
    const { error: dbError } = await supabase
      .from("integrations")
      .upsert({
        user_id: userId,
        provider: "notion",
        access_token: tokenData.access_token,
        status: "active",
      }, {
        onConflict: "user_id,provider",
      })

    if (dbError) {
      console.error("Failed to store Notion integration:", dbError)
      return NextResponse.redirect(`${appUrl}/dashboard?error=notion_save_failed`)
    }

    return NextResponse.redirect(`${appUrl}/dashboard?success=notion_connected`)
  } catch (err) {
    console.error("Notion OAuth error:", err)
    return NextResponse.redirect(`${appUrl}/dashboard?error=notion_auth_error`)
  }
}


