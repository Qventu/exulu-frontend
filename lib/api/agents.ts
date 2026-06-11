import { getToken, getUris } from "@/lib/api/client";

export type ImageStyle = "origami" | "anime" | "japanese_anime" | "vaporwave" | "lego" | "paper_cut" | "felt_puppet" | "3d" | "app_icon" | "pixel_art" | "isometric";

export const agentsApi = {
    image: {
        generate: async (parameters: {
            name: string,
            description: string,
            style?: ImageStyle
        }): Promise<any> => {

            const uris = await getUris();
            const url = `${uris.base}/generate/agent/image`;
            const token = await getToken()

            if (!token) {
                throw new Error("No valid session token available.")
            }

            return fetch(url, {
                method: "POST",
                body: JSON.stringify(parameters),
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });
        }
    }
}
