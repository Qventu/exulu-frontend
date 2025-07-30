import { STATISTICS_TYPE } from "@EXULU_SHARED/enums/statistics";
import { getSession } from "next-auth/react";

export const uris = {
    langfuse:
        process.env.NEXT_PUBLIC_LANGFUSE_URI ? process.env.NEXT_PUBLIC_LANGFUSE_URI + "/api" : null,
    agents:
        process.env.NEXT_PUBLIC_BACKEND + "/agents",
    providers:
        process.env.NEXT_PUBLIC_BACKEND + "/providers",
    tools:
        process.env.NEXT_PUBLIC_BACKEND + "/tools",
    contexts:
        process.env.NEXT_PUBLIC_BACKEND + "/contexts",
    workflows:
        process.env.NEXT_PUBLIC_BACKEND + "/workflows",
    statistics:
        process.env.NEXT_PUBLIC_BACKEND + "/statistics",
    items:
        process.env.NEXT_PUBLIC_BACKEND + "/items",
    export:
        process.env.NEXT_PUBLIC_HOST + "/api/export",
    files:
        process.env.NEXT_PUBLIC_BACKEND
};

export const getToken = async () => {
    const session = await getSession()
    // @ts-ignore
    return session?.user?.jwt;
}

export const statistics = {
    get: {
        timeseries: async (parameters: {
            type: STATISTICS_TYPE;
            from: Date;
            to: Date;
        }) => {
            const url = `${uris.statistics}/timeseries`;
    
            const token = await getToken()
    
            if (!token) {
                throw new Error("No valid session token available.")
            }
    
            return fetch(url, {
                method: "POST",
                body: JSON.stringify({
                    type: parameters.type,
                    from: parameters.from,
                    to: parameters.to,
                }),
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });
        },
        totals: async (parameters: {
            type: STATISTICS_TYPE;
            from: Date;
            to: Date;
        }) => {
            const url = `${uris.statistics}/totals`;

            const token = await getToken()

            if (!token) {
                throw new Error("No valid session token available.")
            }

            return fetch(url, {
                method: "POST",
                body: JSON.stringify({
                    type: parameters.type,
                    from: parameters.from,
                    to: parameters.to,
                }),
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });
        }
    }
};

export const agents = {
    get: async (parameters: {
        id?: string
    } | null, limit: number = 20): Promise<any> => {

        let url = `${uris.agents}`;

        if (parameters?.id) {
            url += `/${parameters.id}`
        }

        const token = await getToken()

        if (!token) {
            throw new Error("No valid session token available.")
        }

        return fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });
    },
};

export const providers = {
    get: async (limit: number = 20): Promise<any> => {

        let url = `${uris.providers}`;
        const token = await getToken()

        if (!token) {
            throw new Error("No valid session token available.")
        }

        return fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });
    },
};

export const tools = {
    get: async (parameters: {
        id?: string
    } | null) => {
        let url = `${uris.tools}`;

        if (parameters?.id) {
            url += `/${parameters.id}`
        }

        const token = await getToken()

        if (!token) {
            throw new Error("No valid session token available.")
        }

        return fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });
    }
}

export const contexts = {
    get: async (parameters: {
        id?: string
    } | null, limit: number = 20): Promise<any> => {

        let url = `${uris.contexts}`

        if (parameters?.id) {
            url = `${url}/${parameters.id}`
        }

        const token = await getToken()

        if (!token) {
            throw new Error("No valid session token available.")
        }

        return fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });
    },
    statistics: async () => {
        const url = `${uris.contexts}/statistics`;

        const token = await getToken()

        if (!token) {
            throw new Error("No valid session token available.")
        }

        return fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });
    }   
};

export const files = {
    list: async(prefix: string) => {
        let url = `${uris.files}/s3/list?prefix=${prefix}`;

        const token = await getToken()

        if (!token) {
            throw new Error("No valid session token available.")
        }

        return fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                Session: localStorage.getItem("session") ?? "",
            },
        });
    },
    download: async(key: string) => {
        let url = `${uris.files}/s3/download?key=${key}`;

        const token = await getToken()

        if (!token) {
            throw new Error("No valid session token available.")
        }

        return fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });
    }
}

export const workflows = {
    get: async (parameters: {
        id?: string
    } | null, limit: number = 20): Promise<any> => {

        let url = `${uris.workflows}${ parameters?.id ? "/" + parameters.id : ""}`;

        const token = await getToken()

        return fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });
    },
    run: async (slug: string, parameters: {
        inputs: {}
        agent: string
        label: string
        session: string
    }): Promise<any> => {

        const url = `${process.env.NEXT_PUBLIC_BACKEND}${slug}`;

        const token = await getToken()
        return fetch(url, {
            method: "POST",
            body: JSON.stringify(parameters),
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });
    },
};

export const items = {
    list: async (parameters: {
        context: string
        name?: string
        archived?: boolean
        sort?: "created_at" | "embeddings_updated_at"
        order?: "desc" | "asc"
    } | null, page: number = 1, limit: number = 20): Promise<any> => {
        const url = new URL(`${uris.items}/${parameters?.context}`);

        const token = await getToken()

        if (!token) {
            throw new Error("No valid session token available.")
        }

        if (parameters?.archived) {
            url.searchParams.set("archived", "true");
        }

        if (parameters?.name) {
            url.searchParams.set("name", parameters.name);
        }

        if (parameters?.sort) {
            url.searchParams.set("sort", parameters.sort);
        }

        if (parameters?.order) {
            url.searchParams.set("order", parameters.order);
        }

        url.searchParams.set("page", page.toString());
        url.searchParams.set("limit", limit.toString());

        return fetch(url.toString(), {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                Session: localStorage.getItem("session") ?? "",
            },
        });
    },
    get: async (parameters: {
        context: string,
        id: string
    } | null): Promise<any> => {
        const url = `${uris.items}/${parameters?.context}/${parameters?.id}`;

        const token = await getToken()

        if (!token) {
            throw new Error("No valid session token available.")
        }
        
        return fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                Session: localStorage.getItem("session") ?? "",
            },
        });
    },
    export: async (parameters: {
        context: string
    } | null): Promise<any> => {
        const url = `${uris.items}/export/${parameters?.context}`;

        const token = await getToken()

        if (!token) {
            throw new Error("No valid session token available.")
        }

        return fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                Session: localStorage.getItem("session") ?? "",
            },
        });
    },
    update: async (parameters: {
        context: string,
        id: string,
        item: Record<string, {
            name?: string
            description?: string
            external_id?: string
            [key: string]: any
        }>
    }): Promise<any> => {
        const url = `${uris.items}/${parameters?.context}/${parameters?.id}`;

        const token = await getToken()

        if (!token) {
            throw new Error("No valid session token available.")
        }

        return fetch(url, {
            method: "POST",
            body: JSON.stringify(parameters?.item),
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                Session: localStorage.getItem("session") ?? "",
            },
        });
    },
    delete: async (parameters: {
        context: string,
        id: string
    } | null): Promise<any> => {    
        const url = `${uris.items}/${parameters?.context}/${parameters?.id}`;

        const token = await getToken()

        if (!token) {
            throw new Error("No valid session token available.")
        }

        return fetch(url, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                Session: localStorage.getItem("session") ?? "",
            },
        });
    },
    create: async (parameters: {
        context: string
        item: Record<string, {
            name?: string
            description?: string
            external_id?: string
            [key: string]: any
        }>
    } | null): Promise<any> => {
        const url = `${uris.items}/${parameters?.context}`;

        const token = await getToken()

        if (!token) {
            throw new Error("No valid session token available.")
        }

        return fetch(url, {
            method: "POST",
            body: JSON.stringify(parameters?.item),
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                Session: localStorage.getItem("session") ?? "",
            },
        });
    }   

}
