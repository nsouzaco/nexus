"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ArrowUp, Plus, Loader2, FileText, User, Bot, ExternalLink, Wrench, Search, Database, Code, Globe, ChartLine, Mic } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FileUpload } from "@/components/features/file-upload"
import { ChartRenderer, parseChartFromMessage, ChartData } from "@/components/features/chart-renderer"
import ReactMarkdown from "react-markdown"

// Strip <thinking> blocks from message content (debug mode only, not for UI)
function stripThinkingBlocks(content: string): string {
  return content.replace(/<thinking>[\s\S]*?<\/thinking>\s*/gi, '').trim();
}

// Parse tool markers from streamed content
function parseToolMarkers(content: string): { 
  cleanContent: string; 
  activeTools: string[];
  completedTools: string[];
} {
  const activeTools: string[] = [];
  const completedTools: string[] = [];
  let cleanContent = content;
  
  // Find all tool start markers
  const startRegex = /<!--TOOL_START:(\w+)-->/g;
  let match;
  while ((match = startRegex.exec(content)) !== null) {
    activeTools.push(match[1]);
    cleanContent = cleanContent.replace(match[0], '');
  }
  
  // Find all tool end markers and remove from active
  const endRegex = /<!--TOOL_END:(\w+)-->/g;
  while ((match = endRegex.exec(content)) !== null) {
    const toolName = match[1];
    const activeIndex = activeTools.indexOf(toolName);
    if (activeIndex > -1) {
      activeTools.splice(activeIndex, 1);
    }
    completedTools.push(toolName);
    cleanContent = cleanContent.replace(match[0], '');
  }
  
  return { cleanContent, activeTools, completedTools };
}

// Tool icon mapping
const toolIcons: Record<string, React.ReactNode> = {
  searchAirtable: <Database className="w-3 h-3" />,
  searchGitHub: <Code className="w-3 h-3" />,
  listGitHubRepos: <Code className="w-3 h-3" />,
  searchNotion: <FileText className="w-3 h-3" />,
  searchGoogleDrive: <FileText className="w-3 h-3" />,
  searchFiles: <Search className="w-3 h-3" />,
  createAirtableRecord: <Database className="w-3 h-3" />,
  updateAirtableRecord: <Database className="w-3 h-3" />,
  createGitHubIssue: <Code className="w-3 h-3" />,
  createNotionPage: <FileText className="w-3 h-3" />,
  createGoogleDriveFile: <FileText className="w-3 h-3" />,
  createSlidesPresentation: <FileText className="w-3 h-3" />,
  generateChart: <ChartLine className="w-3 h-3" />,
  executeCode: <Code className="w-3 h-3" />,
  webSearch: <Globe className="w-3 h-3" />,
}

// Human-readable tool names
const toolLabels: Record<string, string> = {
  searchAirtable: "Searching Airtable",
  searchGitHub: "Searching GitHub",
  listGitHubRepos: "Loading repositories",
  searchNotion: "Searching Notion",
  searchGoogleDrive: "Searching Google Drive",
  searchFiles: "Searching files",
  createAirtableRecord: "Creating Airtable record",
  updateAirtableRecord: "Updating Airtable record",
  createGitHubIssue: "Creating GitHub issue",
  createNotionPage: "Creating Notion page",
  createGoogleDriveFile: "Creating Google Drive file",
  createSlidesPresentation: "Creating presentation",
  generateChart: "Generating chart",
  executeCode: "Running calculation",
  webSearch: "Searching the web",
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  toolCalls?: Array<{
    name: string
    status: 'pending' | 'complete'
  }>
  charts?: ChartData[]
}

export default function ChatPage() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    // Stop voice recording if active
    if (isRecording) {
      const recognition = recognitionRef.current
      recognitionRef.current = null
      recognition?.stop()
      setIsRecording(false)
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    }

    const assistantMessageId = (Date.now() + 1).toString()

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    // Create a placeholder assistant message for streaming
    setMessages((prev) => [...prev, {
      id: assistantMessageId,
      role: "assistant",
      content: "",
    }])

    try {
      abortControllerRef.current = new AbortController()
      
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userMessage.content,
          conversationId,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          debugMode: true,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to send message")
      }

      // Get conversation ID from headers
      const newConversationId = res.headers.get('X-Conversation-Id')
      if (newConversationId && !conversationId) {
        setConversationId(newConversationId)
      }

      // Handle streaming response
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value)
          fullContent += chunk
          
          // Update the assistant message with the new content
          setMessages((prev) => 
            prev.map((m) => 
              m.id === assistantMessageId 
                ? { ...m, content: fullContent }
                : m
            )
          )
        }
      }

      // Parse any charts from the final content
      const { charts } = parseChartFromMessage(fullContent)
      if (charts.length > 0) {
        setMessages((prev) => 
          prev.map((m) => 
            m.id === assistantMessageId 
              ? { ...m, charts }
              : m
          )
        )
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was aborted, don't show error
      }
      
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
      })
      
      // Remove the placeholder messages on error
      setMessages((prev) => prev.filter((m) => 
        m.id !== userMessage.id && m.id !== assistantMessageId
      ))
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }, [input, isLoading, conversationId, messages])

  const handleUploadComplete = () => {
    setShowUploadDialog(false)
    toast({
      title: "File uploaded!",
      description: "Your file is being processed. You can now ask questions about it.",
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleVoiceRecording = useCallback(async () => {
    // Check if browser supports speech recognition
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    
    if (!SpeechRecognition) {
      toast({
        variant: "destructive",
        title: "Not supported",
        description: "Voice input is not supported in your browser. Try Chrome or Edge.",
      })
      return
    }

    if (isRecording) {
      // Stop recording
      const recognition = recognitionRef.current
      recognitionRef.current = null // Clear ref first to prevent onend from restarting
      recognition?.stop()
      setIsRecording(false)
    } else {
      // First, request microphone permission
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Microphone access denied",
          description: "Please allow microphone access in your browser settings to use voice input.",
        })
        return
      }

      // Start recording
      const recognition = new SpeechRecognition()
      recognition.continuous = true // Keep listening until user stops
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        setIsRecording(true)
      }

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('')
        
        setInput(transcript)
      }

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        
        const errorMessages: Record<string, string> = {
          'not-allowed': 'Microphone access denied. Please allow microphone access in your browser settings.',
          'no-speech': 'No speech detected. Click the mic to try again.',
          'audio-capture': 'No microphone found. Please check your microphone connection.',
          'network': 'Network error. Please check your internet connection.',
          'aborted': 'Voice input was cancelled.',
        }
        
        const message = errorMessages[event.error] || `Error: ${event.error}. Please try again.`
        
        // Don't stop recording for no-speech, just show info if needed
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setIsRecording(false)
          toast({
            variant: "destructive",
            title: "Voice input error",
            description: message,
          })
        }
      }

      recognition.onend = () => {
        // Only set recording to false if we intentionally stopped
        // This prevents auto-stop on pauses when continuous mode restarts
        if (recognitionRef.current) {
          setIsRecording(false)
        }
      }

      recognitionRef.current = recognition
      recognition.start()
    }
  }, [isRecording])

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Messages Area */}
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-medium mb-4 text-foreground">
            How can I help you today?
          </h1>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            I can search your connected integrations, analyze data, create records, and more.
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div className="p-3 rounded-lg border bg-card text-sm text-muted-foreground">
              <Search className="w-4 h-4 mb-2 text-primary" />
              Search your files, Airtable, GitHub, Notion, and Drive
            </div>
            <div className="p-3 rounded-lg border bg-card text-sm text-muted-foreground">
              <ChartLine className="w-4 h-4 mb-2 text-primary" />
              Visualize data with charts and graphs
            </div>
            <div className="p-3 rounded-lg border bg-card text-sm text-muted-foreground">
              <Database className="w-4 h-4 mb-2 text-primary" />
              Create and update records in your tools
            </div>
            <div className="p-3 rounded-lg border bg-card text-sm text-muted-foreground">
              <Globe className="w-4 h-4 mb-2 text-primary" />
              Search the web for external information
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4 space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  // Hide bot avatar when message is loading (empty content)
                  !(isLoading && message.id === messages[messages.length - 1]?.id && !message.content.trim()) && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )
                )}
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3 max-w-[85%] overflow-hidden",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {/* Tool Calls */}
                  {message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {message.toolCalls.map((tool, idx) => (
                        <div 
                          key={idx}
                          className={cn(
                            "flex items-center gap-2 text-xs py-1.5 px-2.5 rounded-lg",
                            tool.status === 'complete' 
                              ? "bg-green-500/10 text-green-700 dark:text-green-400"
                              : "bg-primary/10 text-primary"
                          )}
                        >
                          {tool.status !== 'complete' ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            toolIcons[tool.name] || <Wrench className="w-3 h-3" />
                          )}
                          <span>
                            {toolLabels[tool.name] || tool.name}
                            {tool.status === 'complete' && ' ✓'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {message.role === "assistant" ? (
                    (() => {
                      // Parse tool markers from content
                      const { cleanContent, activeTools, completedTools } = parseToolMarkers(message.content);
                      
                      // Parse charts from content - this also removes the ```chart blocks from text
                      const { text, charts } = parseChartFromMessage(cleanContent);
                      
                      // Only use charts from parsing (not message.charts to avoid duplicates)
                      // Also hide incomplete chart JSON during streaming
                      const isStreaming = isLoading && message.id === messages[messages.length - 1]?.id;
                      const hasIncompleteChart = cleanContent.includes('```chart') && !cleanContent.includes('```chart\n') || 
                                                  (cleanContent.includes('```chart\n') && !cleanContent.match(/```chart\n[\s\S]*?\n```/));
                      
                      // Clean up any incomplete chart blocks from display text
                      // Also strip <thinking> blocks (debug mode content not for UI)
                      let displayText = stripThinkingBlocks(text);
                      if (isStreaming && hasIncompleteChart) {
                        // Remove incomplete chart block from display during streaming
                        displayText = displayText.replace(/```chart[\s\S]*$/, '').trim();
                      }
                      // Also strip incomplete thinking blocks during streaming
                      if (isStreaming && displayText.includes('<thinking>') && !displayText.includes('</thinking>')) {
                        displayText = displayText.replace(/<thinking>[\s\S]*$/, '').trim();
                      }
                      
                      // Build tool calls list from markers
                      const allToolCalls = [
                        ...completedTools.map(name => ({ name, status: 'complete' as const })),
                        ...activeTools.map(name => ({ name, status: 'pending' as const })),
                      ];
                      
                      // Show loading indicator if content is empty and no tools active
                      if (!displayText && charts.length === 0 && allToolCalls.length === 0 && isLoading) {
                        return (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Thinking...</span>
                          </div>
                        );
                      }
                      
                      return (
                        <>
                          {/* Tool Calls from streaming */}
                          {allToolCalls.length > 0 && (
                            <div className="mb-3 space-y-2">
                              {allToolCalls.map((tool, idx) => (
                                <div 
                                  key={idx}
                                  className={cn(
                                    "flex items-center gap-2 text-xs py-1.5 px-2.5 rounded-lg transition-all duration-300",
                                    tool.status === 'complete' 
                                      ? "bg-green-500/10 text-green-700 dark:text-green-400"
                                      : "bg-primary/10 text-primary animate-pulse"
                                  )}
                                >
                                  {tool.status !== 'complete' ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    toolIcons[tool.name] || <Wrench className="w-3 h-3" />
                                  )}
                                  <span>
                                    {toolLabels[tool.name] || tool.name}
                                    {tool.status === 'complete' && ' ✓'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {displayText && (
                            <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                              <ReactMarkdown
                                components={{
                                  a: ({ href, children }) => (
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline inline-flex items-center gap-1"
                                    >
                                      {children}
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  ),
                                  p: ({ children }) => (
                                    <p className="mb-2 last:mb-0">{children}</p>
                                  ),
                                  ul: ({ children }) => (
                                    <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>
                                  ),
                                  ol: ({ children }) => (
                                    <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>
                                  ),
                                  li: ({ children }) => (
                                    <li className="leading-relaxed">{children}</li>
                                  ),
                                  h1: ({ children }) => (
                                    <h1 className="text-lg font-bold mb-2">{children}</h1>
                                  ),
                                  h2: ({ children }) => (
                                    <h2 className="text-base font-bold mb-2">{children}</h2>
                                  ),
                                  h3: ({ children }) => (
                                    <h3 className="text-sm font-bold mb-1">{children}</h3>
                                  ),
                                  code: ({ className, children }) => {
                                    const isInline = !className;
                                    return isInline ? (
                                      <code className="bg-background/50 px-1 py-0.5 rounded text-sm">
                                        {children}
                                      </code>
                                    ) : (
                                      <code className="block bg-background/50 p-2 rounded text-sm overflow-x-auto">
                                        {children}
                                      </code>
                                    );
                                  },
                                  strong: ({ children }) => (
                                    <strong className="font-semibold">{children}</strong>
                                  ),
                                }}
                              >
                                {displayText}
                              </ReactMarkdown>
                            </div>
                          )}
                          {charts.map((chart, idx) => (
                            <ChartRenderer key={idx} chart={chart} />
                          ))}
                        </>
                      );
                    })()
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  )}
                </div>
                {message.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 pb-6 border-t bg-background">
        <div className="max-w-3xl mx-auto relative">
          <div className="relative flex items-center">
            <Button 
              type="button"
              variant="ghost" 
              size="icon" 
              className="absolute left-3 h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
              onClick={() => setShowUploadDialog(true)}
              title="Upload a file"
            >
              <Plus className="h-5 w-5" />
            </Button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? "Listening..." : "Ask anything about your data..."}
              disabled={isLoading}
              className={cn(
                "w-full h-12 pl-12 pr-24 py-3 rounded-full border focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring bg-background text-[15px] placeholder:text-muted-foreground shadow-sm transition-shadow hover:shadow-md focus:shadow-md disabled:opacity-50",
                isRecording ? "border-green-500 ring-1 ring-green-500" : "border-input"
              )}
            />
            <Button 
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleVoiceRecording}
              className={cn(
                "absolute right-12 h-8 w-8 rounded-full transition-all duration-200",
                isRecording 
                  ? "text-green-500 hover:text-green-600 hover:bg-green-50" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              disabled={isLoading}
              title={isRecording ? "Stop recording" : "Voice input"}
            >
              <Mic className="h-4 w-4" />
            </Button>
            <Button 
              type="button"
              size="icon"
              onClick={handleSend}
              className={cn(
                "absolute right-2 h-8 w-8 rounded-full transition-all duration-200",
                input.trim() && !isLoading
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
              )}
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <FileUpload onUploadComplete={handleUploadComplete} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
