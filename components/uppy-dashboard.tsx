import useUppy from "@/hooks/use-uppy";
import { Dashboard } from '@uppy/react';
import { useContext, useEffect, useState } from "react"
import { X, File, ImageIcon, FileText, FilePlus, Download, LoaderIcon, FileWarning, Upload, PlusSquareIcon, EyeIcon, PlusIcon, ChevronRightIcon, ChevronLeftIcon } from "lucide-react"
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
import { files, S3FileListOutput } from "@/util/api"
import { useTheme } from "next-themes";
import { ConfigContext } from "./config-context";
import { useQuery as useTanstackQuery, useMutation as useTanstackMutation } from "@tanstack/react-query";
import { Loading } from "./ui/loading";
import { allFileTypes } from "@/types/models/agent";
import { Input } from "./ui/input";
import { DoubleArrowLeftIcon } from "@radix-ui/react-icons";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

export function FileDataCard({ s3key, children }: { s3key: string, children?: React.ReactNode }) {
  const { data, isLoading, error, refetch } = useTanstackQuery({
    queryKey: ['fileObject', s3key],
    queryFn: async () => {
      if (!s3key) {
        return null;
      }
      const result = await files.object(s3key);
      return result;
    },
    enabled: s3key !== undefined && s3key !== null,
  })

  useEffect(() => {
    if (s3key) {
      refetch();
    }
  }, [s3key]);

  if (!s3key) {
    return <Card>
      <CardContent className="p-3 flex">
        <p className="text-sm text-muted-foreground m-auto">No file selected</p>
        {children}
      </CardContent>
    </Card>;
  }

  return <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-sm truncate">{s3key.split("_EXULU_").pop()}</CardTitle>
    </CardHeader>
    <CardContent className="pt-0">
      {
        isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )
      }
      {!isLoading && data && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="capitalize">{data?.ContentType.split("/").pop()}</span>
            <span>{(data?.ContentLength / 1024 / 1024).toFixed(2)} MB</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Last modified: {new Date(data?.LastModified).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              className="h-7 px-2"
              onClick={() => {
                files.download(s3key).then(async res => {
                  console.log("res", res);
                  const json = await res.json()
                  console.log("res", json);
                  const downloadUrl = json.url;
                  window.open(downloadUrl, '_blank');
                  return;
                })
              }}>
              <span className="mr-1 text-xs">View</span>
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
      {
        !isLoading && error && (
          <p className="text-xs text-muted-foreground">{error.message}</p>
        )
      }
      {children}
    </CardContent>
  </Card>
}

export default function UppyDashboard({ id, allowedFileTypes, dependencies, onConfirm, selectionLimit, buttonText }: {
  id: string,
  buttonText?: string,
  allowedFileTypes?: allFileTypes[],
  selectionLimit: number,
  dependencies: any[],
  onConfirm: (keys: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <Button variant="outline">
        {buttonText && (
          <span className="mr-2">{buttonText}</span>
        )
        }
        <FilePlus className="h-4 w-4" />
      </Button>
    </DialogTrigger>
    <DialogContent className="sm:max-w-[900px]">
      <DialogHeader>
        <DialogTitle>File Gallery</DialogTitle>
        <DialogDescription>Browse your previously uploaded files or upload new ones.</DialogDescription>
      </DialogHeader>
      <FileGalleryAndUpload
        id={id}
        allowedFileTypes={allowedFileTypes}
        dependencies={dependencies}
        selectionLimit={selectionLimit}
        onConfirm={(data) => {
          onConfirm(data)
          setOpen(false)
        }}
      />
    </DialogContent>
  </Dialog>;
}

export const FileGalleryAndUpload = ({ id, allowedFileTypes, dependencies, onConfirm, selectionLimit }: {
  id: string,
  allowedFileTypes?: allFileTypes[],
  dependencies: any[],
  selectionLimit: number,
  onConfirm: (keys: string[]) => void
}) => {

  if (!allowedFileTypes) {
    allowedFileTypes = [
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.webp',
      '.pdf',
      '.docx',
      '.xlsx',
      '.xls',
      '.csv',
      '.pptx',
      '.ppt',
      '.mp3',
      '.wav',
      '.m4a',
      '.mp4',
      '.mpeg',
      '.mp4',
      '.m4a',
      '.mp3',
      '.mpeg',
      '.wav'
    ]
  }

  const [search, setSearch] = useState<string | undefined>(undefined)
  const [previousContinuationToken, setPreviousContinuationToken] = useState<string | undefined>(undefined)
  const [currentContinuationToken, setCurrentContinuationToken] = useState<string | undefined>(undefined)
  const configContext = useContext(ConfigContext);
  const [selected, setSelected] = useState<string[]>([])

  const addSelected = (key: string) => {
    if (selected.includes(key)) {
      setSelected(selected.filter((s) => s !== key))
      return;
    }
    if (selectionLimit === 1) {
      setSelected([key])
      return;
    }
    if (selected.length >= selectionLimit) {
      return;
    }
    setSelected([...selected, key])
  }

  const deleteFile = useTanstackMutation({
    mutationFn: async ({ key }: { key: string }) => {
      await files.delete(key)
      refetch();
      return;
    }
  })

  const { data, isLoading: loading, error, refetch } = useTanstackQuery({
    queryKey: ['filesQuery', search, currentContinuationToken],
    staleTime: 30000,
    queryFn: async (): Promise<S3FileListOutput> => {
      return files.list({
        search,
        continuationToken: currentContinuationToken
      })
    },
  })

  console.log("!! data !!", data)

  const { theme } = useTheme()
  const uppy = useUppy(
    {
      backend: configContext?.backend || "",
      uppyOptions: {
        id,
        allowedFileTypes
      },
      callbacks: {
        uploadSuccess: async (data) => {
          console.log("data", data)
          /* 
          We no longer create items automatically for files uploaded via uppy.
          const item = {
            name: data.file.name,
            type: data.file.type,
            rights_mode: "private",
            s3key: `${user?.id}/${data.key}`
          }
          await createItemMutation({ variables: { input: item } }) */
        },
      },
      maxNumberOfFiles: 10,
    },
    dependencies,
  );

  useEffect(() => {
    refetch();
  }, [search, currentContinuationToken]);

  // Loading state
  if (!uppy) {
    return null;
  }

  return <>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      {/* Left side - Gallery of previously uploaded files */}
      <div className="border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-3">Previously Uploaded Files</h3>

        {/* search */}
        <Input
          placeholder="Search files..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground pb-2">
          <span>{selected.length} / {selectionLimit} files selected</span>
          <span>Allowed file types: {allowedFileTypes?.map((type) => type).join(", ")}</span>
        </div>
        <ScrollArea>
          {loading && (
            <div className="flex items-center justify-center h-full w-full grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Skeleton className="h-[120px] w-full" />
              <Skeleton className="h-[120px] w-full" />
              <Skeleton className="h-[120px] w-full" />
              <Skeleton className="h-[120px] w-full" />
              <Skeleton className="h-[120px] w-full" />
              <Skeleton className="h-[120px] w-full" />
              <Skeleton className="h-[120px] w-full" />
              <Skeleton className="h-[120px] w-full" />
              <Skeleton className="h-[120px] w-full" />
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {
              !loading && !data?.Contents?.length && <small className="text-muted-foreground m-auto">No files found.</small>
            }
            {data?.Contents?.map((item: S3FileListOutput["Contents"][0]) => {
              return (
                <FileItem s3Key={item.Key} onSelect={addSelected} active={selected.some((s) => s === item.Key)} onRemove={() => {
                  deleteFile.mutate({
                    key: item.Key
                  })
                }} disabled={!allowedFileTypes ? false : !allowedFileTypes?.some((type) => item.Key.endsWith(type))} />
              )
            })}
          </div>

          <div className="flex items-center space-x-6 lg:space-x-8 pt-3">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="hidden size-8 p-0 lg:flex"
                onClick={() => {
                  setCurrentContinuationToken(undefined)
                }}
                disabled={
                  !currentContinuationToken ||
                  loading
                }
              >
                <span className="sr-only">Go to first page</span>
                <DoubleArrowLeftIcon className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="size-8 p-0"
                onClick={() => {
                  setCurrentContinuationToken(previousContinuationToken)
                }}
                disabled={
                  !currentContinuationToken ||
                  loading
                }
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeftIcon className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="size-8 p-0"
                onClick={() => {
                  setPreviousContinuationToken(currentContinuationToken)
                  setCurrentContinuationToken(data?.NextContinuationToken)
                }}
                disabled={
                  !data?.NextContinuationToken ||
                  loading
                }>
                <span className="sr-only">Go to next page</span>
                <ChevronRightIcon className="size-4" />
              </Button>
            </div>
          </div>
        </ScrollArea>
      </div>
      {/* Right side - Upload area */}
      <div className="border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-3">Upload New Files</h3>
        <Dashboard uppy={uppy} theme={theme === "dark" ? "dark" : "light"} />
      </div>
    </div>
    <div className="flex justify-end">
      <Button variant="outline" onClick={() => {
        onConfirm(selected)
        setSelected([])
      }}>
        Confirm
      </Button>
    </div>
  </>
}

export const FileItem = ({ s3Key, onSelect, onRemove, active, disabled, addToContext }: {
  s3Key: string,
  onSelect?: (key: string) => void,
  onRemove?: (key: string) => void,
  active: boolean,
  disabled: boolean,
  addToContext?: (key: string) => void
}) => {
  const getFileIcon = (s3Key: string) => {
    if (!s3Key) {
      return <FileText className="h-6 w-6 text-gray-500" />
    }
    if (
      s3Key.toLowerCase().endsWith("jpg") ||
      s3Key.toLowerCase().endsWith("jpeg") ||
      s3Key.toLowerCase().endsWith("png") ||
      s3Key.toLowerCase().endsWith("svg")
    ) {
      return <ImageIcon className="h-6 w-6 text-blue-500" />
    } else if (s3Key.endsWith("pdf")) {
      return <File className="h-6 w-6 text-red-500" />
    } else if (s3Key.endsWith("xls") || s3Key.endsWith("xlsx") || s3Key.endsWith("csv")) {
      return <FileText className="h-6 w-6 text-green-500" />
    } else if (s3Key.endsWith("ppt") || s3Key.endsWith("pptx")) {
      return <FileText className="h-6 w-6 text-orange-500" />
    } else {
      return <FileText className="h-6 w-6 text-gray-500" />
    }
  }

  return (
    <div
      key={s3Key}
      className={`${disabled ? 'opacity-50' : ''} group relative rounded-lg p-2 hover:bg-muted transition-colors cursor-pointer ${active ? 'border border-purple-500' : 'border'}`}
      onClick={() => {
        if (!disabled && onSelect) {
          onSelect(s3Key)
        }
      }}>
      <div className="aspect-square relative mb-2 bg-muted/50 rounded-md overflow-hidden flex items-center justify-center">
        {(
          s3Key && (
            s3Key.toLowerCase().endsWith("jpg") ||
            s3Key.toLowerCase().endsWith("jpeg") ||
            s3Key.toLowerCase().endsWith("png") ||
            s3Key.toLowerCase().endsWith("svg")
          )
        ) ? (
          <SecureImageRenderComponent fileKey={s3Key} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            {getFileIcon(s3Key)}
            <span className="text-xs text-muted-foreground mt-1 text-center">{s3Key ? s3Key.split("_EXULU_").pop() : s3Key}</span>
          </div>
        )}
      </div>
      <p className="text-xs truncate">{s3Key ? s3Key.split("_EXULU_").pop() : s3Key}</p>
      <div className="opacity-0 group-hover:opacity-100 flex absolute top-1 right-1">

        {addToContext && (
          <Button variant="ghost" size="icon" type="button" className="h-6 w-6 bg-background/80 hover:bg-background" onClick={() => {
            addToContext(s3Key)
          }}>
            <PlusIcon className="h-3 w-3" />
            <span className="sr-only">Add</span>
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="h-6 w-6 bg-background/80 hover:bg-background"
          onClick={() => {
            files.download(s3Key).then(async res => {
              console.log("res", res);
              const json = await res.json()
              console.log("res", json);
              const downloadUrl = json.url;
              window.open(downloadUrl, '_blank');
              return;
            })
          }}>
          <Download className="h-3 w-3" />
          <span className="sr-only">View</span>
        </Button>

        {onRemove && (
          <Button
            onClick={(e) => {
              e.stopPropagation()
              onRemove(s3Key)
            }}
            variant="ghost"
            type="button"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 bg-background/80 hover:bg-background ml-1">
            <X className="h-3 w-3" />
            <span className="sr-only">Remove</span>
          </Button>
        )}
      </div>
    </div>
  )
}

let signedUrlCache: {
  [key: string]: {
    url: string;
    expiresAt: number;
  }
} = {};

export const getPresignedUrl = async (fileKey: string) => {
  if (signedUrlCache[fileKey]) {
    if (signedUrlCache[fileKey].expiresAt < Date.now()) {
      delete signedUrlCache[fileKey];
    } else {
      return signedUrlCache[fileKey].url;
    }
  }
  const response = await files.download(fileKey)
  const json = await response.json();
  console.log("json", json)
  signedUrlCache[fileKey] = {
    url: json.url,
    expiresAt: Date.now() + 60 * 1000, // 1 minute
  }
  return json.url;
}

const SecureImageRenderComponent = ({ fileKey }: { fileKey: string }) => {
  // Gets a signed key to show the image
  console.log("key", fileKey)
  const query = useTanstackQuery({
    queryKey: ['imageQuery', fileKey],
    staleTime: 30000,
    queryFn: async () => {
      return getPresignedUrl(fileKey)
    },
  })

  if (query.isLoading) {
    return <div><LoaderIcon /></div>
  }

  if (!query.isLoading && !query.data) {
    return <div><FileWarning /></div>
  }

  return (<img
    src={query.data}
    alt={fileKey}
    className="object-cover w-full h-full"
  />)

}