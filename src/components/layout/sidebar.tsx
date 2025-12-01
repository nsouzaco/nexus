"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageSquare, Search, ChevronUp, Trash2 } from "lucide-react"
import type { User } from "@supabase/supabase-js"
import { useEffect, useState } from "react"
import { toast } from "@/components/ui/use-toast"

interface SidebarProps {
  user: User
  conversations?: Array<{ id: string; title: string }>
}

export function Sidebar({ user, conversations: initialConversations = [] }: SidebarProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [conversations, setConversations] = useState(initialConversations)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    setConversations(initialConversations)
  }, [initialConversations])

  const handleDelete = async (e: React.MouseEvent, chatId: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    setDeletingId(chatId)
    
    try {
      const res = await fetch(`/api/chat/${chatId}`, {
        method: 'DELETE',
      })
      
      if (!res.ok) {
        throw new Error('Failed to delete conversation')
      }
      
      // Remove from local state
      setConversations(prev => prev.filter(c => c.id !== chatId))
      
      // If we're currently viewing this chat, redirect to /chat
      if (window.location.pathname === `/chat/${chatId}`) {
        router.push('/chat')
      }
      
      toast({
        title: "Chat deleted",
        description: "The conversation has been removed.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete conversation",
      })
    } finally {
      setDeletingId(null)
    }
  }

  const displayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "User"
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="w-[260px] flex-shrink-0 h-screen flex flex-col bg-[#F9F9F9] border-r border-gray-200">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <Link href="/dashboard" className="font-serif text-xl font-medium hover:opacity-70 transition-opacity">
            Adapt
          </Link>
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
        {conversations.length > 0 ? (
          <>
            <div className="text-[11px] font-medium text-gray-400 mb-2 px-2">RECENT CHATS</div>
            <div className="space-y-0.5">
              {conversations.map((chat) => (
                <Link key={chat.id} href={`/chat/${chat.id}`}>
                  <div className="group relative flex items-center">
                    <Button
                      variant="ghost"
                      className="w-full justify-start px-2 h-8 font-normal text-[13px] text-gray-600 hover:text-foreground hover:bg-gray-200/50 truncate pr-8"
                    >
                      <span className="truncate">{chat.title}</span>
                    </Button>
                    <button
                      onClick={(e) => handleDelete(e, chat.id)}
                      disabled={deletingId === chat.id}
                      className="absolute right-1 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-gray-300/50 transition-opacity disabled:opacity-50"
                      title="Delete chat"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-gray-500 hover:text-red-500 transition-colors" />
                    </button>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">No conversations yet</p>
          </div>
        )}
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-gray-200/50 cursor-pointer transition-colors">
          {isMounted ? (
            <>
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
            </>
          ) : (
            <>
              <div className="h-8 w-8 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-20 bg-gray-200 rounded" />
                <div className="h-2 w-24 bg-gray-200 rounded" />
              </div>
            </>
          )}
          <ChevronUp className="h-4 w-4 text-gray-400" />
        </div>
      </div>
    </div>
  )
}
