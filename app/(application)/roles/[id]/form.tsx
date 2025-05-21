"use client";

import { useMutation, useQuery } from "@apollo/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  GET_AGENTS,
  GET_USER_ROLES,
  REMOVE_USER_ROLE_BY_ID,
  UPDATE_USER_ROLE_BY_ID,
} from "@/queries/queries";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { UserRole } from "@EXULU_SHARED/models/user-role";

const accountFormSchema = z.object({
  name: z
    .string()
    .min(2, {
      message: "Name must be at least 2 characters.",
    })
    .max(30, {
      message: "Name must not be longer than 30 characters.",
    }),
  is_admin: z.boolean().nullable().optional(),
  agents: z.array(z.string().nullable().optional()).nullable().optional(),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

export default function UserRoleForm({ role: init }: { role: UserRole }) {

  const [role, setRole] = useState(init);
  const agents = useQuery(GET_AGENTS, {
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
    variables: {
      page: 1,
      limit: 200,
      filters: {},
    },
  });

  const [updateUserRole, updateUserRoleResult] = useMutation(
    UPDATE_USER_ROLE_BY_ID,
    {
      refetchQueries: [
        GET_USER_ROLES, // DocumentNode object parsed with gql
        "GetUserRoles", // Query name
      ],
    },
  );

  const [removeUserRole, removeUserRoleResult] = useMutation(
    REMOVE_USER_ROLE_BY_ID,
    {
      refetchQueries: [
        GET_USER_ROLES, // DocumentNode object parsed with gql
        "GetUserRoles", // Query name
      ],
    },
  );

  const router = useRouter();
  const { toast } = useToast();
  console.log("role.agents", role.agents);

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: init.name,
      is_admin: init.is_admin,
      agents: init.agents?.map((agent) => agent),
    },
  });

  function onSubmit(data: AccountFormValues) {
    updateUserRole({
      variables: {
        id: role.id,
        ...data,
      },
    });
    toast({
      title: "Updated use role",
    });
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Your name" {...field} />
                </FormControl>
                <FormDescription>
                  This is the name that will be displayed.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <div>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name={`is_admin`}
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Admin</FormLabel>
                      <FormDescription>
                        If this role has admin rights users with that role can
                        see and edit agents and contexts.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-medium">Agents access</h3>
            {agents?.loading && <Loading />}
            {!agents?.loading && agents.data?.agentsPagination?.items ? (
              <>
                {agents.data.agentsPagination.items.map((agent, index) => {
                  return (
                    <div key={index} className="space-y-4 my-3">
                      <FormField
                        control={form.control}
                        name={`agents.${index}`}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                {agent.name}
                              </FormLabel>
                            </div>
                            <FormControl>
                              <Switch
                                checked={form
                                  .getValues("agents")
                                  ?.includes(agent.id)}
                                onCheckedChange={(value) => {
                                  const updatedAgents = value
                                    ? [...(role.agents || []), agent]
                                    : (role.agents || []).filter(
                                        (id) => id !== agent.id,
                                      );
                                  form.setValue(
                                    "agents",
                                    updatedAgents.map((x) => x.id),
                                  );
                                  setRole({
                                    ...role,
                                    agents: updatedAgents,
                                  });
                                }}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  );
                })}
              </>
            ) : null}
            {!agents?.loading &&
            !agents.data.agentsPagination?.items?.length ? (
              <p>No agents found.</p>
            ) : null}
          </div>

          <Button
            onClick={() => {
              router.push("/roles");
            }}
            variant={"outline"}
            className="mr-2"
            type="button"
          >
            Back
          </Button>
          <Button disabled={updateUserRoleResult.loading} type="submit">
            Save {updateUserRoleResult.loading && <Loading />}
          </Button>
        </form>
      </Form>
    </div>
  );
}
