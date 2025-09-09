"use client";

import {
  ApolloClient,
  ApolloLink,
  ApolloProvider,
  HttpLink,
  InMemoryCache,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { SessionProvider } from "next-auth/react";
import * as React from "react";
import { MainNavProvider } from "@/components/custom/main-nav";
import { getToken } from "@/util/api";
import { ConfigContext } from "@/components/config-context";
import { User } from "@/types/models/user";

interface AuthenticatedProps {
  children: React.ReactNode;
  user: User & { role: { id: string } };
  sidebarDefaultOpen: boolean;
}

export const UserContext = React.createContext<any>(null);

const User = ({ children, user, sidebarDefaultOpen }: AuthenticatedProps) => {

  return (
    <UserContext.Provider value={{ user }}>
      <MainNavProvider sidebarDefaultOpen={sidebarDefaultOpen}>
        {children}
      </MainNavProvider>

    </UserContext.Provider>
  );
};
const Authenticated = ({ children, user, sidebarDefaultOpen }: AuthenticatedProps) => {

  const configContext = React.useContext(ConfigContext);

  const uri = configContext?.backend
    ? configContext?.backend + "/graphql"
    : "http://localhost:9001/graphql";

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
    uri: uri,
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
        <User sidebarDefaultOpen={sidebarDefaultOpen} user={user}>
          {children}
        </User>
      </SessionProvider>
    </ApolloProvider>
  );
};

export default Authenticated;
