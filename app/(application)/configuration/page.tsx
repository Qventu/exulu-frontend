"use client";

import { useState, useEffect, useRef } from "react";
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

const AGENT_VISUALIZATION_ENABLED = process.env.NEXT_PUBLIC_AGENT_VISUALIZATION === "true";

const CHARACTER_STYLES = [
  { index: 0, label: "Style 1" },
  { index: 1, label: "Style 2" },
  { index: 2, label: "Style 3" },
  { index: 3, label: "Style 4" },
  { index: 4, label: "Style 5" },
];

function CharacterStylePreview({ spriteIndex }: { spriteIndex: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = `/agent-world/characters/char_${spriteIndex}.png`;
    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      // Draw walking-down frame 1 (16×32) at 3× zoom
      ctx.clearRect(0, 0, 48, 96);
      ctx.drawImage(img, 16, 0, 16, 32, 0, 0, 48, 96);
    };
  }, [spriteIndex]);

  return <canvas ref={canvasRef} width={48} height={96} style={{ imageRendering: "pixelated" }} />;
}

export default function ConfigurationPage() {
  const [lightTheme, setLightTheme] = useState({});
  const [darkTheme, setDarkTheme] = useState({});
  const [cssInput, setCssInput] = useState("");
  const [lightOpen, setLightOpen] = useState(false);
  const [darkOpen, setDarkOpen] = useState(false);
  const [agentWorldOpen, setAgentWorldOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [agentWorldConfigId, setAgentWorldConfigId] = useState<string | null>(null);
  const [characterStyle, setCharacterStyle] = useState(0);
  const { toast } = useToast();

  // Fetch all platform configurations
  const { data, loading, refetch } = useQuery(GET_PLATFORM_CONFIGURATIONS);

  const [createConfig] = useMutation(CREATE_PLATFORM_CONFIGURATION);
  const [updateConfig] = useMutation(UPDATE_PLATFORM_CONFIGURATION);

  // Load existing configuration when data is fetched
  useEffect(() => {
    if (data?.platform_configurationsPagination?.items) {
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

      const agentWorldConfig = data.platform_configurationsPagination.items.find(
        (config: any) => config.config_key === "agent_world_config"
      );
      if (agentWorldConfig) {
        setAgentWorldConfigId(agentWorldConfig.id);
        if (typeof agentWorldConfig.config_value?.characterStyle === "number") {
          setCharacterStyle(agentWorldConfig.config_value.characterStyle);
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

  const handleSaveAgentWorld = async () => {
    try {
      const configData = {
        config_key: "agent_world_config",
        config_value: { characterStyle },
        description: "Agent world visualization configuration",
      };
      if (agentWorldConfigId) {
        await updateConfig({ variables: { id: agentWorldConfigId, data: configData } });
      } else {
        const result = await createConfig({ variables: { data: configData } });
        setAgentWorldConfigId(result.data?.platform_configurationsCreateOne?.item?.id);
      }
      await refetch();
      toast({ title: "Agent World settings saved", duration: 3000 });
    } catch {
      toast({ title: "Error saving", variant: "destructive", duration: 3000 });
    }
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

      {AGENT_VISUALIZATION_ENABLED && (
        <Collapsible open={agentWorldOpen} onOpenChange={setAgentWorldOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Agent World</CardTitle>
                    <CardDescription>
                      Configure the agent world visualization dashboard
                    </CardDescription>
                  </div>
                  <ChevronDown className={`h-5 w-5 transition-transform ${agentWorldOpen ? "rotate-180" : ""}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-6 pt-0">
                <div>
                  <Label className="text-sm font-medium">Default Character Style</Label>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Character style assigned to new agents in the Agent World visualization
                  </p>
                  <div className="flex gap-4 flex-wrap">
                    {CHARACTER_STYLES.map(({ index, label }) => (
                      <button
                        key={index}
                        onClick={() => setCharacterStyle(index)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:border-primary ${
                          characterStyle === index
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        }`}
                      >
                        <CharacterStylePreview spriteIndex={index} />
                        <span className="text-xs font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <Button onClick={handleSaveAgentWorld} size="sm">
                  Save Agent World Settings
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
