import useUppy from "@/hooks/use-uppy";
import { Dashboard } from '@uppy/react';
import { useContext, useEffect, useState } from "react"
import { X, File, ImageIcon, FileText, FilePlus, Download, LoaderIcon, FileWarning, Upload, PlusSquareIcon, EyeIcon, PlusIcon } from "lucide-react"
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
import { files } from "@/util/api"
import { UserContext } from "@/app/(application)/authenticated";
import { useTheme } from "next-themes";
import { ConfigContext } from "./config-context";
import { useQuery as useTanstackQuery } from "@tanstack/react-query";
import { useMutation, useQuery as useApolloQuery, useLazyQuery, useQuery } from "@apollo/client";
import { CREATE_ITEM, DELETE_ITEM, GET_ITEMS, PAGINATION_POSTFIX } from "@/queries/queries";
import { Item } from "@/types/models/item";
import { Context } from "@/types/models/context";
import { useContexts } from "@/hooks/contexts";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Loading } from "./ui/loading";
import { allFileTypes } from "@/types/models/agent";
import { Input } from "./ui/input";

export default function UppyDashboard({ id, allowedFileTypes, dependencies, onConfirm }: {
  id: string,
  allowedFileTypes: allFileTypes[],
  dependencies: any[],
  onConfirm: (items: Item[]) => void
}) {
  const [open, setOpen] = useState(false)
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <Button variant="outline">
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
        onConfirm={(data) => {
          onConfirm(data)
          setOpen(false)
        }}
      />
    </DialogContent>
  </Dialog>;
}

export const ItemsSelectionModal = ({ onConfirm }: {
  onConfirm: (data: {
    item: Item,
    context: Context
  }[]) => void
}) => {
  // Shows a modal that first shows a list of all contexts

  const { data, loading, error } = useContexts();
  const [context, setContext] = useState<Context | undefined>(undefined);
  const [open, setOpen] = useState(false);

  return (<Dialog open={open} onOpenChange={(value) => {
    setOpen(value)
    setContext(undefined)
  }}>
    <DialogTrigger asChild>
      <Button className="w-full" variant="outline">
        <PlusSquareIcon className="h-4 w-4 mr-2" />
        Select items from knowledge sources
        to add to the project, or upload files.
      </Button>
    </DialogTrigger>
    <DialogContent className="sm:max-w-[900px]">
      <DialogHeader>
        <DialogTitle>Item selection</DialogTitle>
        <DialogDescription>Browse through contexts and select items.</DialogDescription>
      </DialogHeader>
      {
        !context && (
          <Command className="rounded-lg border shadow-md md:min-w-[450px]">
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>

              <CommandGroup heading="Contexts">
                {
                  data?.contexts?.items.map((context: Context) => (
                    <CommandItem key={context.id} onSelect={() => {
                      setContext(context)
                    }}>
                      {context.name}
                    </CommandItem>
                  ))
                }
              </CommandGroup>

            </CommandList>
          </Command>
        )
      }
      {
        (context?.id && context?.id === "files_default_context") && (
          <FileGalleryAndUpload
            id={context.id}
            dependencies={[context.id]}
            onConfirm={(items) => {
              onConfirm(items.map((item) => ({
                item,
                context
              })))
              setOpen(false)
            }} />
        )
      }
      {
        (context?.id && context?.id !== "files_default_context") && (
          <ItemsList context={context} onConfirm={(item) => {
            console.log("item", item)
            onConfirm([{
              item,
              context
            }])
            setOpen(false)
          }} />
        )
      }
    </DialogContent>
  </Dialog>)
}

const ItemsList = ({ context, onConfirm }: { context: Context, onConfirm: (item: Item) => void }) => {
  const [search, setSearch] = useState<string | undefined>(undefined)
  let { loading, data, refetch, previousData: prev, error } = useQuery<{
    [key: string]: {
      pageInfo: {
        pageCount: number;
        itemCount: number;
        currentPage: number;
        hasPreviousPage: boolean;
        hasNextPage: boolean;
      };
      items: Item[];
    }
  }>(GET_ITEMS(context.id, []), {
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
    variables: {
      context: context.id,
      page: 1,
      limit: 10,
      sort: {
        field: "updatedAt",
        direction: "DESC",
      },
      filters: {
        archived: {
          ne: true
        },
        ...(search ? { name: { contains: `${search}` } } : {}),
      },
    },
  });

  return (
    <Command className="rounded-lg border shadow-md md:min-w-[450px]">
      <CommandInput onValueChange={(data) => setSearch(data)} placeholder="Type a command or search..." />
      <CommandList>
        <CommandGroup heading="Items">
          {
            !prev && loading && (
              <CommandItem key={"loading"}>
                <Loading />
              </CommandItem>
            )
          }
          {
            !loading && !data?.[context.id + PAGINATION_POSTFIX]?.items?.length && (
              <CommandEmpty>No items found.</CommandEmpty>
            )
          }
          {(data || prev)?.[context.id + PAGINATION_POSTFIX]?.items?.map((item: Item) => (
            <CommandItem key={item.id} onSelect={() => {
              onConfirm(item)
            }}>{item.name}</CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

export const FileGalleryAndUpload = ({ id, allowedFileTypes, dependencies, onConfirm }: {
  id: string,
  allowedFileTypes?: allFileTypes[],
  dependencies: any[],
  onConfirm: (items: Item[]) => void
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

  const { user } = useContext(UserContext);
  const [search, setSearch] = useState<string | undefined>(undefined)
  const configContext = useContext(ConfigContext);
  const [selected, setSelected] = useState<Item[]>([])

  const addSelected = (item: Item) => {
    setSelected([...selected, item])
  }

  const [createItemMutation, createItemMutationResult] = useMutation<{
    [key: string]: {
      item: {
        id: string;
      }
      job: string
    }
  }>(CREATE_ITEM("files_default_context"), {
    onCompleted: (data) => {
      refetch();
    }
  })

  const [deleteItemMutation, deleteItemMutationResult] = useMutation<{
    id: string;
    s3key: string;
  }>(DELETE_ITEM("files_default_context", ["s3key"]), {
    onCompleted: async (data) => {
      console.log("data", data)
      const s3key = data["files_default_context_itemsRemoveOneById"]?.s3key
      if (s3key) {
        await files.delete(s3key)
      }
      refetch();
    }
  })

  let { loading, data, refetch, previousData: prev, error } = useApolloQuery<{
    files_default_context_itemsPagination: {
      pageInfo: {
        pageCount: number;
        itemCount: number;
        currentPage: number;
        hasPreviousPage: boolean;
        hasNextPage: boolean;
      };
      items: Item[];
    }
  }>(GET_ITEMS("files_default_context", [
    "type",
    "url",
    "s3key"
  ]), {
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
    variables: {
      context: "files_default_context",
      page: 1,
      limit: 10,
      sort: {
        field: "updatedAt",
        direction: "DESC",
      },
      filters: {
        archived: {
          ne: true
        },
        ...(search ? { name: { contains: `${search}` } } : {}),
      },
    },
  });

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
          const item = {
            name: data.file.name,
            type: data.file.type,
            rights_mode: "private",
            s3key: `${user?.id}/${data.key}`
          }
          await createItemMutation({ variables: { input: item } })
        },
      },
      maxNumberOfFiles: 10,
    },
    dependencies,
  );

  useEffect(() => {
    refetch();
  }, [search]);

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
        <ScrollArea className="h-[400px] pr-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {
              loading && <div className="flex items-center justify-center h-full"><Loading /></div>
            }
            {
              !loading && !data?.files_default_context_itemsPagination?.items?.length && <small className="text-muted-foreground m-auto">No files found.</small>
            }
            {(data || prev)?.files_default_context_itemsPagination?.items?.map((item: Item) => (
              <FileItem key={item.id} context={"files_default_context"} item={item} onSelect={addSelected} active={selected.some((s) => s.s3key === item.s3key)} onRemove={() => {
                deleteItemMutation({ variables: { id: item.id } })
              }} disabled={false} />
            ))}
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

export const FileItem = ({ item, onSelect, onRemove, active, disabled, context, addToContext }: {
  item: Item,
  onSelect?: (file: Item) => void,
  onRemove?: (file: Item) => void,
  active: boolean,
  disabled: boolean,
  context: string,
  addToContext?: (file: Item) => void
}) => {

  const getFileIcon = (key: string) => {
    if (!key) {
      return <FileText className="h-6 w-6 text-gray-500" />
    }
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

  return (
    <div
      key={item.id}
      className={`${disabled ? 'opacity-50' : ''} group relative rounded-lg p-2 hover:bg-muted transition-colors cursor-pointer ${active ? 'border border-purple-500' : 'border'}`}
      onClick={() => {
        if (!disabled && onSelect) {
          onSelect(item)
        }
      }}>
      <div className="aspect-square relative mb-2 bg-muted/50 rounded-md overflow-hidden flex items-center justify-center">
        {(
          item.s3key && (
            item.s3key.toLowerCase().endsWith("jpg") ||
            item.s3key.toLowerCase().endsWith("jpeg") ||
            item.s3key.toLowerCase().endsWith("png") ||
            item.s3key.toLowerCase().endsWith("svg")
          )
        ) ? (
          <SecureImageRenderComponent fileKey={item.s3key} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            {getFileIcon(item.s3key)}
            <span className="text-xs text-muted-foreground mt-1 text-center">{item.s3key ? item.s3key.split("-").pop() : item.name}</span>
          </div>
        )}
      </div>
      <p className="text-xs truncate">{item.s3key ? item.s3key.split("-").pop() : item.name}</p>
      <div className="opacity-0 group-hover:opacity-100 flex absolute top-1 right-1">
        {/* todo add ye icon with tooltip to go to the item's detail view. */}
        <Button variant="ghost" size="icon" type="button" className="h-6 w-6 bg-background/80 hover:bg-background" onClick={() => {
          window.open(`/data/${context}/${item.id}`, '_blank');
        }}>
          <EyeIcon className="h-3 w-3" />
          <span className="sr-only">View</span>
        </Button>

        {addToContext && (
          <Button variant="ghost" size="icon" type="button" className="h-6 w-6 bg-background/80 hover:bg-background" onClick={() => {
            addToContext(item)
          }}>
            <PlusIcon className="h-3 w-3" />
            <span className="sr-only">Add</span>
          </Button>
        )}

        {item.s3key && (
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className="h-6 w-6 bg-background/80 hover:bg-background"
            onClick={() => {
              files.download(item.s3key).then(async res => {
                console.log("res", res);
                const json = await res.json()
                console.log("res", json);
                const downloadUrl = json.url;
                window.open(downloadUrl, '_blank');
                return;
              })
            }}>
            <Download className="h-3 w-3" />
            <span className="sr-only">Download</span>
          </Button>
        )}

        {onRemove && (
          <Button
            onClick={(e) => {
              e.stopPropagation()
              onRemove(item)
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