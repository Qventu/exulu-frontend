import { GET_CONTEXTS } from "@/queries/queries";
import { Context } from "@/types/models/context";
import { useQuery } from "@apollo/client";

export const useContexts = () => {
    return useQuery<{ contexts: { items: Context[] } }>(GET_CONTEXTS, {
        variables: {
            limit: 20
        }
    })
};