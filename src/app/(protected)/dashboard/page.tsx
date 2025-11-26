import { createClient } from "@/lib/supabase/server"
import { getUser } from "@/lib/supabase/server"
import { IntegrationCard } from "@/components/features/integration-card"
import { Button } from "@/components/ui/button"
import { MessageSquare, Zap } from "lucide-react"
import Link from "next/link"

const integrations = [
  {
    provider: "notion" as const,
    name: "Notion",
    description: "Query wikis, databases, and documents",
    icon: "📝",
    color: "bg-[#000000]",
  },
  {
    provider: "google_drive" as const,
    name: "Google Drive",
    description: "Search and analyze Docs, Sheets, and PDFs",
    icon: "📁",
    color: "bg-[#4285F4]",
  },
  {
    provider: "airtable" as const,
    name: "Airtable",
    description: "Query structured data tables",
    icon: "📊",
    color: "bg-[#18BFFF]",
  },
  {
    provider: "github" as const,
    name: "GitHub",
    description: "Query repos, issues, PRs, and commits",
    icon: "🐙",
    color: "bg-[#24292F]",
  },
]

export default async function DashboardPage() {
  const user = await getUser()
  const supabase = await createClient()

  const { data: userIntegrations } = await supabase
    .from("integrations")
    .select("*")
    .eq("user_id", user!.id)

  const connectedProviders = new Set(userIntegrations?.map((i) => i.provider) || [])
  const hasAnyIntegration = connectedProviders.size > 0

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Integrations</h1>
          <p className="text-muted-foreground">
            Connect your data sources to start asking questions
          </p>
        </div>
        {hasAnyIntegration && (
          <Link href="/chat">
            <Button className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Start Chatting
            </Button>
          </Link>
        )}
      </div>

      {/* Empty State */}
      {!hasAnyIntegration && (
        <div className="mb-8 p-8 rounded-2xl border border-dashed border-primary/30 bg-primary/5 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Get Started</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Connect at least one integration below to start asking questions about your data.
          </p>
        </div>
      )}

      {/* Integration Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {integrations.map((integration) => {
          const userIntegration = userIntegrations?.find(
            (i) => i.provider === integration.provider
          )
          return (
            <IntegrationCard
              key={integration.provider}
              provider={integration.provider}
              name={integration.name}
              description={integration.description}
              icon={integration.icon}
              color={integration.color}
              isConnected={!!userIntegration}
              connectedAt={userIntegration?.connected_at}
              status={userIntegration?.status}
            />
          )
        })}
      </div>
    </div>
  )
}
