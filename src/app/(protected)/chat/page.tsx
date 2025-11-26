"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowUp, Plus, CheckCircle2, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  reasoning?: string
  sources?: Array<{ name: string; icon: string }>
}

export default function ChatPage() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "user",
      content: "What's our burn rate trend for the last 3 months?"
    },
    {
      id: "2",
      role: "assistant",
      reasoning: "I will perform a burn rate trend analysis for the last 3 months. I will:\n\n• First search the organization's knowledge base to see if we have information about burn rate data and where it's stored\n• Access the data and provide an analysis\n• Present the data with charts showing the trend\n\nSearching organizational knowledge....",
      content: "Preparing burn rate analysis... I will\n\n• Analyze monthly burn rate data for the last 3 months\n• Compare against budget projections",
      sources: [
        { name: "Quickbooks", icon: "QB" },
        { name: "Stripe", icon: "S" },
        { name: "Google Sheets", icon: "GS" },
        { name: "Ramp", icon: "R" }
      ]
    }
  ])
  const [isReasoningOpen, setIsReasoningOpen] = useState(true)

  const handleSend = () => {
    if (!input.trim()) return
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: "user",
      content: input
    }])
    setInput("")
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8">
            <h1 className="text-2xl font-medium mb-8 text-gray-900">
              How can I help you today?
            </h1>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
            {messages.map((message) => (
              <div key={message.id} className={cn("flex gap-4", message.role === "user" ? "justify-end" : "")}>
                {message.role === "user" ? (
                  <div className="bg-gray-100 text-gray-900 px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[80%] text-[15px] leading-relaxed">
                    {message.content}
                  </div>
                ) : (
                  <div className="flex-1 space-y-6">
                    {/* Reasoning Section */}
                    {message.reasoning && (
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 text-gray-400">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
                              <path d="M12 6v6l4 2"/>
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div 
                              className="flex items-center gap-2 text-gray-500 text-sm cursor-pointer hover:text-gray-700 transition-colors"
                              onClick={() => setIsReasoningOpen(!isReasoningOpen)}
                            >
                              <span>Internal reasoning</span>
                              <ChevronDown className={cn("h-4 w-4 transition-transform", isReasoningOpen ? "rotate-180" : "")} />
                            </div>
                            
                            {isReasoningOpen && (
                              <div className="mt-3 pl-4 border-l-2 border-gray-100 text-gray-600 text-[15px] leading-relaxed whitespace-pre-wrap">
                                {message.reasoning}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Sources */}
                        {message.sources && (
                          <div className="flex items-center gap-2 text-sm text-gray-500 ml-[28px]">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>Reviewing sources • {message.sources.length}</span>
                          </div>
                        )}

                        {message.sources && (
                          <div className="flex flex-col gap-2 ml-[28px]">
                            {message.sources.map((source, i) => (
                              <div key={i} className="flex items-center gap-3 text-sm text-gray-700">
                                <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center text-[10px] font-medium text-gray-600">
                                  {source.icon}
                                </div>
                                {source.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Main Content */}
                    <div className="text-[15px] leading-relaxed text-gray-900 whitespace-pre-wrap">
                      {message.content}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 pb-6">
        <div className="max-w-3xl mx-auto relative">
          <div className="relative flex items-center">
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute left-3 h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-transparent"
            >
              <Plus className="h-5 w-5" />
            </Button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask anything"
              className="w-full h-12 pl-12 pr-12 py-3 rounded-full border border-gray-200 focus:outline-none focus:border-gray-300 focus:ring-0 bg-white text-[15px] placeholder:text-gray-400 shadow-sm transition-shadow hover:shadow-md focus:shadow-md"
            />
            <Button 
              size="icon"
              onClick={handleSend}
              className={cn(
                "absolute right-2 h-8 w-8 rounded-full transition-all duration-200",
                input.trim() 
                  ? "bg-black hover:bg-gray-800 text-white" 
                  : "bg-gray-100 text-gray-400 hover:bg-gray-200"
              )}
              disabled={!input.trim()}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
