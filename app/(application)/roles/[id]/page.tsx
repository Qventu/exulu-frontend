"use client";

import { useQuery } from "@apollo/client";
import * as React from "react";
import { GET_USER_ROLE_BY_ID } from "@/queries/queries";
import UserRoleForm from "@/app/(application)/roles/[id]/form";

export const dynamic = "force-dynamic";
export default function Data({ params }) {
  const { loading, data, error } = useQuery(GET_USER_ROLE_BY_ID, {
    fetchPolicy: "cache-first",
    nextFetchPolicy: "network-only",
    variables: {
      id: params.id,
    },
    skip: !params.id,
    pollInterval: 2000,
  });

  if (loading) {
    return "";
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!data?.roleById) {
    return <div>Not found.</div>;
  }

  return <UserRoleForm role={data?.roleById} />;
}
