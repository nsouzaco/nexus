import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const airtableSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { apiKey } = airtableSchema.parse(body)

    // Validate the API key by making a test request
    const testResponse = await fetch("https://api.airtable.com/v0/meta/whoami", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!testResponse.ok) {
      return NextResponse.json({ error: "Invalid Airtable API key" }, { status: 400 })
    }

    // Store in Supabase
    const { error: dbError } = await supabase
      .from("integrations")
      .upsert({
        user_id: user.id,
        provider: "airtable",
        access_token: apiKey,
        status: "active",
      }, {
        onConflict: "user_id,provider",
      })

    if (dbError) {
      console.error("Failed to store Airtable integration:", dbError)
      return NextResponse.json({ error: "Failed to save integration" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error("Airtable connect error:", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}


