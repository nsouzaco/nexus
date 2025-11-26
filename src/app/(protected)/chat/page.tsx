"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowUp, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

export default function ChatPage() {
  const [input, setInput] = useState("")

  const handleSend = () => {
    if (!input.trim()) return
    // TODO: Implement chat with OpenAI
    setInput("")
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Empty State */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <h1 className="text-2xl font-medium mb-8 text-gray-900">
          How can I help you today?
        </h1>
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
