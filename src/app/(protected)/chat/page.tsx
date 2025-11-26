import { Button } from "@/components/ui/button"
import { MessageSquare, Plus } from "lucide-react"

export default function ChatPage() {
  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar - Conversation History */}
      <div className="hidden md:flex w-64 flex-col border-r border-border/40 bg-muted/20">
        <div className="p-4">
          <Button className="w-full gap-2" size="sm">
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <p className="text-sm text-muted-foreground text-center py-8">
            No conversations yet
          </p>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Start a conversation</h2>
            <p className="text-muted-foreground mb-6">
              Ask questions about your connected data sources. Get instant answers with citations.
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Try asking:</p>
              <p>&quot;What were the key decisions from last week&apos;s meeting?&quot;</p>
              <p>&quot;Show me the latest updates on project X&quot;</p>
              <p>&quot;What issues are assigned to me in GitHub?&quot;</p>
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-border/40 p-4">
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              <textarea
                placeholder="Ask anything about your connected data..."
                className="w-full min-h-[56px] max-h-32 px-4 py-4 pr-24 rounded-xl border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                rows={1}
              />
              <Button
                size="sm"
                className="absolute right-2 bottom-2"
                disabled
              >
                Send
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Connect integrations in the Dashboard to start asking questions
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

