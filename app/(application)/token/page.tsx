'use client'

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { getToken } from "@/util/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Copy, CheckCircle, AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function TokenPage() {
  const { data: session, status } = useSession()
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const fetchToken = async () => {
      if (status === "authenticated") {
        try {
          const currentToken = await getToken()
          setToken(currentToken)
        } catch (error) {
          console.error("Failed to get token:", error)
          setToken(null)
        }
      }
      setLoading(false)
    }

    fetchToken()
  }, [status])

  const copyToClipboard = async () => {
    if (!token) return

    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      toast({
        title: "Token copied!",
        description: "The token has been copied to your clipboard.",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy token to clipboard.",
        variant: "destructive",
      })
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return (
      <div className="container mx-auto my-auto p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Authentication Required
            </CardTitle>
            <CardDescription>
              You must be logged in to access your token.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Please log in to view and copy your authentication token.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto my-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Authentication Token</h1>
          <p className="text-muted-foreground mt-2">
            Your current authentication token for API access.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Current Token</span>
              <Badge variant={token ? "default" : "destructive"}>
                {token ? "Active" : "Unavailable"}
              </Badge>
            </CardTitle>
            <CardDescription>
              Use this token to authenticate API requests. Keep it secure and do not share it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {token ? (
              <>
                <div className="space-y-2">
                  <label htmlFor="token" className="text-sm font-medium">
                    Token Value
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="token"
                      type="text"
                      value={token}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      onClick={copyToClipboard}
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                    >
                      {copied ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>
                    <strong>Security:</strong> This token provides access to your account. Keep it private and secure.
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No token available. Please try refreshing the page or logging in again.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}