"use client";

import { useMutation } from "@apollo/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CREATE_VARIABLE, GET_VARIABLES } from "@/queries/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Loading } from "@/components/ui/loading";

export const dynamic = "force-dynamic";

export default function CreateVariablePage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: "",
    value: "",
    encrypted: false,
  });

  const [createVariable, { loading }] = useMutation(CREATE_VARIABLE, {
    refetchQueries: [
      GET_VARIABLES,
      "GetVariables",
    ],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.value.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and value are required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createVariable({
        variables: {
          name: formData.name.trim(),
          value: formData.value,
          encrypted: formData.encrypted,
        },
      });

      toast({
        title: "Variable Created",
        description: `Variable "${formData.name}" has been created successfully.`,
      });

      router.push("/variables");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create variable. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-8">
      <div className="flex items-center space-x-4">
        <Link href="/variables">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Create Variable</h1>
          <p className="text-muted-foreground">
            Add a new variable to your application
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Variable Details</CardTitle>
          <CardDescription>
            Configure your new variable settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">
                Variable Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="e.g., API_KEY, DATABASE_URL"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                required
              />
              <p className="text-sm text-muted-foreground">
                A unique identifier for your variable. Use UPPERCASE with underscores for constants.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">
                Variable Value <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="value"
                placeholder="Enter the variable value..."
                value={formData.value}
                onChange={(e) => handleChange("value", e.target.value)}
                rows={4}
                required
              />
              <p className="text-sm text-muted-foreground">
                The actual value of your variable. This will be {formData.encrypted ? "encrypted" : "stored as plain text"}.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="encrypted"
                checked={formData.encrypted}
                onCheckedChange={(checked) => handleChange("encrypted", checked)}
              />
              <Label htmlFor="encrypted" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Encrypt this variable
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              When enabled, the variable value will be encrypted before storing in the database. 
              This is recommended for sensitive data like API keys, passwords, and tokens.
            </p>

            <div className="flex justify-end space-x-4 pt-6">
              <Link href="/variables">
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loading />
                    <span className="ml-2">Creating...</span>
                  </>
                ) : (
                  "Create Variable"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}