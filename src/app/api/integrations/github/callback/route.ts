import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  if (error) {
    return NextResponse.redirect(`${appUrl}/dashboard?error=github_auth_denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/dashboard?error=github_auth_failed`)
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
  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/dashboard?error=github_not_configured`)
  }

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${appUrl}/api/integrations/github/callback`,
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      console.error("GitHub token exchange failed:", error)
      return NextResponse.redirect(`${appUrl}/dashboard?error=github_token_failed`)
    }

    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      console.error("GitHub token error:", tokenData.error)
      return NextResponse.redirect(`${appUrl}/dashboard?error=github_token_failed`)
    }

    // Store in Supabase
    const supabase = await createClient()
    
    const { error: dbError } = await supabase
      .from("integrations")
      .upsert({
        user_id: userId,
        provider: "github",
        access_token: tokenData.access_token,
        status: "active",
      }, {
        onConflict: "user_id,provider",
      })

    if (dbError) {
      console.error("Failed to store GitHub integration:", dbError)
      return NextResponse.redirect(`${appUrl}/dashboard?error=github_save_failed`)
    }

    return NextResponse.redirect(`${appUrl}/dashboard?success=github_connected`)
  } catch (err) {
    console.error("GitHub OAuth error:", err)
    return NextResponse.redirect(`${appUrl}/dashboard?error=github_auth_error`)
  }
}

