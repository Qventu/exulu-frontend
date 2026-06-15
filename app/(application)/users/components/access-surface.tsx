"use client";

/**
 * Access surface — the consolidated /users (Users · Roles · Teams) shell.
 *
 * Design:
 *  - access.md §3: one PageHeader + Tabs ("Users · Roles · Teams") wrapping
 *    the three tab bodies. The active tab is read from `?tab` (defaults to
 *    "users"). Switching tabs uses router.push so back navigates between
 *    tabs. ALL tabs' search/filter state PERSISTS across switches — each tab
 *    owns its own URL params namespaced by tab key:
 *      Users  → `usersQ`, `usersRole`, `usersTeam`
 *      Roles  → `rolesQ`
 *      Teams  → `teamsQ`
 *    Round-trip Users→Roles→Users keeps the users-tab filters intact.
 *  - The PageHeader's primary action depends on the active tab:
 *      Users  → "Add user" (super-admin only)
 *      Roles  → "New role"
 *      Teams  → "New team"
 *    The same action is mirrored into <MobileTopbarAction>.
 *  - Routes /roles and /teams server-redirect to /users?tab=… (see those
 *    pages). The URL the user sees while inside this surface is
 *    /users?tab=…, which is the canonical address for deep linking.
 *
 * i18n: this is a CLIENT component — server pages are forbidden from calling
 * getTranslations/t() (rule 5 / the 7-times-bitten trap). All copy lives
 * here and below.
 */

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { MobileTopbarAction } from "@/components/shell/mobile-topbar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserContext } from "@/app/(application)/authenticated";

import { RolesTab } from "./roles-tab";
import { TeamsTab } from "./teams-tab";
import { UsersTab } from "./users-tab";

export type AccessTab = "users" | "roles" | "teams";

const TABS: AccessTab[] = ["users", "roles", "teams"];

function isTab(value: string | null): value is AccessTab {
  return value === "users" || value === "roles" || value === "teams";
}

export function AccessSurface() {
  const t = useTranslations("access");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: currentUser } = React.useContext(UserContext) ?? { user: null };

  const viewerId = currentUser?.id;
  const viewerIsSuperAdmin = Boolean(currentUser?.super_admin);

  const tabParam = searchParams.get("tab");
  const activeTab: AccessTab = isTab(tabParam) ? tabParam : "users";

  // Tab-switch state: each tab "owns" its own create-dialog open flag.
  const [addUserOpen, setAddUserOpen] = React.useState(false);
  const [createRoleOpen, setCreateRoleOpen] = React.useState(false);
  const [createTeamOpen, setCreateTeamOpen] = React.useState(false);

  // Palette "create" entries deep-link with ?new=1 (palette convention,
  // navigation.md §1). Open the active tab's create surface, then drop the
  // flag so a refresh/back doesn't re-open it.
  React.useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    if (activeTab === "users") {
      if (viewerIsSuperAdmin) setAddUserOpen(true);
    } else if (activeTab === "roles") {
      setCreateRoleOpen(true);
    } else {
      setCreateTeamOpen(true);
    }
    const next = new URLSearchParams(searchParams.toString());
    next.delete("new");
    const query = next.toString();
    router.replace(query ? `/users?${query}` : "/users", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("new"), activeTab, viewerIsSuperAdmin]);

  const handleTabChange = React.useCallback(
    (next: string) => {
      if (!isTab(next)) return;
      // Preserve every tab's namespaced params (usersQ / rolesQ / teamsQ /
      // usersRole / usersTeam). Only the `tab` key flips; the rest of the
      // query string carries through untouched so round-trips like
      // Users→Roles→Users land back with the users-tab filters intact
      // (architect contract; was a regression in the first delivery).
      const params = new URLSearchParams(searchParams.toString());
      if (next === "users") params.delete("tab");
      else params.set("tab", next);
      const query = params.toString();
      router.push(query ? `/users?${query}` : "/users", { scroll: false });
    },
    [router, searchParams],
  );

  const primaryAction = React.useMemo(() => {
    if (activeTab === "users") {
      if (!viewerIsSuperAdmin) return null;
      return (
        <Button onClick={() => setAddUserOpen(true)}>
          <Plus aria-hidden="true" className="mr-2 size-4" />
          {t("users.addUser.action")}
        </Button>
      );
    }
    if (activeTab === "roles") {
      return (
        <Button onClick={() => setCreateRoleOpen(true)}>
          <Plus aria-hidden="true" className="mr-2 size-4" />
          {t("roles.newRole")}
        </Button>
      );
    }
    return (
      <Button onClick={() => setCreateTeamOpen(true)}>
        <Plus aria-hidden="true" className="mr-2 size-4" />
        {t("teams.newTeam")}
      </Button>
    );
  }, [activeTab, viewerIsSuperAdmin, t]);

  const mobileAction = React.useMemo(() => {
    if (activeTab === "users") {
      if (!viewerIsSuperAdmin) return null;
      return (
        <Button size="sm" onClick={() => setAddUserOpen(true)}>
          <Plus aria-hidden="true" className="mr-1 size-4" />
          {t("users.addUser.action")}
        </Button>
      );
    }
    if (activeTab === "roles") {
      return (
        <Button size="sm" onClick={() => setCreateRoleOpen(true)}>
          <Plus aria-hidden="true" className="mr-1 size-4" />
          {t("roles.newRole")}
        </Button>
      );
    }
    return (
      <Button size="sm" onClick={() => setCreateTeamOpen(true)}>
        <Plus aria-hidden="true" className="mr-1 size-4" />
        {t("teams.newTeam")}
      </Button>
    );
  }, [activeTab, viewerIsSuperAdmin, t]);

  return (
    <PageShell variant="content">
      {mobileAction ? (
        <MobileTopbarAction>{mobileAction}</MobileTopbarAction>
      ) : null}

      <PageHeader
        title={t("title")}
        description={t("description")}
        action={primaryAction}
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {t(`tabs.${tab}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-2">
        {activeTab === "users" ? (
          <UsersTab
            viewerId={viewerId}
            viewerIsSuperAdmin={viewerIsSuperAdmin}
            addUserOpen={addUserOpen}
            onAddUserOpenChange={setAddUserOpen}
          />
        ) : null}
        {activeTab === "roles" ? (
          <RolesTab
            createOpen={createRoleOpen}
            onCreateOpenChange={setCreateRoleOpen}
          />
        ) : null}
        {activeTab === "teams" ? (
          <TeamsTab
            createOpen={createTeamOpen}
            onCreateOpenChange={setCreateTeamOpen}
          />
        ) : null}
      </div>
    </PageShell>
  );
}
