"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import {
  FileText,
  Trash2,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Cog,
} from "lucide-react"
import { FileRecord, FileStatus } from "@/types/files"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface FileListProps {
  files: FileRecord[]
  onRefresh?: () => void
}

const statusConfig: Record<
  FileStatus,
  { icon: React.ElementType; label: string; color: string }
> = {
  pending: {
    icon: Clock,
    label: "Pending",
    color: "text-yellow-500 bg-yellow-500/10",
  },
  processing: {
    icon: Cog,
    label: "Processing",
    color: "text-blue-500 bg-blue-500/10",
  },
  ready: {
    icon: CheckCircle,
    label: "Ready",
    color: "text-green-500 bg-green-500/10",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    color: "text-red-500 bg-red-500/10",
  },
}

const fileTypeIcons: Record<string, string> = {
  "application/pdf": "📄",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "📝",
  "text/plain": "📃",
  "text/markdown": "📋",
  "text/csv": "📊",
  "application/json": "🔧",
}

export function FileList({ files, onRefresh }: FileListProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [fileToDelete, setFileToDelete] = useState<FileRecord | null>(null)

  const handleDelete = async (file: FileRecord) => {
    setDeletingId(file.id)
    try {
      const res = await fetch(`/api/files/${file.id}`, {
        method: "DELETE",
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete file")
      }

      toast({
        title: "File deleted",
        description: `${file.original_name} has been removed.`,
      })

      router.refresh()
      onRefresh?.()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Failed to delete file",
      })
    } finally {
      setDeletingId(null)
      setFileToDelete(null)
    }
  }

  const handleRetry = async (file: FileRecord) => {
    setRetryingId(file.id)
    try {
      const res = await fetch(`/api/files/${file.id}`, {
        method: "POST",
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to retry processing")
      }

      toast({
        title: "Reprocessing started",
        description: "The file is being processed again.",
      })

      router.refresh()
      onRefresh?.()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Retry failed",
        description: err instanceof Error ? err.message : "Failed to retry",
      })
    } finally {
      setRetryingId(null)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (files.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-2">No files uploaded</h3>
          <p className="text-sm text-muted-foreground text-center">
            Upload documents to start asking questions about your content.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {files.map((file) => {
          const status = statusConfig[file.status]
          const StatusIcon = status.icon
          const isProcessing = file.status === "processing"
          const isFailed = file.status === "failed"
          const isDeleting = deletingId === file.id
          const isRetrying = retryingId === file.id

          return (
            <Card
              key={file.id}
              className={cn(
                "transition-all",
                file.status === "ready" && "border-green-500/20",
                file.status === "failed" && "border-red-500/20"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-2xl">
                    {fileTypeIcons[file.file_type] || "📄"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{file.original_name}</p>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                          status.color
                        )}
                      >
                        <StatusIcon
                          className={cn(
                            "w-3 h-3",
                            isProcessing && "animate-spin"
                          )}
                        />
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>{formatFileSize(file.file_size)}</span>
                      <span>•</span>
                      <span>{formatDate(file.created_at)}</span>
                      {file.status === "ready" && (
                        <>
                          <span>•</span>
                          <span>{file.chunk_count} chunks</span>
                        </>
                      )}
                    </div>
                    {isFailed && file.error_message && (
                      <p className="text-xs text-red-500 mt-1">
                        Error: {file.error_message}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isFailed && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetry(file)}
                        disabled={isRetrying || isDeleting}
                      >
                        {isRetrying ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Retry
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFileToDelete(file)}
                      disabled={isDeleting || isRetrying || isProcessing}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <AlertDialog
        open={!!fileToDelete}
        onOpenChange={() => setFileToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{fileToDelete?.original_name}&quot; and
              remove it from your knowledge base. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => fileToDelete && handleDelete(fileToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

