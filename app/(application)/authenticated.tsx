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
import { getToken } from "@/lib/api/client";
import { ConfigContext } from "@/components/config-context";
import { type User } from "@/types/models/user";

interface AuthenticatedProps {
  children: React.ReactNode;
  user: User & { role: { id: string } };
  sidebarDefaultOpen: boolean;
  config: {
    n8n: {
      enabled?: boolean;
      url?: string;
    };
  };
}

export const UserContext = React.createContext<any>(null);

const User = ({ children, user, sidebarDefaultOpen, config }: AuthenticatedProps) => {

  return (
    <UserContext.Provider value={{ user }}>
      <MainNavProvider sidebarDefaultOpen={sidebarDefaultOpen} config={config}>
        {children}
      </MainNavProvider>

    </UserContext.Provider>
  );
};
const Authenticated = ({ children, user, sidebarDefaultOpen, config }: AuthenticatedProps) => {

  const configContext = React.useContext(ConfigContext);

  const uri = configContext?.backend
    ? configContext?.backend + "/graphql"
    : "http://localhost:9001/graphql";

  // Memoized so the client (and its cache) is built once per backend uri
  // instead of on every render. errorPolicy "all" surfaces GraphQL errors to
  // callers via the `error` result field alongside any partial data.
  const client = React.useMemo(() => {
    const basic = setContext(() => ({
      headers: {
        Accept: "charset=utf-8",
      },
    }));

    const authLink = setContext(async () => {
      const token = await getToken();
      return {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
    });

    const link = ApolloLink.from([basic, authLink, new HttpLink({ uri: uri })]);

    return new ApolloClient({
      uri: uri,
      cache: new InMemoryCache({
        addTypename: false,
      }),
      link: link,
      defaultOptions: {
        watchQuery: {
          fetchPolicy: "no-cache",
          errorPolicy: "all",
        },
        query: {
          fetchPolicy: "no-cache",
          errorPolicy: "all",
        },
      },
    });
  }, [uri]);

  return (
    <ApolloProvider client={client}>
      <SessionProvider>
        <User sidebarDefaultOpen={sidebarDefaultOpen} user={user} config={{
          n8n: {
            enabled: config.n8n?.enabled,
            url: config.n8n?.url,
          }
        }}>
          {children}
        </User>
      </SessionProvider>
    </ApolloProvider>
  );
};

export default Authenticated;
