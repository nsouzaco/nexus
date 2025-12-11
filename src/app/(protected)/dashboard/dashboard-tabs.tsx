"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IntegrationCard } from "@/components/features/integration-card"
import { FileUpload } from "@/components/features/file-upload"
import { FileList } from "@/components/features/file-list"
import { FileRecord } from "@/types/files"
import { Plug, FileText } from "lucide-react"

type Provider = "notion" | "google_drive" | "airtable" | "github"

interface IntegrationCardData {
  provider: Provider
  name: string
  description: string
  icon: string
  color: string
  isConnected: boolean
  connectedAt?: string
  status?: string
}

interface DashboardTabsProps {
  integrationCards: IntegrationCardData[]
  files: FileRecord[]
}

export function DashboardTabs({ integrationCards, files }: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState("integrations")

  const readyFilesCount = files.filter((f) => f.status === "ready").length
  const processingCount = files.filter(
    (f) => f.status === "pending" || f.status === "processing"
  ).length

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="integrations" className="gap-2">
          <Plug className="w-4 h-4" />
          Integrations
        </TabsTrigger>
        <TabsTrigger value="files" className="gap-2">
          <FileText className="w-4 h-4" />
          Files
          {readyFilesCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
              {readyFilesCount}
            </span>
          )}
          {processingCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-yellow-500/10 text-yellow-500">
              {processingCount}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="integrations" className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          {integrationCards.map((integration) => (
            <IntegrationCard
              key={integration.provider}
              provider={integration.provider}
              name={integration.name}
              description={integration.description}
              icon={integration.icon}
              color={integration.color}
              isConnected={integration.isConnected}
              connectedAt={integration.connectedAt}
              status={integration.status}
            />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="files" className="space-y-6">
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Upload Documents</h3>
            <FileUpload />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">
              Your Files
              {files.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({files.length} total)
                </span>
              )}
            </h3>
            <FileList files={files} />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}


