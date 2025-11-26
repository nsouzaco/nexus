import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  if (error) {
    return NextResponse.redirect(`${appUrl}/dashboard?error=google_auth_denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/dashboard?error=google_auth_failed`)
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
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/dashboard?error=google_not_configured`)
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${appUrl}/api/integrations/google/callback`,
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      console.error("Google token exchange failed:", error)
      return NextResponse.redirect(`${appUrl}/dashboard?error=google_token_failed`)
    }

    const tokenData = await tokenResponse.json()

    // Store in Supabase
    const supabase = await createClient()
    
    const expiresAt = tokenData.expires_in 
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null

    const { error: dbError } = await supabase
      .from("integrations")
      .upsert({
        user_id: userId,
        provider: "google_drive",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
        status: "active",
      }, {
        onConflict: "user_id,provider",
      })

    if (dbError) {
      console.error("Failed to store Google integration:", dbError)
      return NextResponse.redirect(`${appUrl}/dashboard?error=google_save_failed`)
    }

    return NextResponse.redirect(`${appUrl}/dashboard?success=google_connected`)
  } catch (err) {
    console.error("Google OAuth error:", err)
    return NextResponse.redirect(`${appUrl}/dashboard?error=google_auth_error`)
  }
}

