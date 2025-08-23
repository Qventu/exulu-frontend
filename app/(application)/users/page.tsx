"use client";

import { useContext } from "react";
import { createColumns } from "./components/columns";
import { DataTable } from "./components/data-table";
import { UserContext } from "@/app/(application)/authenticated";
import { GET_USERS, UPDATE_USER_BY_ID } from "@/queries/queries";
import { useMutation } from "@apollo/client";

export const dynamic = "force-dynamic";

export default function UsersPage() {
  const { user: currentUser } = useContext(UserContext);
  const columns = createColumns(currentUser, (user, role) => {
    console.log("user", user);
    console.log("role", role);
    updateUser({
      variables: {
        id: user.id,
        role,
      },
    });
  });

  const [updateUser, updateUserResult] = useMutation(UPDATE_USER_BY_ID, {
    refetchQueries: [
      GET_USERS, // DocumentNode object parsed with gql
      "GetUsers", // Query name
    ],
  });

  return (
    <>
      <div className="hidden h-full flex-1 flex-col space-y-8 p-8 md:flex">
        <div className="flex items-center justify-between space-y-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Users</h2>
            <p className="text-muted-foreground">
              Here's a list of all the users.
            </p>
          </div>
        </div>
        <DataTable columns={columns} />
      </div>
    </>
  );
}
