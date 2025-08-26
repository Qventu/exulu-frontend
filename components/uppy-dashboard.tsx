import useUppy from "@/hooks/use-uppy";
import { Dashboard } from '@uppy/react';
import { useContext, useState} from "react"
import { X, File, ImageIcon, FileText, FilePlus, Download, LoaderIcon, FileWarning } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';
import { useQuery } from "@tanstack/react-query";
import { files } from "@/util/api"
import { UserContext } from "@/app/(application)/authenticated";
import { useTheme } from "next-themes";
import { ConfigContext } from "./config-context";

export default function UppyDashboard({ id, allowedFileTypes, dependencies, onSelect, preselectedFile }: { 
  id: string,
  allowedFileTypes: string[], 
  dependencies: any[], 
  preselectedFile?: string
  onSelect: (key: string) => void
}) {
  const { user } = useContext(UserContext); 
  const configContext = useContext(ConfigContext);
  const [selectedFile, setSelectedFile] = useState<string | undefined>(preselectedFile)
  
  const { theme } = useTheme()
  console.log("theme", theme)
  const uppy = useUppy(
        {
            backend: configContext?.backend || "",
            uppyOptions: {
                id,
                allowedFileTypes
            },
            callbacks: {
                uploadSuccess: (data) => {
                  filesQuery.refetch()
                },
            },
            maxNumberOfFiles: 10,
        },
        dependencies,
    );

    const [open, setOpen] = useState(false)

    const filesQuery = useQuery({
      queryKey: ['filesQuery'],
      queryFn: async () => {
        const response = await files.list(user.id)
        const json = await response.json();
        console.log("Raw API response:", json);
        const filesArray = Array.isArray(json.files) ? json.files : [];
        return filesArray;
      },
      staleTime: 30000,
    })
  
    const getFileIcon = (key: string) => {
      if (
        key.toLowerCase().endsWith("jpg") ||
        key.toLowerCase().endsWith("jpeg") ||
        key.toLowerCase().endsWith("png") ||
        key.toLowerCase().endsWith("svg")
      ) {
        return <ImageIcon className="h-6 w-6 text-blue-500" />
      } else if (key.endsWith("pdf")) {
        return <File className="h-6 w-6 text-red-500" />
      } else if (key.endsWith("xls") || key.endsWith("xlsx") || key.endsWith("csv")) {
        return <FileText className="h-6 w-6 text-green-500" />
      } else if (key.endsWith("ppt") || key.endsWith("pptx")) {
        return <FileText className="h-6 w-6 text-orange-500" />
      } else {
        return <FileText className="h-6 w-6 text-gray-500" />
      }
    }
    if (!uppy) {
        return <Button variant="outline" disabled={true}>
        <FilePlus className="mr-2 h-4 w-4" />
        Upload or select file
      </Button>
    }

    console.log("selected", selectedFile)
    
    return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <Button variant="outline">
        <FilePlus className="mr-2 h-4 w-4" />
        {
          !selectedFile ? "Upload or select file" : "Selected: ..." + (selectedFile.length > 25 ? selectedFile.slice(-25) : selectedFile)
        }
      </Button>
    </DialogTrigger>
    <DialogContent className="sm:max-w-[900px]">
      <DialogHeader>
        <DialogTitle>File Gallery</DialogTitle>
        <DialogDescription>Browse your previously uploaded files or upload new ones.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Left side - Gallery of previously uploaded files */}
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-3">Previously Uploaded Files</h3>
          <ScrollArea className="h-[400px] pr-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {
                filesQuery.isLoading && <div>Loading...</div>
              }
              {
                !filesQuery.isLoading && !filesQuery.data?.length && <div>No files found.</div>
              }
              {filesQuery.data?.map((file: { key: string, size: number, lastModified: string}) => (
                <div key={file.key} onClick={() => {
                  onSelect(file.key)
                  setSelectedFile(file.key)
                  setOpen(false)
                }} className={`group relative rounded-lg p-2 hover:bg-muted transition-colors cursor-pointer ${selectedFile === file.key ? 'border border-purple-500' : 'border'}`}>
                  <div className="aspect-square relative mb-2 bg-muted/50 rounded-md overflow-hidden flex items-center justify-center">
                    {(
                      file.key.toLowerCase().endsWith("jpg") ||
                      file.key.toLowerCase().endsWith("jpeg") ||
                      file.key.toLowerCase().endsWith("png") ||
                      file.key.toLowerCase().endsWith("svg")
                    ) ? (
                      <SecureImageRenderComponent fileKey={file.key}/>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full">
                        {getFileIcon(file.key)}
                        <span className="text-xs text-muted-foreground mt-1">{file.key.split("-").pop()}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs truncate">{file.key.split("-").pop()}</p>

                  <div className="opacity-0 group-hover:opacity-100 flex absolute top-1 right-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 bg-background/80 hover:bg-background"
                    onClick={() => {
                      files.download(file.key).then(async res => {
                        console.log("res", res);
                        const json = await res.json()
                        console.log("res", json);
                        const downloadUrl = json.url;
                        window.open(downloadUrl, '_blank');
                        return;
                      })
                    }}
                  >
                    <Download className="h-3 w-3" />
                    <span className="sr-only">Download</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 bg-background/80 hover:bg-background ml-1"
                  >
                    <X className="h-3 w-3" />
                    <span className="sr-only">Remove</span>
                  </Button>
                  </div>
                
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Right side - Upload area */}
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-3">Upload New Files</h3>
          <Dashboard uppy={uppy} theme={theme === "dark" ? "dark": "light"}/>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}

const SecureImageRenderComponent = ({fileKey}: {fileKey: string}) => {
  // Gets a signed key to show the image
  console.log("key", fileKey)
  const query = useQuery({
    queryKey: ['imageQuery', fileKey],
    staleTime: 30000,
    queryFn: async () => {
      const response = await files.download(fileKey)
      const json = await response.json();
      console.log("json", json)
      return json.url;
    },
  })

  if (query.isLoading) {
    return <div><LoaderIcon/></div>
  }


  if (!query.isLoading && !query.data) {
    return <div><FileWarning/></div>
  }

  return (<img
    src={query.data}
    alt={fileKey}
    className="object-cover w-full h-full"
  />)

}