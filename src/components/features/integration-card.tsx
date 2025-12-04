"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Check, Loader2, Unplug } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"

type Provider = "notion" | "google_drive" | "airtable" | "github"

interface IntegrationCardProps {
  provider: Provider
  name: string
  description: string
  icon: string
  color: string
  isConnected: boolean
  connectedAt?: string
  status?: string
}

const providerRoutes: Record<Provider, string> = {
  notion: "/api/integrations/notion/connect",
  google_drive: "/api/integrations/google/connect",
  github: "/api/integrations/github/connect",
  airtable: "", // Handled via modal
}

export function IntegrationCard({
  provider,
  name,
  description,
  icon,
  color,
  isConnected,
  connectedAt,
  status,
}: IntegrationCardProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showAirtableModal, setShowAirtableModal] = useState(false)
  const [apiKey, setApiKey] = useState("")

  const handleConnect = async () => {
    if (provider === "airtable") {
      setShowAirtableModal(true)
      return
    }

    // Redirect to OAuth flow
    window.location.href = providerRoutes[provider]
  }

  const handleAirtableConnect = async () => {
    if (!apiKey.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter your Airtable API key",
      })
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/integrations/airtable/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to connect")
      }

      toast({
        title: "Connected!",
        description: `${name} has been connected successfully.`,
      })
      setShowAirtableModal(false)
      setApiKey("")
      router.refresh()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to connect",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnect = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to disconnect")
      }

      toast({
        title: "Disconnected",
        description: `${name} has been disconnected.`,
      })
      router.refresh()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to disconnect",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <>
      <Card className={cn(
        "border-border/50 transition-all hover:border-border",
        isConnected && "border-green-500/30 bg-green-500/5"
      )}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden",
                  color
                )}
              >
                <img 
                  src={icon} 
                  alt={`${name} icon`} 
                  className="w-7 h-7 object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{name}</h3>
                  {isConnected && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-xs font-medium">
                      <Check className="w-3 h-3" />
                      Connected
                    </span>
                  )}
                  {status === "expired" && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-medium">
                      Expired
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
                {isConnected && connectedAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Connected on {formatDate(connectedAt)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex-shrink-0">
              {isConnected ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={isLoading}
                  className="gap-2 text-muted-foreground hover:text-destructive hover:border-destructive"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Unplug className="w-4 h-4" />
                  )}
                  Disconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleConnect}
                  disabled={isLoading}
                  className="gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Connect"
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Airtable API Key Modal */}
      <Dialog open={showAirtableModal} onOpenChange={setShowAirtableModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Airtable</DialogTitle>
            <DialogDescription>
              Enter your Airtable Personal Access Token to connect your bases.
              You can find this in your Airtable account settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">Personal Access Token</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="pat..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Get your token at{" "}
              <a
                href="https://airtable.com/create/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                airtable.com/create/tokens
              </a>
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAirtableModal(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleAirtableConnect} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
