import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/ui/loading";
import { AgentBackendSelector } from "@/app/(application)/agents/components/agent-backend-selector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { agents, ImageStyle } from "@/util/api";
import { toast } from "sonner";

export function CreateNewAgent({ createAgent, createAgentResult, company, children }) {

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [backend, setBackend] = useState("");
  const [generateImage, setGenerateImage] = useState(true);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageGenerating, setImageGenerating] = useState(false);
  const [imageGenerationProgress, setImageGenerationProgress] = useState(0);
  const [imageStyle, setImageStyle] = useState<ImageStyle>("app_icon");

  const imageStyles = [
    { value: "origami", label: "Origami" },
    { value: "anime", label: "Anime" },
    { value: "japanese_anime", label: "Japanese Anime" },
    { value: "vaporwave", label: "Vaporwave" },
    { value: "lego", label: "Lego" },
    { value: "paper_cut", label: "Paper Cut" },
    { value: "felt_puppet", label: "Felt Puppet" },
    { value: "3d", label: "3D" },
    { value: "app_icon", label: "App Icon" },
    { value: "pixel_art", label: "Pixel Art" },
    { value: "isometric", label: "Isometric" },
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || <Button variant="secondary">Create new agent</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[475px]">
        <DialogHeader>
          <DialogTitle>Create a new agent</DialogTitle>
          <DialogDescription>
            Give your new agent a name and a description (optional).
          </DialogDescription>
        </DialogHeader>
        {
          !generateImage && (<div className="h-32 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg flex items-center justify-center">
            <div className="text-4xl font-bold text-primary">
              {name?.charAt(0).toUpperCase() || 'A'}
            </div>
          </div>)
        }
        {
          (imageGenerating) && (
            <div className="grid gap-4 py-4">
              <div className="w-full mb-4">
                <div className="space-y-4">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">Generating your agent images...</h3>
                    <p className="text-sm text-muted-foreground mb-4">Creating {imageGenerationProgress}/4 image options</p>
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden mx-auto">
                      <div
                        className="h-full bg-primary transition-all duration-300 ease-out"
                        style={{ width: `${(imageGenerationProgress / 4) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 4 }, (_, index) => (
                      <div key={index} className="relative h-32 rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/30">
                        <div className="w-full h-full bg-gradient-to-br from-muted/50 to-muted/20 flex flex-col items-center justify-center">
                          {index < imageGenerationProgress ? (
                            <div className="text-green-500">
                              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          ) : (
                            <Loading className="w-6 h-6 text-muted-foreground" />
                          )}
                          <span className="text-xs text-muted-foreground mt-2">
                            {index < imageGenerationProgress ? 'Complete' : 'Generating...'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {generatedImages.length > 0 && (
          <div className="grid">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {generatedImages.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(image)}
                    className={`relative h-32 rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${selectedImage === image ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
                      }`}
                  >
                    <img src={image} alt={`Generated option ${index + 1}`} className="w-full h-full object-cover" />
                    {selectedImage === image && (
                      <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <svg className="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {
          !imageGenerating && generatedImages.length <= 0 && (
            <div className="grid gap-4 py-4">
              <div className="w-full mb-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    onChange={(e) => {
                      setName(e.target.value);
                    }}
                    id="name"
                    autoFocus
                  />
                </div>
                <div className="grid gap-2 mt-3">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    onChange={(e) => {
                      setDescription(e.target.value);
                    }}
                    id="description"
                  />
                </div>
                <div className="grid gap-2 mt-3">
                  <Label htmlFor="backend">Backend</Label>
                  <AgentBackendSelector onSelect={(id) => {
                    setBackend(id)
                  }} />
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <Checkbox
                    id="generateImage"
                    checked={generateImage}
                    onCheckedChange={(checked) => setGenerateImage(checked === true)}
                  />
                  <Label htmlFor="generateImage" className="text-sm font-normal">
                    Generate AI image for this agent
                  </Label>
                </div>
                {generateImage && (
                  <div className="grid gap-2 mt-3">
                    <Label htmlFor="imageStyle">Image Style</Label>
                    <Select onValueChange={(value) => setImageStyle(value as typeof imageStyle)} defaultValue={imageStyle}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select image style" />
                      </SelectTrigger>
                      <SelectContent>
                        {imageStyles.map((style) => (
                          <SelectItem key={style.value} value={style.value}>
                            {style.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Alert variant="info" className="mt-3">
                  <AlertDescription>
                    Exulu can generate a cool image for your agent if an <strong>OPENAI_IMAGE_GENERATION_API_KEY</strong> has been added to your{" "}
                    <a href="/variables" className="text-primary hover:underline">
                      variables page
                    </a>
                    .
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          )
        }

        <DialogFooter>
          <Button
            disabled={createAgentResult.loading || imageGenerating}
            onClick={async () => {
              try {
                // If we have generated images, create the agent with selected image
                if (generatedImages.length > 0 && selectedImage) {
                  createAgent({
                    variables: {
                      name,
                      description,
                      rights_mode: "private",
                      backend,
                      image: selectedImage
                    },
                  });
                  return;
                }

                // Validate required fields
                if (!name) {
                  toast.error("Please fill in all fields");
                  return;
                }

                // If not generating images, create agent without image
                if (!generateImage) {
                  createAgent({
                    variables: {
                      name,
                      description,
                      rights_mode: "private",
                      backend,
                    },
                  });
                  return;
                }

                // Start image generation process
                if (generateImage && generatedImages.length === 0) {
                  setImageGenerating(true);
                  setImageGenerationProgress(0);

                  try {
                    // Generate 4 images simultaneously
                    const promises = Array.from({ length: 4 }, async () => {
                      const response = await agents.image.generate({ name, description, style: imageStyle });
                      const result = await response.json();
                      setImageGenerationProgress(prev => prev + 1);
                      return result.image;
                    });

                    const results = await Promise.all(promises);
                    const images = results.filter(Boolean);
                    setGeneratedImages(images);

                    if (images.length > 0) {
                      setSelectedImage(images[0]); // Auto-select first image
                    }
                  } catch (error) {
                    console.error("Failed to generate images:", error);
                    toast.error("Failed to generate images. Please try again.");
                  } finally {
                    setImageGenerating(false);
                  }
                }

              } catch (error) {
                console.error("Failed to create agent:", error);
                toast.error("Failed to create agent. Please try again.");
              }
            }}
            type="submit">
            {(generatedImages.length > 0 || !generateImage) ? 'Create Agent' : (imageGenerating ? 'Generating...' : 'Generate Images')} 
            {(createAgentResult.loading || imageGenerating) && <Loading className="ml-2" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog >
  );
}
