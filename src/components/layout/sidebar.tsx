"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, Search, MessageSquare, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import type { User } from "@supabase/supabase-js"

interface SidebarProps {
  user: User
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()

  const displayName = user.user_metadata?.display_name || user.email
  const initials = displayName
    ? displayName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email?.[0].toUpperCase() || "U"

  return (
    <div className="w-[260px] flex-shrink-0 h-screen flex flex-col bg-[#F9F9F9] border-r border-gray-200">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <span className="font-serif text-xl font-medium">Adapt</span>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronUp className="h-4 w-4 rotate-[-90deg] text-muted-foreground" />
          </Button>
        </div>

        <div className="flex items-center gap-2 px-2 py-1.5 mb-4 rounded-md hover:bg-gray-200/50 transition-colors cursor-pointer group">
          <div className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-600 group-hover:bg-gray-300 transition-colors">
            A
          </div>
          <span className="text-sm text-gray-600">adaptdotcom</span>
        </div>

        <div className="space-y-1">
          <Link href="/chat">
            <Button variant="ghost" className="w-full justify-start gap-2 px-2 h-9 font-normal text-gray-600 hover:text-foreground hover:bg-gray-200/50">
              <MessageSquare className="h-4 w-4" />
              New chat
            </Button>
          </Link>
          <Button variant="ghost" className="w-full justify-start gap-2 px-2 h-9 font-normal text-gray-600 hover:text-foreground hover:bg-gray-200/50">
            <Search className="h-4 w-4" />
            Search chat
          </Button>
        </div>
      </div>

      {/* Recent Chats */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="text-[11px] font-medium text-gray-400 mb-2 px-2">RECENT CHATS</div>
        <div className="space-y-0.5">
          {["How can we effectively trac...", "What are the best practices...", "Can you suggest ways to di...", "What metrics should we foc...", "How can we leverage custo...", "What role does pricing strat...", "How can we utilize marketin...", "What are some common pitf...", "What strategies can we impl...", "What tools or software can..."].map((chat, i) => (
            <Button
              key={i}
              variant="ghost"
              className="w-full justify-start px-2 h-8 font-normal text-[13px] text-gray-600 hover:text-foreground hover:bg-gray-200/50 truncate"
            >
              {chat}
            </Button>
          ))}
        </div>
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-gray-200/50 cursor-pointer transition-colors">
          <Avatar className="h-8 w-8 border border-gray-200">
            <AvatarImage src={user.user_metadata?.avatar_url} />
            <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {displayName}
            </p>
            <p className="text-[11px] text-gray-500 truncate">
              {user.email}
            </p>
          </div>
          <ChevronUp className="h-4 w-4 text-gray-400" />
        </div>
      </div>
    </div>
  )
}

