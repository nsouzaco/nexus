import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const disconnectSchema = z.object({
  provider: z.enum(["notion", "google_drive", "airtable", "github"]),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { provider } = disconnectSchema.parse(body)

    const { error: dbError } = await supabase
      .from("integrations")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", provider)

    if (dbError) {
      console.error("Failed to disconnect integration:", dbError)
      return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error("Disconnect error:", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

