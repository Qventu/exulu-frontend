import { useInfiniteQuery } from "@tanstack/react-query";
import { Edit, Upload } from "lucide-react";
import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/ui/loading";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UploadActions } from "./upload-actions";

interface UploadProps {
  label?: string;
  splice?: number;
  extensions: string[];
  metaData: Metadata;
  collection: string;
  onUploadComplete?: (file: any) => void;
  onSelect: (file: any) => void;
}

interface Metadata {
  createdAt?: string;
  updatedAt?: string;
  userEmail: string;
  originalFileName?: string;
  userId: string;
  lines?: number;
  query: any[];
}

export function FileUpload(props: UploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    refetch,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: [`files-${JSON.stringify(props.metaData.query)}`],
    queryFn: async ({ pageParam = null }) => {
      // todo get files from MinIO
      return {
        files: [{}],
        nextCursor: "XXXX",
      };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage: any, pages: any) => lastPage.nextCursor,
    enabled: !!props.metaData.query,
  });

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    setFile(file);
  }, []);

  const upload = async () => {
    setUploading(true);
    if (!file) {
      console.error("Missing file.");
      return;
    }

    // todo upload file to Minio
    const result = [""];
    if (props.onUploadComplete) {
      props.onUploadComplete(result[0]);
    }
    if (props.onSelect) {
      props.onSelect(result[0]);
    }
    setSelected(result[0]);
    refetch();
    setUploading(false);
    setSheetOpen(false);
  };

  const [sheetOpen, setSheetOpen] = useState(false);
  const { getRootProps, getInputProps, isDragActive, acceptedFiles } =
    useDropzone({ onDrop });

  const handleNextPage = async () => {
    if (hasNextPage) {
      await fetchNextPage();
      setCurrentPage((prevPage) => prevPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage((prevPage) => prevPage - 1);
    }
  };

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger className="w-full text-left">
        <Label className="text-left" htmlFor={`${props.label || "upload"}`}>
          {props.label}
        </Label>
        <div
          className="rounded border cursor-pointer p-2"
          id={`${props.label}`}
        >
          {!selected ? (
            <Button type="button" variant="ghost">
              Upload {props.label || ""}{" "}
              <Upload className="size-4 ml-2 opacity-50" />
            </Button>
          ) : (
            <Button type="button" variant="default">
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      {selected.metadata.originalFileName?.slice(
                        0,
                        props.splice || 25,
                      ) || selected.filename?.slice(0, props.splice || 25)}
                      {(selected.metadata.originalFileName &&
                        selected.metadata.originalFileName?.length > 25 &&
                        "...") ||
                        (selected.filename &&
                          selected.filename?.length > (props.splice || 25) &&
                          "...")}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {selected.metadata.originalFileName || selected.filename}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Edit className="size-4 ml-2 opacity-50" />
            </Button>
          )}
        </div>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Media</SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          <div
            {...getRootProps()}
            className="border-dashed border-gray-200 border rounded-lg w-full p-6 flex items-center justify-center"
          >
            <input disabled={uploading} {...getInputProps()} />
            {!file ? (
              isDragActive ? (
                <p>Yes, drop the file here 🫳 ...</p>
              ) : (
                <div>
                  <p>Drag 'n' drop, or click to select a file.</p>
                  <div className="space-x-2 flex my-2">
                    {props.extensions?.length ? (
                      props.extensions?.map((ext) => (
                        <Badge variant={"outline"}>{ext}</Badge>
                      ))
                    ) : (
                      <Badge variant={"outline"}>No file types enabled.</Badge>
                    )}
                  </div>
                </div>
              )
            ) : (
              <p>{file.name}</p>
            )}
          </div>

          <Button onClick={upload} disabled={!file || uploading} size="sm">
            Upload {uploading && <Loading />}
          </Button>

          {data?.pages[currentPage]?.files ? (
            <div>
              <div className="w-full mx-auto py-6">
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Library</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.pages[currentPage]?.files?.map((file, index) => (
                        <TableRow>
                          {/*
                          TODO
                          <TableCell
                            className="cursor-pointer"
                            onClick={() => {
                              if (props.onSelect) {
                                props.onSelect(file);
                              }
                              setSelected(file);
                            }}
                          >
                            <small className="text-gray-500 dark:text-gray-400 text-sm">
                              {format(file.uploadDate, "PPP H:mm")}
                              <Badge variant={"outline"}>
                                {file.metadata.type.split("/").pop()}
                              </Badge>
                            </small>
                            <TooltipProvider delayDuration={0}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    {file.filename.slice(0, 25)}
                                    {file.filename?.length > 25 && "..."}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>{file.filename}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>*/}
                          <TableCell>
                            <div>
                              <UploadActions
                                file={file}
                                reload={() => {
                                  refetch();
                                }}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex center mx-auto mt-3 space-x-2">
                  <Button
                    variant={"outline"}
                    onClick={handlePreviousPage}
                    disabled={currentPage === 0}
                  >
                    Previous Page
                  </Button>
                  <Button
                    variant={"outline"}
                    onClick={handleNextPage}
                    disabled={!hasNextPage || isFetchingNextPage}
                  >
                    Next Page
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default FileUpload;
