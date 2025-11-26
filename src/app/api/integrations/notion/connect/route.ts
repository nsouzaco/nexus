import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // For internal integration, use the token from environment
  const notionToken = process.env.NOTION_INTERNAL_TOKEN

  if (!notionToken) {
    return NextResponse.json({ error: "Notion token not configured" }, { status: 500 })
  }

  // Validate the token by making a test request
  try {
    const testResponse = await fetch("https://api.notion.com/v1/users/me", {
      headers: {
        Authorization: `Bearer ${notionToken}`,
        "Notion-Version": "2022-06-28",
      },
    })

    if (!testResponse.ok) {
      return NextResponse.json({ error: "Invalid Notion token" }, { status: 400 })
    }

    // Store in Supabase
    const { error: dbError } = await supabase
      .from("integrations")
      .upsert({
        user_id: user.id,
        provider: "notion",
        access_token: notionToken,
        status: "active",
      }, {
        onConflict: "user_id,provider",
      })

    if (dbError) {
      console.error("Failed to store Notion integration:", dbError)
      return NextResponse.json({ error: "Failed to save integration" }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    return NextResponse.redirect(`${appUrl}/dashboard?success=notion_connected`)
  } catch (err) {
    console.error("Notion connect error:", err)
    return NextResponse.json({ error: "Failed to connect to Notion" }, { status: 500 })
  }
}
