import { contexts } from "@/util/api";
import { useQuery } from "@tanstack/react-query";

export const useContexts = () => {
    return useQuery({
        queryKey: ["contexts"],
        queryFn: async () => {
            const response = await contexts.get(null, 20);
            const json = await response.json();
            console.log("[EXULU] Contexts fetched", json);
            return json;
        },
        staleTime: 1000 * 60 * 5,
        refetchInterval: 1000 * 60 * 5,
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        refetchOnReconnect: true,
    })
};