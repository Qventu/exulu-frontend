import { request } from "@/lib/api/client";
import type { BudgetEntityType, BudgetInfo, BudgetDuration } from "@/lib/budget";

/** How the end-user budget indicator renders: exact USD or percentage only. */
export type UserBudgetDisplay = "amount" | "percent";

export type BudgetSettings = {
    global_user_budget: {
        enabled: boolean;
        max_budget: number;
        budget_duration: BudgetDuration | string;
    };
    show_user_budget_in_chat: boolean;
    user_budget_display: UserBudgetDisplay;
};

export type BulkBudgetResult = {
    entityId: string;
    ok: boolean;
    error?: string;
};

export const budgetsApi = {
    /** Create or update a single entity's budget. */
    upsert: async (
        entityType: BudgetEntityType,
        entityId: string,
        input: { max_budget: number; budget_duration: BudgetDuration | string },
    ): Promise<BudgetInfo | null> => {
        const json = await request(
            `/admin/budgets/${entityType}/${encodeURIComponent(entityId)}`,
            "PUT",
            input,
        );
        return json.budget ?? null;
    },

    /** Apply the same budget value to many entities (each gets its own budget). */
    bulkUpsert: async (
        entityType: BudgetEntityType,
        entityIds: string[],
        input: { max_budget: number; budget_duration: BudgetDuration | string },
    ): Promise<BulkBudgetResult[]> => {
        const json = await request(
            `/admin/budgets/${entityType}/bulk`,
            "PUT",
            { entityIds, ...input },
        );
        return json.results ?? [];
    },

    /** Remove a single entity's budget. */
    remove: async (
        entityType: BudgetEntityType,
        entityId: string,
    ): Promise<void> => {
        await request(
            `/admin/budgets/${entityType}/${encodeURIComponent(entityId)}`,
            "DELETE",
        );
    },

    /** Read the platform budget settings (global default + show-in-chat). */
    getSettings: async (): Promise<BudgetSettings> => {
        const json = await request(`/admin/budgets/settings`, "GET");
        return json.settings;
    },

    /** Write the platform budget settings. */
    saveSettings: async (settings: BudgetSettings): Promise<BudgetSettings> => {
        const json = await request(`/admin/budgets/settings`, "PUT", settings);
        return json.settings;
    },
};
