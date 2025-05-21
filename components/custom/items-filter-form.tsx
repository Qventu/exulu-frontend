import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { ArrowUpFromDotIcon, Edit } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as React from "react";
import { Item } from "@EXULU_SHARED/models/item";
import { items } from "@/util/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loading } from "@/components/ui/loading";
import useItemCount from "@/hooks/items-count";
import { cn } from "@/lib/utils";
import { TextPreview } from "@/components/custom/text-preview";
import dynamic from "next/dynamic"
import QueryExamples from "@/components/custom/query-examples";
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false })

export const ItemsFilterForm = function ({
  context,
  editing: initEditing,
  preview,
  submit,
  onUpdate,
  init,
  auto,
  hideCollapse,
  folder,
  archived,
  parallel,
}: {
  context: string;
  editing: boolean;
  submit: boolean;
  auto: boolean;
  folder?: string;
  archived: boolean;
  parallel: boolean;
  hideCollapse?: boolean;
  preview: boolean;
  init?: string;
  onUpdate: ({
    base: { },
    decorated: { }
  }: {
    base: {}
    decorated: {}
  }) => void;
}) {

  const [editing, setEditing] = useState(initEditing);
  const editorRef = useRef<any>(null)

  const decorateQuery = (query) => {
    if (
      folder !== "archived" &&
      folder !== "all"
    ) {
      if (query?.$and) {
        query.$and.push({ folder: { $eq: folder } })
      } else {
        query["folder"] = folder;
      }
    }
    if (archived || folder === "archived") {
      if (query?.$and) {
        query.$and.push({ archived: true })
      } else {
        query["archived"] = true;
      }
    } else {
      if (query?.$and) {
        query.$and.push({ archived: { $ne: true } })
      } else {
        query["archived"] = { $ne: true }
      }
    }
    return query;
  }

  const preloadedBaseQuery: {} = init && typeof init === "string"
    ? JSON.parse(init)
    : init && typeof init !== "string"
      ? init : {}

  const preloadedDecoratedQuery = decorateQuery(preloadedBaseQuery)

  let [query, setQuery] = useState<{
    base: {},
    decorated: {}
  }>({
    base: preloadedBaseQuery,
    decorated: preloadedDecoratedQuery
  });

  let [filterCount, setFilterCount] = useState<number>();

  const itemsData = useQuery<{
    pageInfo: {
      pageCount: number;
      itemCount: number;
      currentPage: number | null;
      hasPreviousPage: number | null;
      hasNextPage: number | null;
    };
    items: Item[];
  }>({
    queryKey: ["items", JSON.stringify(query.decorated)],
    queryFn: async () => {
      const response = await items.list({
        context: context
      }, 1, 4);
      const data = await response.json();
      return data.success;
    },
  });

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor

    // Register MongoDB keywords for autocomplete
    monaco.languages.registerCompletionItemProvider("json", {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position)
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        }

        // MongoDB operators and keywords
        const suggestions = [
          // MongoDB query operators
          {
            label: "$eq",
            kind: monaco.languages.CompletionItemKind.Operator,
            insertText: "$eq: ",
            documentation: "Matches values that are equal to a specified value.",
          },
          {
            label: "$gt",
            kind: monaco.languages.CompletionItemKind.Operator,
            insertText: "$gt: ",
            documentation: "Matches values that are greater than a specified value.",
          },
          {
            label: "$gte",
            kind: monaco.languages.CompletionItemKind.Operator,
            insertText: "$gte: ",
            documentation: "Matches values that are greater than or equal to a specified value.",
          },
          {
            label: "$in",
            kind: monaco.languages.CompletionItemKind.Operator,
            insertText: "$in: []",
            documentation: "Matches any of the values specified in an array.",
          },
          {
            label: "$lt",
            kind: monaco.languages.CompletionItemKind.Operator,
            insertText: "$lt: ",
            documentation: "Matches values that are less than a specified value.",
          },
          {
            label: "$lte",
            kind: monaco.languages.CompletionItemKind.Operator,
            insertText: "$lte: ",
            documentation: "Matches values that are less than or equal to a specified value.",
          },
          {
            label: "$ne",
            kind: monaco.languages.CompletionItemKind.Operator,
            insertText: "$ne: ",
            documentation: "Matches values that are not equal to a specified value.",
          },
          {
            label: "$nin",
            kind: monaco.languages.CompletionItemKind.Operator,
            insertText: "$nin: []",
            documentation: "Matches none of the values specified in an array.",
          },

          // Logical operators
          {
            label: "$and",
            kind: monaco.languages.CompletionItemKind.Operator,
            insertText: "$and: []",
            documentation: "Joins query clauses with a logical AND.",
          },
          {
            label: "$not",
            kind: monaco.languages.CompletionItemKind.Operator,
            insertText: "$not: {}",
            documentation: "Inverts the effect of a query expression.",
          },
          {
            label: "$nor",
            kind: monaco.languages.CompletionItemKind.Operator,
            insertText: "$nor: []",
            documentation: "Joins query clauses with a logical NOR.",
          },
          {
            label: "$or",
            kind: monaco.languages.CompletionItemKind.Operator,
            insertText: "$or: []",
            documentation: "Joins query clauses with a logical OR.",
          },

          // Element operators
          {
            label: "$exists",
            kind: monaco.languages.CompletionItemKind.Operator,
            insertText: "$exists: true",
            documentation: "Matches documents that have the specified field.",
          },
          {
            label: "$type",
            kind: monaco.languages.CompletionItemKind.Operator,
            insertText: '$type: "string"',
            documentation: "Selects documents if a field is of the specified type.",
          },

          // Array operators
          {
            label: "$all",
            kind: monaco.languages.CompletionItemKind.Operator,
            insertText: "$all: []",
            documentation: "Matches arrays that contain all elements specified in the query.",
          },
          {
            label: "$elemMatch",
            kind: monaco.languages.CompletionItemKind.Operator,
            insertText: "$elemMatch: {}",
            documentation: "Selects documents if element in the array field matches all the specified conditions.",
          },
          {
            label: "$size",
            kind: monaco.languages.CompletionItemKind.Operator,
            insertText: "$size: 1",
            documentation: "Selects documents if the array field is a specified size.",
          },

          // MongoDB commands
          {
            label: "find",
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: '"find": "collection"',
            documentation: "Selects documents in a collection.",
          },
          {
            label: "filter",
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: '"filter": {}',
            documentation: "Specifies selection filter using query operators.",
          },
          {
            label: "limit",
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: '"limit": 10',
            documentation: "Specifies the maximum number of documents to return.",
          },
          {
            label: "sort",
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: '"sort": {}',
            documentation: "Specifies the order in which the query returns matching documents.",
          },
          {
            label: "skip",
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: '"skip": 0',
            documentation: "Skips the specified number of documents.",
          },
          {
            label: "projection",
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: '"projection": {}',
            documentation: "Specifies the fields to return.",
          },

          // Aggregation pipeline stages
          {
            label: "$match",
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: "$match: {}",
            documentation: "Filters the documents to pass only those that match the specified condition(s).",
          },
          {
            label: "$group",
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: "$group: { id: null }",
            documentation: "Groups documents by the specified expression.",
          },
          {
            label: "$sort",
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: "$sort: {}",
            documentation: "Sorts all input documents and returns them in a specified order.",
          },
          {
            label: "$limit",
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: "$limit: 10",
            documentation: "Limits the number of documents passed to the next stage.",
          },
          {
            label: "$skip",
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: "$skip: 5",
            documentation: "Skips the specified number of documents and passes the remaining documents.",
          },
          {
            label: "$project",
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: "$project: {}",
            documentation: "Reshapes each document, such as by adding new fields or removing existing fields.",
          },
        ]

        return {
          suggestions: suggestions.map((item) => ({
            ...item,
            range,
          })),
        }
      },
    })

    // Add JSON schema validation
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [
        {
          schema: {
            type: "object",
            properties: {
              find: { type: "string" },
              filter: { type: "object" },
              limit: { type: "number" },
              sort: { type: "object" },
              skip: { type: "number" },
              projection: { type: "object" },
            },
          },
        },
      ],
    })
  }

  const itemsCount = useItemCount(query);

  const parseQuery = (query: string) => {
    query = query.replace(/([{,])\s*([^"\s][^:]*?)\s*:/g, '$1"$2":');
    return query?.length ? JSON.parse(query) : {};
  }

  const onSubmit = () => {
    const currentQuery = parseQuery(editorRef.current.getValue())
    const decoratedQuery = decorateQuery(currentQuery)
    setQuery({
      base: currentQuery,
      decorated: decoratedQuery
    })
    console.log('decoratedQuery', decoratedQuery)
    console.log('currentQuery', currentQuery)
    itemsCount.refetch(decoratedQuery);
    itemsData.refetch();
    onUpdate &&
      onUpdate({
        base: currentQuery,
        decorated: decoratedQuery,
      })
  };

  const onRefresh = () => {
    const currentQuery = parseQuery(editorRef.current.getValue())
    const decoratedQuery = decorateQuery(currentQuery)
    setQuery({
      base: currentQuery,
      decorated: decoratedQuery
    })
    itemsCount.refetch(decoratedQuery);
    itemsData.refetch();
  };

  useEffect(() => {
    setFilterCount(Object.keys(query)?.length);
  }, [query]);

  return (
      <div
        key={`form-key`}
        className={cn("space-y-4", parallel ? "flex" : "")}
      >
        {!hideCollapse && (
          <div
            onClick={() => {
              setEditing(!editing);
              if (auto) {
                onSubmit();
              }
            }}
            className="flex hover:bg-muted border hover:border-primary rounded cursor-pointer py-3"
            key={`form-div-key-not-editing`}
          >
            {editing ? (
              <small className="text-sm mx-auto flex">
                {auto ? <p>Confirm</p> : <ArrowUpFromDotIcon />}
              </small>
            ) : (
              <small className="text-sm mx-auto flex">
                Applied {filterCount || 0} filters
                <Edit className="ml-2" size="18" />
              </small>
            )}
          </div>
        )}

        <Card
          className={cn(
            "border-0 rounded-none overflow-y-auto",
            parallel
              ? "border-none pl-1 pr-5 max-h-[800px] w-1/2 pb-5"
              : "max-h-[500px]",
          )}
        >
          <CardHeader className="px-0">
            <div className="flex">
              <CardTitle className="text-lg my-auto">
                Set your filters here
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2 px-0">

            <QueryExamples />

            <div className="flex-1 flex flex-col min-h-[200px] overflow-hidden">
              <div className="flex-1 overflow-hidden border rounded-md">
                <MonacoEditor
                  height="100%"
                  defaultLanguage="json"
                  defaultValue={JSON.stringify(query.base)}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    tabSize: 2,
                    automaticLayout: true,
                    formatOnPaste: true,
                    formatOnType: true,
                    scrollbar: {
                      useShadows: false,
                      verticalScrollbarSize: 10,
                      horizontalScrollbarSize: 10,
                    },
                  }}
                  onMount={handleEditorDidMount}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Optional: Enter MongoDB query filters in JSON
                format.</p>
            </div>

            {submit && (
              <div>
                {preview && (
                  <Button
                    disabled={itemsCount.loading || itemsData.isLoading}
                    className="my-auto mr-2"
                    onClick={onRefresh}
                    size="sm"
                    variant="outline"
                    type="button"
                  >
                    Refresh results{" "}
                    {(itemsData?.isLoading || itemsCount?.loading) && (
                      <Loading className="ml-1" />
                    )}
                  </Button>
                )}

                <Button
                  disabled={itemsCount.loading || itemsData.isLoading}
                  className="my-auto"
                  onClick={onSubmit}
                  size="sm"
                  variant="outline"
                  type="button"
                >
                  Submit filters{" "}
                  {(itemsData?.isLoading || itemsCount?.loading) && (
                    <Loading className="ml-1" />
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {preview && (
          <Card
            className={cn(
              "border-0 rounded-none",
              parallel ? "border-none px-5 mt-0 w-1/2" : "border-t-2",
            )}
          >
            <CardHeader className="px-0 pt-0">
              <div className="flex">
                <CardTitle className="text-lg my-auto">
                  Item results for filters ( total {itemsCount?.data || 0} )
                </CardTitle>
                {/*<Button className="ml-2" variant={'outline'}>
                            Save as custom view
                        </Button>*/}
              </div>
            </CardHeader>
            {preview && (
              <CardContent className="grid gap-4 px-0">
                {itemsData?.isLoading ? (
                  <p>Loading...</p>
                ) : itemsData?.error ? (
                  <p>Error...</p>
                ) : itemsData.data?.items?.length ? (
                  itemsData.data?.items?.map((item) => {
                    return (
                      <Card key={`item-${item.id}`}>
                        <CardHeader>
                          <CardTitle>
                            {item.name ? (
                              <>
                                <p className="font-medium text-sm leading-none">
                                  {item.name?.slice(0, 80)}
                                </p>
                              </>
                            ) : (
                              <h4 className="text-base text-sm">{item.id}</h4>
                            )}
                          </CardTitle>
                          <CardContent className="p-0">
                            <TextPreview
                              sliceLength={50}
                              text={item.text?.slice(0, 150)}
                            />
                          </CardContent>
                          <CardFooter className="px-0 pb-0 pt-2">
                            {item.tags?.length && (
                              <div className="flex space-x-2">
                                {item.tags?.map((tag) => (
                                  <Badge className="mr-2" variant={"outline"}>
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <small className="text-gray-500 my-auto text-sm ml-2">
                              {" "}
                              {item.updatedAt
                                ? formatDistanceToNow(
                                  new Date(item.updatedAt),
                                  {
                                    addSuffix: true,
                                  },
                                )
                                : null}
                            </small>
                          </CardFooter>
                        </CardHeader>
                      </Card>
                    );
                  })
                ) : (
                  <small>No items found.</small>
                )}
              </CardContent>
            )}
          </Card>
        )}
      </div>
  );
};
