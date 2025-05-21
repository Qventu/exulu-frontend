"use client";

import {
  ApolloClient,
  ApolloLink,
  ApolloProvider,
  HttpLink,
  InMemoryCache,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import Link from "next/link";
import { SessionProvider } from "next-auth/react";
import * as React from "react";
import { MainNav } from "@/components/custom/main-nav";
import { buttonVariants } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { getToken } from "@/util/api";

interface AuthenticatedProps {
  children: React.ReactNode;
  user: any;
}

const uri = process.env.NEXT_PUBLIC_GRAPHQL_SERVER
  ? process.env.NEXT_PUBLIC_GRAPHQL_SERVER
  : "http://localhost:9001/graphql";
export const UserContext = React.createContext<any>(null);

const User = ({ children, user }: AuthenticatedProps) => {

  return (
    <UserContext.Provider value={{ user }}>
      <div className="border-b">
        <div className="flex h-16 items-center px-4">
          {/*<Link href="/" className="flex items-center h-20 gap-2 sm:gap-4">
            <Image
              src="/exulu_logo.svg"
              alt="Exulu Logo"
              width={50}
              height={32}
              className="invert dark:invert-0"
              priority
            />
          </Link>*/}
          <MainNav className="mx-6" />
          <div className="ml-auto flex items-center space-x-4">
            <Link
              href="/api/auth/signout"
              className={buttonVariants({ variant: "outline" })}
            >
              Logout
            </Link>
            <ModeToggle></ModeToggle>
          </div>
        </div>
      </div>
      {children}
    </UserContext.Provider>
  );
};
const Authenticated = ({ children, user}: AuthenticatedProps) => {
  const basic = setContext((operation, context) => ({
    headers: {
      Accept: "charset=utf-8",
    },
  }));

  const authLink = setContext(async (operation, context) => {
    const token = await getToken();
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  });

  const link = ApolloLink.from([basic, authLink, new HttpLink({ uri: uri })]);

  const client = new ApolloClient({
    uri: process.env.NEXT_PUBLIC_GRAPHQL_SERVER
      ? process.env.NEXT_PUBLIC_GRAPHQL_SERVER
      : "http://localhost:9001/graphql", // can't move to environment vars because they are not compiled to client side
    cache: new InMemoryCache({
      addTypename: false,
    }),
    link: link,
    defaultOptions: {
      watchQuery: {
        fetchPolicy: "no-cache",
        errorPolicy: "ignore",
      },
      query: {
        fetchPolicy: "no-cache",
        errorPolicy: "all",
      },
    },
  });

  return (
    <ApolloProvider client={client}>
      <SessionProvider>
        <User user={user}>
          {children}
        </User>
      </SessionProvider>
    </ApolloProvider>
  );
};

export default Authenticated;
