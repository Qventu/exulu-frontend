"use client"

import { useContext, useState } from "react"
import type { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useFieldArray } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent } from "@/components/ui/card"
import { PlusCircle, MinusCircle } from "lucide-react"
import UppyDashboard from "./uppy-dashboard"
import { UserContext } from "@/app/(application)/authenticated"

type ZodFormProps<T extends z.ZodType> = {
    zodSchema: T
    jsonSchema: any
  onSubmit: (values: z.infer<T>) => void
  submitText?: string
  formDescription?: string
  formTitle?: string
  defaultValues?: Partial<z.infer<T>>
}

type ZodFieldTypes = "boolean" | "array" | "enum" | "string" | "number" | "object"

type ZodFieldType = {
    type: ZodFieldTypes
    kind?: "email" | "password"
    description?: string;
    values?: string[]
    isOptional: boolean
    element?: {
        properties: {
            [key: string]: ZodFieldType;
        }
        values?: string[]
        type: ZodFieldTypes
    }
  }

// Helper to parse metadata from describe() JSON string
const parseMetadata = (description?: string) => {
  if (!description) return {}
  try {
    return JSON.parse(description)
  } catch (e) {
    return {}
  }
}

export function ZodFormBuilder<T extends z.ZodType>({
  zodSchema,
  jsonSchema,
  onSubmit,
  submitText = "Submit",
  formDescription,
  formTitle,
  defaultValues = {},
}: ZodFormProps<T>) {

  const [isSubmitting, setIsSubmitting] = useState(false)
  const { user, setUser } = useContext(UserContext);
  // Create form with react-hook-form and zod resolver
  const form = useForm<z.infer<T>>({
    resolver: zodResolver(zodSchema),
    defaultValues: defaultValues as any,
  })

  // Handle form submission
  const handleSubmit = async (values: z.infer<T>) => {
    setIsSubmitting(true)
    try {
      await onSubmit(values)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get the properties from the JSON schema
  const properties = jsonSchema.properties || {}

  console.log("properties", properties)

  return (
    <div className="w-full mx-auto">
      {formTitle && <h2 className="text-2xl font-bold mb-4">{formTitle}</h2>}
      {formDescription && <p className="text-muted-foreground mb-6">{formDescription}</p>}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          
          {
            // @ts-ignore
            Object.entries(properties).map(([name, property]: [string, ZodFieldType]) => {
            const metadata = parseMetadata(property.description)

            console.log("metadata", metadata)
            if (metadata?.isFile) {
              return (
                <FormField
                  key={name}
                  control={form.control}
                  name={name as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{metadata.label || name}</FormLabel>
                      {metadata.description && <FormDescription>{metadata.description}</FormDescription>}
                      <FormControl>
                        <UppyDashboard preselectedFile={field.value} id={field.name} allowedFileTypes={metadata.allowedFileTypes} dependencies={[field.name]} onSelect={(key) => {
                          console.log("[EXULU] selected file", key)
                          field.onChange(key)
                        }} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )
            }

            // Handle array of objects
            if (property.type === "array" && property.element && property.element?.type === "object") {
              return (
                <div key={name} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-base">{metadata.label || name}</FormLabel>
                  </div>

                  {metadata.description && <FormDescription>{metadata.description}</FormDescription>}

                  <ArrayField name={name} schema={property} form={form} />
                </div>
              )
            }

            // Handle array of enums (checkbox group)
            if (property.type === "array" && property.element && property.element?.type === "enum") {
              return (
                <FormField
                  key={name}
                  control={form.control}
                  name={name as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{metadata.label || name}</FormLabel>
                      {metadata.description && <FormDescription>{metadata.description}</FormDescription>}
                      <div className="space-y-2">
                        {property.element?.values?.map((option: string) => {
                          const values: any[] = field.value || []
                          return (
                            <div key={option} className="flex items-center space-x-2">
                              <Checkbox
                                id={`${name}-${option}`}
                                checked={values.includes(option)}
                                onCheckedChange={(checked) => {
                                  const updatedValues = checked
                                    ? [...values, option]
                                    : values.filter((value: string) => value !== option)
                                  field.onChange(updatedValues)
                                }}
                              />
                              <label
                                htmlFor={`${name}-${option}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {option}
                              </label>
                            </div>
                          )
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )
            }

            // Handle regular fields
            return (
              <FormField
                key={name}
                control={form.control}
                name={name as any}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{metadata.label || name}</FormLabel>
                    <FormControl>{renderControl(property, field, metadata, name)}</FormControl>
                    {metadata.description && <FormDescription>{metadata.description}</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )
          })}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : submitText}
          </Button>
        </form>
      </Form>
    </div>
  )
}

// Separate component for array fields to properly use hooks
function ArrayField({ name, schema, form }: { name: string; schema: ZodFieldType; form: any }) {
  const { control } = form
  const fieldArray = useFieldArray({
    control,
    name: name as any,
  })

  const metadata = parseMetadata(schema.description)
  const itemProperties = schema.element?.properties || {}

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          // Create an empty object with the structure matching the schema
          const emptyItem = Object.keys(itemProperties).reduce(
            (acc, key) => {
              acc[key] = ""
              return acc
            },
            {} as Record<string, any>,
          )
          fieldArray.append(emptyItem)
        }}
        className="flex items-center gap-1 mb-4"
      >
        <PlusCircle className="h-4 w-4" />
        Add {metadata.itemLabel || "Item"}
      </Button>

      {fieldArray.fields.map((item, index) => (
        <Card key={item.id} className="p-4 relative mb-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fieldArray.remove(index)}
            className="absolute top-2 right-2 h-8 w-8"
          >
            <MinusCircle className="h-4 w-4" />
          </Button>

          <CardContent className="p-0 pt-4">
            <div className="grid gap-4">
              {Object.entries(itemProperties).map(([propName, propSchema]: [string, any]) => {
                const propMetadata = parseMetadata(propSchema.description)
                const fullPath = `${name}.${index}.${propName}` as const

                return (
                  <FormField
                    key={fullPath}
                    control={control}
                    name={fullPath as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{propMetadata.label || propName}</FormLabel>
                        <FormControl>{renderControl(propSchema, field, propMetadata, propName)}</FormControl>
                        {propMetadata.description && <FormDescription>{propMetadata.description}</FormDescription>}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {fieldArray.fields.length === 0 && (
        <div className="text-center p-4 border border-dashed rounded-md">
          <p className="text-muted-foreground">No items added yet</p>
        </div>
      )}
    </div>
  )
}

// Helper function to render the appropriate control based on the field type
function renderControl(schema: ZodFieldType, field: any, metadata: any, name: string) {

  let fieldType = "text"

  if (metadata.type) {
    fieldType = metadata.type
  } else if (schema.type === "boolean") {
    fieldType = "checkbox"
  } else if (schema.type === "string") {
    if (schema.kind === "email") fieldType = "email"
    else if (schema.kind === "password") fieldType = "password"
    else fieldType = "text"
  } else if (schema.type === "enum") fieldType = "select"

  // Render appropriate control
  switch (fieldType) {
    case "textarea":
      return (
        <Textarea
          {...field}
          placeholder={metadata.placeholder || `Enter ${metadata.label || name}`}
          value={field.value || ""}
        />
      )
    case "select":
      return (
        <Select onValueChange={field.onChange} defaultValue={field.value}>
          <SelectTrigger>
            <SelectValue placeholder={metadata.placeholder || `Select ${metadata.label || name}`} />
          </SelectTrigger>
          <SelectContent>
            {(
              metadata.options ||
              schema.values?.map((value: string) => ({
                label: value,
                value,
              }))
            ).map((option: { label: string; value: string }) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )

    case "checkbox":
      return (
        <div className="flex items-center space-x-2">
          <Checkbox id={name} checked={field.value} onCheckedChange={field.onChange} />
          <label
            htmlFor={name}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {metadata.checkboxLabel || ""}
          </label>
        </div>
      )

    case "switch":
      return <Switch checked={field.value} onCheckedChange={field.onChange} />

    case "radio":
      if (!metadata.options) return <Input {...field} value={field.value || ""} />

      return (
        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
          {metadata.options.map((option: { label: string; value: string }) => (
            <div key={option.value} className="flex items-center space-x-2">
              <RadioGroupItem value={option.value} id={`${name}-${option.value}`} />
              <label htmlFor={`${name}-${option.value}`}>{option.label}</label>
            </div>
          ))}
        </RadioGroup>
      )

    case "email":
      return (
        <Input {...field} type="email" placeholder={metadata.placeholder || "Enter email"} value={field.value || ""} />
      )

    case "password":
      return (
        <Input
          {...field}
          type="password"
          placeholder={metadata.placeholder || "Enter password"}
          value={field.value || ""}
        />
      )

    default:
      return (
        <Input
          {...field}
          placeholder={metadata.placeholder || `Enter ${metadata.label || name}`}
          value={field.value || ""}
        />
      )
  }
}
