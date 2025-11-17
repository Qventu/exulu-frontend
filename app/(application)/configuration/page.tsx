"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, CheckCircle2, RotateCcw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQuery } from "@apollo/client";
import {
  GET_PLATFORM_CONFIGURATIONS,
  CREATE_PLATFORM_CONFIGURATION,
  UPDATE_PLATFORM_CONFIGURATION,
} from "@/queries/queries";

export default function ConfigurationPage() {
  const [lightTheme, setLightTheme] = useState({});
  const [darkTheme, setDarkTheme] = useState({});
  const [cssInput, setCssInput] = useState("");
  const [lightOpen, setLightOpen] = useState(false);
  const [darkOpen, setDarkOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch all platform configurations
  const { data, loading, refetch } = useQuery(GET_PLATFORM_CONFIGURATIONS);

  const [createConfig] = useMutation(CREATE_PLATFORM_CONFIGURATION);
  const [updateConfig] = useMutation(UPDATE_PLATFORM_CONFIGURATION);

  // Load existing configuration when data is fetched
  useEffect(() => {
    if (data?.platform_configurationsPagination?.items) {
      // Find the theme_config configuration
      const themeConfig = data.platform_configurationsPagination.items.find(
        (config: any) => config.config_key === "theme_config"
      );

      if (themeConfig) {
        setConfigId(themeConfig.id);

        if (themeConfig.config_value?.light) {
          setLightTheme({ ...lightTheme, ...themeConfig.config_value.light });
        }
        if (themeConfig.config_value?.dark) {
          setDarkTheme({ ...darkTheme, ...themeConfig.config_value.dark });
        }
      }
    }
  }, [data]);

  const handleLightThemeChange = (key: string, value: string) => {
    setLightTheme({ ...lightTheme, [key]: value });
  };

  const handleDarkThemeChange = (key: string, value: string) => {
    setDarkTheme({ ...darkTheme, [key]: value });
  };

  const parseCssTheme = (css: string) => {
    const light: Record<string, string> = {};
    const dark: Record<string, string> = {};

    // Extract :root block
    const rootMatch = css.match(/:root\s*\{([^}]+)\}/s);
    if (rootMatch) {
      const rootContent = rootMatch[1];
      const variables = rootContent.match(/--[\w-]+:\s*[^;]+/g);
      if (variables) {
        variables.forEach((variable) => {
          const [key, ...valueParts] = variable.split(":");
          const value = valueParts.join(":").trim();
          light[key.trim()] = value;
        });
      }
    }

    // Extract .dark block
    const darkMatch = css.match(/\.dark\s*\{([^}]+)\}/s);
    if (darkMatch) {
      const darkContent = darkMatch[1];
      const variables = darkContent.match(/--[\w-]+:\s*[^;]+/g);
      if (variables) {
        variables.forEach((variable) => {
          const [key, ...valueParts] = variable.split(":");
          const value = valueParts.join(":").trim();
          dark[key.trim()] = value;
        });
      }
    }

    return { light, dark };
  };

  const handleImportCss = () => {
    setIsImporting(true);
    const parsed = parseCssTheme(cssInput);

    setTimeout(() => {
      if (Object.keys(parsed.light).length > 0) {
        setLightTheme({ ...lightTheme, ...parsed.light });
        setLightOpen(true);
      }

      if (Object.keys(parsed.dark).length > 0) {
        setDarkTheme({ ...darkTheme, ...parsed.dark });
        setDarkOpen(true);
      }

      setCssInput("");
      setIsImporting(false);

      toast({
        title: "Theme imported successfully!",
        description: `Updated ${Object.keys(parsed.light).length + Object.keys(parsed.dark).length} variables.`,
        duration: 3000,
      });
    }, 500);
  };

  const handleReset = () => {
    setLightTheme({});
    setDarkTheme({});
    toast({
      title: "Theme reset",
      description: "Both themes have been reset to default (empty).",
      duration: 3000,
    });
  };

  const handleSave = async () => {
    try {
      const configData = {
        config_key: "theme_config",
        config_value: {
          light: lightTheme,
          dark: darkTheme,
        },
        description: "Platform theme configuration",
      };

      if (configId) {
        // Update existing configuration
        await updateConfig({
          variables: {
            id: configId,
            data: configData,
          },
        });
      } else {
        // Create new configuration
        const result = await createConfig({
          variables: {
            data: configData,
          },
        });
        setConfigId(result.data?.platform_configurationsCreateOne?.item?.id);
      }

      await refetch();

      toast({
        title: "Configuration saved",
        description: "Theme configuration has been saved successfully.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error saving configuration:", error);
      toast({
        title: "Error",
        description: "Failed to save configuration. Please try again.",
        duration: 3000,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="h-full flex-1 flex-col space-y-8 p-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Platform theme</h2>
          <p className="text-muted-foreground">
            Import custom styles to personalize your IMP.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleReset} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset Theme
          </Button>
          <Button onClick={handleSave}>Save Configuration</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import Theme CSS</CardTitle>
          <CardDescription>
            Paste your CSS theme code below to automatically populate all fields
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Paste your CSS theme here (including :root and .dark blocks)..."
            value={cssInput}
            onChange={(e) => setCssInput(e.target.value)}
            className="font-mono text-xs min-h-[200px]"
          />
          <Button
            onClick={handleImportCss}
            disabled={!cssInput.trim() || isImporting}
            className="relative"
          >
            {isImporting ? (
              <>
                <span className="opacity-0">Import Theme</span>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                </div>
              </>
            ) : (
              "Import Theme"
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Collapsible open={lightOpen} onOpenChange={setLightOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Light Theme Variables
                      {Object.keys(lightTheme).length > 0 && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </CardTitle>
                    <CardDescription>
                      Configure CSS variables for the light theme
                    </CardDescription>
                  </div>
                  <ChevronDown className={`h-5 w-5 transition-transform ${lightOpen ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="grid gap-4 md:grid-cols-2 pt-0">
                {Object.entries(lightTheme).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`light-${key}`} className="text-xs font-mono">
                      {key}
                    </Label>
                    <Input
                      id={`light-${key}`}
                      value={value as string}
                      onChange={(e) => handleLightThemeChange(key, e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <Collapsible open={darkOpen} onOpenChange={setDarkOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Dark Theme Variables
                      {Object.keys(darkTheme).length > 0 && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </CardTitle>
                    <CardDescription>
                      Configure CSS variables for the dark theme
                    </CardDescription>
                  </div>
                  <ChevronDown className={`h-5 w-5 transition-transform ${darkOpen ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="grid gap-4 md:grid-cols-2 pt-0">
                {Object.entries(darkTheme).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`dark-${key}`} className="text-xs font-mono">
                      {key}
                    </Label>
                    <Input
                      id={`dark-${key}`}
                      value={value as string}
                      onChange={(e) => handleDarkThemeChange(key, e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </div>
  );
}
