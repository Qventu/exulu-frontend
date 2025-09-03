"use client"

import { useQuery, useMutation } from "@apollo/client";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Archive,
  ChevronsUpDown,
  Edit,
  Expand,
  MoreVertical,
  PackageOpen,
  SaveIcon,
  Trash2,
  XCircle,
  XSquare,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { CodePreview } from "@/components/custom/code-preview";
import { TextPreview } from "@/components/custom/text-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { Item } from "@EXULU_SHARED/models/item";
import { Context } from "@/types/models/context";
import { DELETE_CHUNKS, DELETE_ITEM, GENERATE_CHUNKS, GET_ITEM_BY_ID, UPDATE_ITEM } from "@/queries/queries";
import { RBACControl } from "@/components/rbac";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";

interface DataDisplayProps {
  actions: boolean;
  itemId: string | null;
  context: Context;
}

export function DataDisplay(props: DataDisplayProps) {

  const [data, setData] = useState<Item>();
  const { toast } = useToast();
  const router = useRouter();

  const [rbac, setRbac] = useState<{
    rights_mode?: 'private' | 'users' | 'roles' | 'public';
    users?: Array<{ id: string; rights: 'read' | 'write' }>;
    roles?: Array<{ id: string; rights: 'read' | 'write' }>;
  }>()

  const context = props.context;
  const fields = props.context.fields.map(field => field.name);

  console.log("fields", fields);

  const { loading, error, refetch } = useQuery<{
    item: Item;
  }>(GET_ITEM_BY_ID(props.context.id, fields, true), {
    skip: !props.itemId || !props.context?.id,
    variables: {
      context: props.context.id,
      id: props.itemId
    },
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
    onCompleted: (data) => {
      const item = data[props.context.id + "_itemsById"];
      setData({
        ...item,
        tags: item.tags ? item.tags.split(",") : [],
      });

      setRbac({
        rights_mode: item.rights_mode,
        users: item.RBAC?.users,
        roles: item.RBAC?.roles
      })
    }
  });

  useEffect(() => {
    refetch();
  }, [props.itemId]);


  const [updateItemMutation, updateItemMutationResult] = useMutation<{
    [key: string]: {
      job: string;
      item: {
        name?: string;
        archived?: boolean;
        description?: string;
        tags?: string[];
        external_id?: string;
        [key: string]: any;
      }
    }
  }>(UPDATE_ITEM(props.context.id), {
    onCompleted: () => {
      toast({
        title: "Item updated",
        description: "Item updated successfully.",
      })
    },
    onError: (error) => {
      toast({
        title: "Error updating item",
        description: error.message,
      })
    }
  });

  const [deleteItemMutation, deleteItemMutationResult] = useMutation<{
    id: string;
  }>(DELETE_ITEM(props.context.id), {
    onCompleted: () => {
      toast({
        title: "Item deleted",
        description: "Item deleted successfully.",
      })
    },
    onError: (error) => {
      toast({
        title: "Error deleting item",
        description: error.message,
      })
    }
  });

  const [generateChunksMutation, generateChunksMutationResult] = useMutation<{
    [key: string]: {
      jobs: string[];
      items: number;
    }
  }>(GENERATE_CHUNKS(props.context.id), {
    onCompleted: (output) => {
      const data = output[props.context.id + "_itemsGenerateChunks"];
      if (data.jobs?.length > 0) {
        toast({
          title: "Chunks generation started",
          description: "Jobs have been started in the background, depending on the size of the item this may take a while.",
        })
        return;
      }
      toast({
        title: "Chunks generated",
        description: "Chunks generated successfully.",
      })
    },
  });


  const [deleteChunksMutation, deleteChunksMutationResult] = useMutation<{
    [key: string]: {
      jobs: string[];
      items: number;
    }
  }>(DELETE_CHUNKS(props.context.id), {
    onCompleted: (output) => {
      const data = output[props.context.id + "_itemsDeleteChunks"];
      if (data.jobs?.length > 0) {
        toast({
          title: "Chunks deletion started",
          description: "Jobs have been started in the background, depending on the size of the item this may take a while.",
        })
        return;
      }
      toast({
        title: "Chunks deleted",
        description: "Chunks deleted successfully.",
      })
    },
  });

  const itemFormSchema = z.object({
    name: z.string().nullable().optional(),
    tags: z.string().nullable().optional(),
    external_id: z.string().nullable().optional(),
    description: z.string()
      .min(2, { message: "Text must be at least 2 characters." })
      .max(10000, { message: "Text must not be longer than 10.0000 characters." }),
    ...(context?.fields?.reduce((acc, field) => ({
      ...acc,
      [field.name]: z.string().nullable()
    }), {}) ?? {})
  });

  type ItemFormValues = z.infer<typeof itemFormSchema>;

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      description: data?.description,
    },
    mode: "onChange",
  });

  const handleTags = (e: any) => {
    if (!e.target.value) {
      return;
    }
    if (e.key === "Enter") {
      let values = data?.tags ?? [];
      let copy;
      if (!Array.isArray(values)) {
        copy = [];
      } else {
        copy = [...values];
      }
      const tags: string[] = [...copy];
      tags.push(e.target.value);
      console.log("tags", tags);
      form.setValue("tags", tags.join(","));
      setData({
        ...data,
        tags: tags,
      });
      e.target.value = "";
    }
  };

  const [editing, setEditing] = useState(false);
  const [expandedField, setExpandedField] = useState<{ name: string, value: string } | null>(null);
  const [confirmationModal, setConfirmationModal] = useState<"generate" | "delete" | null>(null);

  useEffect(() => {
    if (data?.text === "New item") {
      setEditing(true);
    } else {
      setEditing(false);
    }
  }, [data?.id]);

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Skeleton className="w-full h-[80px] rounded-md" />
        <Skeleton className="w-full h-[50px] rounded-md mt-3" />
        <Skeleton className="w-full h-[80px] rounded-md mt-3" />
        <Skeleton className="w-full h-[80px] rounded-md mt-3" />
        <Skeleton className="w-full h-[80px] rounded-md mt-3" />
        <Skeleton className="w-full h-[80px] rounded-md mt-3" />
      </div>
    )
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <ExclamationTriangleIcon className="size-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {error?.message || "Error loading item."}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex h-full flex-col">

      {data ? (
        <>
          {props.actions ? (
            <>
              <div className="flex items-center p-2">
                <div className="flex items-center gap-2">
                  {data?.archived ? (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={async () => {
                              if (!data.id) {
                                return;
                              }
                              updateItemMutation({
                                variables: {
                                  id: data.id,
                                  input: {
                                    archived: false,
                                  },
                                }
                              });
                              setData({
                                ...data,
                                archived: false,
                              });
                              router.push("./");
                            }}
                            variant="ghost"
                            size="icon"
                            disabled={!data || updateItemMutationResult.loading}
                          >
                            {updateItemMutationResult.loading ? (
                              <Loading />
                            ) : (
                              <PackageOpen className="size-4" />
                            )}
                            <span className="sr-only">Unarchive</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Unarchive</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={async () => {
                              if (!data.id) {
                                return;
                              }
                              deleteItemMutation({
                                variables: {
                                  id: data.id,
                                }
                              });
                              router.push("./");
                            }}
                            variant="ghost"
                            size="icon"
                            disabled={!data || deleteItemMutationResult.loading}
                          >
                            {deleteItemMutationResult.loading ? (
                              <Loading />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                            <span className="sr-only">Delete</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={async () => {
                            if (!data?.id) {
                              return;
                            }
                            updateItemMutation({
                              variables: {
                                id: data.id,
                                input: { archived: true },
                              }
                            });
                            setData({
                              ...data,
                              archived: true,
                            });
                            router.push("./");
                          }}
                          variant="ghost"
                          size="icon"
                          disabled={!data || updateItemMutationResult.loading}
                        >
                          {updateItemMutationResult.loading ? (
                            <Loading />
                          ) : (
                            <Archive className="size-4" />
                          )}
                          <span className="sr-only">Archive</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Archive</TooltipContent>
                    </Tooltip>
                  )}
                  {editing ? (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => {
                              setEditing(false);
                            }}
                            variant="ghost"
                            size="icon"
                          >
                            <XSquare className="size-4" />
                            <span className="sr-only">Cancel</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Cancel</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            disabled={updateItemMutationResult.loading}
                            onClick={() => {
                              if (!data?.id) {
                                return;
                              }
                              updateItemMutation({
                                variables: {
                                  id: data.id,
                                  input: {
                                    textlength: data?.text?.length,
                                    description: data?.description,
                                    name: data?.name,
                                    externalId: data?.externalId,
                                    tags: data?.tags?.join(","),
                                    source: data?.source,
                                    archived: data?.archived,
                                    rights_mode: rbac?.rights_mode,
                                    RBAC: {
                                      users: rbac?.users || [],
                                      roles: rbac?.roles || []
                                    },
                                    ...(context?.fields?.reduce((acc, field) => ({
                                      ...acc,
                                      [field.name]: data?.[field.name]
                                    }), {}) ?? {})
                                  },
                                }
                              });
                              setEditing(false);
                            }}
                            variant="ghost"
                            size="icon"
                          >
                            <SaveIcon className="size-4" />
                            <span className="sr-only">
                              Save {updateItemMutationResult.loading ?? <Loading />}
                            </span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Save</TooltipContent>
                      </Tooltip>
                    </>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => {
                            setEditing(true);
                          }}
                          variant="ghost"
                          size="icon"
                          disabled={!data || updateItemMutationResult.loading}
                        >
                          <Edit className="size-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
              <Separator />
            </>
          ) : null}
          <div className="flex flex-1 flex-col">
            <div className={cn("space-y-2")}>
              <div className="flex items-center justify-between space-x-4 px-4 bg-muted rounded">
                <h3 className="text-lg p-5 font-semibold tracking-tight text-lg">
                  Fields
                </h3>
              </div>
              <div className="p-5">
                <Form {...form}>
                  <form className="space-y-8">
                    <div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>

                          <TableRow key={"name"}>
                            <TableCell className="font-medium capitalize">
                              Name
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                  <FormItem>
                                    {!editing ? (
                                      <div
                                        onClick={async () => {
                                          await navigator.clipboard.writeText(
                                            data.name ?? "",
                                          );
                                          toast({ title: "Copied to clipboard" });
                                        }}
                                        className="flex-1 whitespace-pre-wrap text-sm cursor-copy"
                                      >
                                        {data.name}
                                      </div>
                                    ) : (
                                      <>
                                        <FormControl>
                                          <Input
                                            type="text"
                                            disabled={!editing}
                                            onChange={(e) => {
                                              setData({
                                                ...data,
                                                name: e.target.value,
                                              });
                                            }}
                                            placeholder="Item name"
                                            value={data.name ?? ""}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </>
                                    )}
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                          </TableRow>

                          <TableRow key={"tags"}>
                            <TableCell className="font-medium capitalize">
                              Tags
                            </TableCell>
                            <TableCell>
                              {editing ? (
                                <div className="grid-row grid grid-flow-col gap-4 pt-2">
                                  <FormField
                                    control={form.control}
                                    name="tags"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input
                                            id="includes"
                                            type="text"
                                            onKeyUp={(e) => handleTags(e)}
                                            placeholder="Type and press enter to add"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              ) : null}

                              {data?.tags?.length ? (
                                <div className="gap-2 pt-2">
                                  {data?.tags?.map(
                                    (text: string, index: number) => {
                                      return (
                                        <Badge
                                          key={`tag-${index}`}
                                          variant={"secondary"}
                                          className="px-3 py-2 mr-2 mb-2"
                                        >
                                          <div className="flex items-center">
                                            <div className="text-muted-foreground">
                                              {text}
                                            </div>
                                            {editing ? (
                                              <span
                                                className="size-4 cursor-pointer text-muted-foreground"
                                                onClick={() => {
                                                  const tags: string[] = [...data.tags ?? []];
                                                  tags.splice(index, 1);
                                                  form.setValue("tags", tags.join(","));
                                                  setData({
                                                    ...data,
                                                    tags: tags,
                                                  });
                                                }}
                                              >
                                                <XCircle
                                                  className="ml-1"
                                                  size={15}
                                                />
                                              </span>
                                            ) : null}
                                          </div>
                                        </Badge>
                                      );
                                    },
                                  )}
                                </div>
                              ) : null}
                            </TableCell>
                          </TableRow>

                          <TableRow key={19091}>
                            <TableCell className="font-medium capitalize">
                              Description
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                  <FormItem>
                                    {!editing ? (
                                      <div
                                        onClick={async () => {
                                          await navigator.clipboard.writeText(
                                            data.description ?? "",
                                          );
                                          toast({ title: "Copied to clipboard" });
                                        }}
                                        className="flex-1 whitespace-pre-wrap text-sm cursor-copy"
                                      >
                                        <TextPreview text={data.description ?? ""} />
                                      </div>
                                    ) : (
                                      <>
                                        <FormControl>
                                          <div className="relative">
                                            <Textarea
                                              autoFocus={true}
                                              disabled={!editing}
                                              onChange={(e) => {
                                                setData({
                                                  ...data,
                                                  description: e.target.value,
                                                });
                                              }}
                                              placeholder="Item text content"
                                              className="resize-none"
                                              value={data.description ?? ""}
                                            />
                                            <Dialog>
                                              <DialogTrigger asChild>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="absolute top-2 right-2 h-6 w-6 p-0"
                                                  onClick={() => setExpandedField({
                                                    name: "description",
                                                    value: data.description ?? ""
                                                  })}
                                                >
                                                  <Expand className="h-3 w-3" />
                                                  <span className="sr-only">Expand</span>
                                                </Button>
                                              </DialogTrigger>
                                              <DialogContent className="max-w-4xl max-h-[80vh]">
                                                <DialogHeader>
                                                  <DialogTitle>Edit Description</DialogTitle>
                                                </DialogHeader>
                                                <div className="mt-4">
                                                  <Textarea
                                                    rows={20}
                                                    className="min-h-[400px] resize-none"
                                                    value={expandedField?.name === "description" ? expandedField.value : data.description ?? ""}
                                                    onChange={(e) => {
                                                      const newValue = e.target.value;
                                                      setExpandedField(prev =>
                                                        prev?.name === "description"
                                                          ? { ...prev, value: newValue }
                                                          : prev
                                                      );
                                                      setData({
                                                        ...data,
                                                        description: newValue,
                                                      });
                                                    }}
                                                  />
                                                </div>
                                              </DialogContent>
                                            </Dialog>
                                          </div>
                                        </FormControl>
                                        <FormMessage />
                                      </>
                                    )}
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                          </TableRow>

                          <TableRow key={"externalId"}>
                            <TableCell className="font-medium capitalize">
                              External ID
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control}
                                name="external_id"
                                render={({ field }) => (
                                  <FormItem>
                                    {!editing ? (
                                      <div
                                        onClick={async () => {
                                          await navigator.clipboard.writeText(
                                            data.external_id ?? "",
                                          );
                                          toast({ title: "Copied to clipboard" });
                                        }}
                                        className="flex-1 whitespace-pre-wrap text-sm cursor-copy"
                                      >
                                        {data.external_id ?? ""}
                                      </div>
                                    ) : (
                                      <>
                                        <FormControl>
                                          <Input
                                            type="text"
                                            disabled={!editing}
                                            onChange={(e) => {
                                              setData({
                                                ...data,
                                                external_id: e.target.value,
                                              });
                                            }}
                                            placeholder="xxxx-xxxx-xxxx-xxxx"
                                            value={data.externalId ?? ""}
                                          />
                                        </FormControl>

                                        <FormMessage />
                                      </>
                                    )}
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                          </TableRow>

                          {/* todo: add fixed  fields for "file" which can be a pdf, image, word doc etc...*/}

                          {context?.fields?.length &&
                            context.fields.map(
                              (
                                contextField,
                                index: number,
                              ) => {
                                return (
                                  <TableRow key={index}>
                                    <TableCell className="font-medium capitalize">
                                      {contextField.label}
                                    </TableCell>
                                    {!editing ? (
                                      <TableCell>
                                        {
                                          <span>
                                            {contextField.type === "code" && (
                                              <CodePreview
                                                code={data[contextField.name]}
                                              />
                                            )}
                                            {contextField.type === "json" && (
                                              <CodePreview
                                                code={data[contextField.name]}
                                              />
                                            )}
                                            {contextField.type === "shortText" && (
                                              <p
                                                className="cursor-copy"
                                                onClick={async () => {
                                                  await navigator.clipboard.writeText(
                                                    data[contextField.name],
                                                  );
                                                  toast({
                                                    title: "Copied to clipboard",
                                                  });
                                                }}
                                              >
                                                {data[contextField.name]}
                                              </p>
                                            )}
                                            {contextField.type === "longText" && (
                                              <TextPreview
                                                text={data[contextField.name]}
                                              />
                                            )}
                                            {!contextField.type && (
                                              <TextPreview
                                                text={data[contextField.name]}
                                              />
                                            )}
                                            {contextField.type === "text" && (
                                              <TextPreview
                                                text={data[contextField.name]}
                                              />
                                            )}
                                            {contextField.type === "number" && (
                                              <p
                                                className="cursor-copy"
                                                onClick={async () => {
                                                  await navigator.clipboard.writeText(
                                                    data[contextField.name],
                                                  );
                                                  toast({
                                                    title: "Copied to clipboard",
                                                  });
                                                }}
                                              >
                                                {data[contextField.name]}
                                              </p>
                                            )}
                                            {contextField.type === "boolean" && (
                                              <p
                                                className="cursor-copy"
                                                onClick={async () => {
                                                  await navigator.clipboard.writeText(
                                                    data[contextField.name],
                                                  );
                                                  toast({
                                                    title: "Copied to clipboard",
                                                  });
                                                }}
                                              >
                                                {data[contextField.name] ?? ""}
                                              </p>
                                            )}
                                          </span>
                                        }
                                      </TableCell>
                                    ) : (
                                      <>
                                        <TableCell>
                                          {contextField.type === "code" ||
                                            contextField.type === "json" ||
                                            contextField.type === "text" ||
                                            contextField.type === "longText" ||
                                            contextField.type === "shortText" ? (
                                            <FormField
                                              control={form.control}
                                              name={contextField.name as keyof ItemFormValues}
                                              render={({ field }) => (
                                                <FormItem>
                                                  <FormControl>
                                                    <div className="relative">
                                                      <Textarea
                                                        id={contextField.name}
                                                        rows={
                                                          contextField.type ===
                                                            "shortText"
                                                            ? 2
                                                            : 7
                                                        }
                                                        onChange={(e) => {
                                                          setData({
                                                            ...data,
                                                            [contextField.name]: e.target.value,
                                                          });
                                                        }}
                                                        value={
                                                          data[contextField.name] ?? ""
                                                        }
                                                      />
                                                      <Dialog>
                                                        <DialogTrigger asChild>
                                                          <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="absolute top-2 right-2 h-6 w-6 p-0"
                                                            onClick={() => setExpandedField({
                                                              name: contextField.name,
                                                              value: data[contextField.name] ?? ""
                                                            })}
                                                          >
                                                            <Expand className="h-3 w-3" />
                                                            <span className="sr-only">Expand</span>
                                                          </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="max-w-4xl max-h-[80vh]">
                                                          <DialogHeader>
                                                            <DialogTitle>Edit {contextField.name}</DialogTitle>
                                                          </DialogHeader>
                                                          <div className="mt-4">
                                                            <Textarea
                                                              rows={20}
                                                              className="min-h-[400px] resize-none"
                                                              value={expandedField?.name === contextField.name ? expandedField.value : data[contextField.name] ?? ""}
                                                              onChange={(e) => {
                                                                const newValue = e.target.value;
                                                                setExpandedField(prev =>
                                                                  prev?.name === contextField.name
                                                                    ? { ...prev, value: newValue }
                                                                    : prev
                                                                );
                                                                setData({
                                                                  ...data,
                                                                  [contextField.name]: newValue,
                                                                });
                                                              }}
                                                            />
                                                          </div>
                                                        </DialogContent>
                                                      </Dialog>
                                                    </div>
                                                  </FormControl>
                                                  <FormMessage />
                                                </FormItem>
                                              )}
                                            />
                                          ) : null}

                                          {contextField.type === "number" ? (
                                            <FormField
                                              control={form.control}
                                              name={contextField.name as keyof ItemFormValues}
                                              render={({ field }) => (
                                                <FormItem>
                                                  <FormControl>
                                                    <Input
                                                      id={contextField.name}
                                                      type="number"
                                                      onChange={(e) => {
                                                        setData({
                                                          ...data,
                                                          [contextField.name]: e.target.value,
                                                        });
                                                      }}
                                                      value={
                                                        data[contextField.name] ?? ""
                                                      }
                                                    />
                                                  </FormControl>
                                                  <FormMessage />
                                                </FormItem>
                                              )}
                                            />
                                          ) : null}

                                          {contextField.type === "boolean" ? (
                                            <FormField
                                              control={form.control}
                                              name={contextField.name as keyof ItemFormValues}
                                              render={({ field }) => (
                                                <FormItem>
                                                  <FormControl>
                                                    <Switch
                                                      checked={!!field.value}
                                                      onCheckedChange={(
                                                        value,
                                                      ) => {
                                                        setData({
                                                          ...data,
                                                          [contextField.name]: value,
                                                        });
                                                      }}
                                                    />
                                                  </FormControl>
                                                  <FormMessage />
                                                </FormItem>
                                              )}
                                            />
                                          ) : null}
                                        </TableCell>
                                      </>
                                    )}
                                  </TableRow>
                                );
                              },
                            )}
                        </TableBody>
                      </Table>

                      <Separator className="my-4" />
                    </div>
                  </form>
                </Form>
                <Card className="bg-transparent">
                  <Collapsible>
                    <CardHeader className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <p className="text-base">
                            Access Control
                          </p>
                          <p className="text-sm text-muted-foreground mb-0">
                            Control access to this item.
                          </p>
                        </div>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <ChevronsUpDown className="size-4" />
                            <span className="sr-only">Toggle</span>
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </CardHeader>
                    <CollapsibleContent className="mt-5">
                      <CardContent className="space-y-4">
                        <RBACControl
                          initialRightsMode={data.rights_mode}
                          initialUsers={data.RBAC?.users}
                          initialRoles={data.RBAC?.roles}
                          onChange={(rights_mode, users, roles) => {
                            setRbac({
                              rights_mode,
                              users,
                              roles
                            })
                          }}
                        />
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>


                <div className="mt-4 border border p-3 pb-5 rounded">
                  <div className="flex items-center justify-between ml-4 mt-3 mr-4 mb-2">
                    <h1 className="text-lg font-medium">Embeddings</h1>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setConfirmationModal("generate")}>
                          Generate embeddings
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setConfirmationModal("delete")}>
                          Delete embeddings
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <Table>
                    <TableCaption>
                      A list of all embeddings for this item.
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Index</TableHead>
                        <TableHead>Content</TableHead>
                        <TableHead>Dimensions</TableHead>
                        <TableHead>Created At</TableHead>
                        <TableHead>Updated At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {
                        !data?.chunks?.length ? (
                          <TableRow>
                            <TableCell colSpan={5}>
                              No chunks found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          data?.chunks?.length && data.chunks.map((chunk) => (
                            <TableRow key={chunk.id}>
                              <TableCell className="font-medium capitalize">
                                {chunk.index + 1}
                              </TableCell>
                              <TableCell>
                                <TextPreview text={chunk.content} />
                              </TableCell>
                              <TableCell>
                                {chunk.embedding_size || 0}
                              </TableCell>
                              <TableCell>
                                {new Date(chunk.createdAt).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                {new Date(chunk.updatedAt).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))
                        )
                      }
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {" "}
          {!data && props.itemId ? (
            <div className="p-8 text-center text-muted-foreground">
              Item not found.
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              No item selected.
            </div>
          )}
        </>
      )
      }

      <AlertDialog open={confirmationModal === "generate"} onOpenChange={(open) => !open && setConfirmationModal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Embeddings</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to generate embeddings for this item? This will create new embedding vectors for the content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={generateChunksMutationResult.loading}
              onClick={() => {
                if (!data?.id) {
                  return;
                }
                console.log("Generate embeddings for item:", data?.id);
                setConfirmationModal(null);
                generateChunksMutation({
                  variables: {
                    where: {
                      id: {
                        eq: data?.id,
                      }
                    },
                  },
                });
              }}>
              Generate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmationModal === "delete"} onOpenChange={(open) => !open && setConfirmationModal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Embeddings</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all embeddings for this item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteChunksMutationResult.loading}
              onClick={async () => {
                if (!data?.id) {
                  return;
                }
                console.log("Delete embeddings for item:", data?.id);
                setConfirmationModal(null);
                deleteChunksMutation({
                  variables: {
                    where: {
                      id: {
                        eq: data?.id,
                      }
                    },
                  },
                });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  );
}