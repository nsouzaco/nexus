"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { Upload, FileText, Loader2, X, AlertCircle } from "lucide-react"
import { SUPPORTED_FILE_TYPES, MAX_FILE_SIZE, isSupportedFileType } from "@/types/files"
import { createClient } from "@/lib/supabase/client"
import { v4 as uuidv4 } from "uuid"

interface FileUploadProps {
  onUploadComplete?: () => void
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const router = useRouter()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supportedExtensions = Object.values(SUPPORTED_FILE_TYPES)
    .map((t) => t.extension)
    .join(", ")

  const validateFile = (file: File): string | null => {
    if (!isSupportedFileType(file.type)) {
      return `Unsupported file type. Supported: ${supportedExtensions}`
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
    }
    return null
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    setError(null)

    const file = e.dataTransfer.files[0]
    if (file) {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }
      setSelectedFile(file)
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = e.target.files?.[0]
    if (file) {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }
      setSelectedFile(file)
    }
  }, [])

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setError(null)

    try {
      const supabase = createClient()
      
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error("Please sign in to upload files")
      }

      // Generate file ID and path
      const fileId = uuidv4()
      const filename = `${fileId}-${selectedFile.name}`
      const storagePath = `${user.id}/${filename}`

      // Upload directly to Supabase Storage (bypasses Vercel's 4.5MB limit)
      const { error: uploadError } = await supabase.storage
        .from("user-files")
        .upload(storagePath, selectedFile, {
          contentType: selectedFile.type,
          upsert: false,
        })

      if (uploadError) {
        console.error("Storage upload error:", uploadError)
        throw new Error("Failed to upload file to storage")
      }

      // Create file record via API (small payload, just metadata)
      const res = await fetch("/api/files/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId,
          filename,
          originalName: selectedFile.name,
          fileType: selectedFile.type,
          fileSize: selectedFile.size,
          storagePath,
        }),
      })

      const contentType = res.headers.get("content-type")
      if (!contentType?.includes("application/json")) {
        const text = await res.text()
        throw new Error(text || `Upload failed with status ${res.status}`)
      }

      const data = await res.json()

      if (!res.ok) {
        // Clean up uploaded file if record creation failed
        await supabase.storage.from("user-files").remove([storagePath])
        throw new Error(data.error || "Failed to upload file")
      }

      toast({
        title: "File uploaded!",
        description: "Your file is being processed. This may take a moment.",
      })

      setSelectedFile(null)
      router.refresh()
      onUploadComplete?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed"
      setError(message)
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: message,
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleClearFile = () => {
    setSelectedFile(null)
    setError(null)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Card className="border-dashed border-2">
      <CardContent className="p-6">
        {!selectedFile ? (
          <div
            className={cn(
              "relative flex flex-col items-center justify-center p-8 rounded-lg transition-colors cursor-pointer",
              isDragging
                ? "bg-primary/10 border-primary"
                : "hover:bg-muted/50"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input
              id="file-input"
              type="file"
              className="hidden"
              accept={Object.keys(SUPPORTED_FILE_TYPES).join(",")}
              onChange={handleFileSelect}
            />
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">
              {isDragging ? "Drop your file here" : "Upload a document"}
            </h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Drag and drop or click to browse
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Supports: {supportedExtensions} (max {MAX_FILE_SIZE / 1024 / 1024}MB)
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearFile}
                disabled={isUploading}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleUpload}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload and Process
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

