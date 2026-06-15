"use client";

/**
 * /variables/create — new-variable form (Phase 4.5 redesign per variables.md §3).
 *
 * Layout: PageShell variant="narrow" + PageHeader breadcrumb back to /variables
 * (no card-in-page boxes — sections render as plain stacked groups, philosophy §4).
 *
 * Decisions per the plan:
 * - Type is a real RadioGroup (Secret vs Plain) — Secret DEFAULTS TO ON (fixes U6).
 * - Value field is a `font-mono` Textarea; inline field errors on submit.
 * - Sticky footer with primary Submit + outline Cancel.
 * - On success: refetch GET_VARIABLES_LIST + GET_VARIABLES_LITE, then redirect
 *   to /variables?selected=<newId> so the user lands on the detail panel.
 * - Client-side read-only redirect guard mirrors the server route guard's level.
 */

import { useMutation } from "@apollo/client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { can } from "@/lib/rights";
import {
  CREATE_VARIABLE,
  GET_VARIABLES_LIST,
  GET_VARIABLES_LITE,
} from "@/queries/queries";

export const dynamic = "force-dynamic";

type FormErrors = { name?: string; value?: string };

export default function CreateVariablePage() {
  const router = useRouter();
  const t = useTranslations("variables");
  const tCommon = useTranslations("common");
  const userContext = React.useContext(UserContext);

  const [formData, setFormData] = React.useState({
    name: "",
    value: "",
    // FIX U6: Secret/encrypted is the default — sensitive material handled with
    // visible care (philosophy §9). Users can opt into plain via the radio.
    encrypted: true,
  });
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [redirected, setRedirected] = React.useState(false);

  const canWrite = React.useMemo(() => {
    const user = userContext?.user;
    if (!user) return false;
    return can(
      { super_admin: user.super_admin === true, role: user.role },
      { area: "variables", level: "write" },
    );
  }, [userContext]);

  React.useEffect(() => {
    if (!userContext?.user) return;
    if (canWrite) return;
    if (redirected) return;
    setRedirected(true);
    toast.info(t("readOnly.redirect"));
    router.replace("/variables");
  }, [canWrite, redirected, router, t, userContext?.user]);

  const [createVariable, { loading }] = useMutation(CREATE_VARIABLE, {
    refetchQueries: [
      { query: GET_VARIABLES_LIST, variables: { page: 1, limit: 10 } },
      "GetVariablesList",
      "GetVariablesLite",
    ],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors: FormErrors = {};
    if (!formData.name.trim()) {
      nextErrors.name = t("form.nameRequired");
    }
    if (!formData.value.trim()) {
      nextErrors.value = t("form.valueRequired");
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      const result = await createVariable({
        variables: {
          name: formData.name.trim(),
          value: formData.value,
          encrypted: formData.encrypted,
        },
      });

      toast.success(
        t("create.success", { name: formData.name.trim() }),
      );

      const newId = (
        result.data as { variablesCreateOne?: { item?: { id?: string } } } | null
      )?.variablesCreateOne?.item?.id;

      router.push(newId ? `/variables?selected=${newId}` : "/variables");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t("create.errorGeneric");
      toast.error(tCommon("somethingWentWrong"), { description: message });
    }
  };

  const setField = <K extends keyof typeof formData>(
    key: K,
    value: (typeof formData)[K],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (key === "name" || key === "value") {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  // While the redirect runs we render nothing — the toast covers the moment.
  if (userContext?.user && !canWrite) {
    return null;
  }

  return (
    <PageShell variant="narrow">
      <PageHeader
        title={t("create.title")}
        description={t("create.description")}
        breadcrumb={{ label: t("title"), href: "/variables" }}
      />

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Type — Secret default ON (U6 fix). */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">{t("form.type")}</Label>
          <RadioGroup
            value={formData.encrypted ? "secret" : "plain"}
            onValueChange={(value) =>
              setField("encrypted", value === "secret")
            }
            className="gap-3"
          >
            <div className="flex items-start gap-3 rounded-md border border-input p-3">
              <RadioGroupItem
                value="secret"
                id="type-secret"
                className="mt-0.5"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Label
                  htmlFor="type-secret"
                  className="cursor-pointer font-medium"
                >
                  {t("form.typeSecret")}
                </Label>
                <span className="text-sm text-muted-foreground">
                  {t("form.typeSecretDescription")}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-md border border-input p-3">
              <RadioGroupItem
                value="plain"
                id="type-plain"
                className="mt-0.5"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Label
                  htmlFor="type-plain"
                  className="cursor-pointer font-medium"
                >
                  {t("form.typePlain")}
                </Label>
                <span className="text-sm text-muted-foreground">
                  {t("form.typePlainDescription")}
                </span>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">
            {t("form.name")}{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </Label>
          <Input
            id="name"
            type="text"
            className="font-mono"
            placeholder={t("form.namePlaceholder")}
            value={formData.name}
            onChange={(e) => setField("name", e.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : "name-help"}
            autoComplete="off"
            spellCheck={false}
          />
          {errors.name ? (
            <p id="name-error" className="text-sm text-destructive">
              {errors.name}
            </p>
          ) : (
            <p id="name-help" className="text-sm text-muted-foreground">
              {t("form.nameHelper")}
            </p>
          )}
        </div>

        {/* Value */}
        <div className="space-y-2">
          <Label htmlFor="value" className="text-sm font-medium">
            {t("form.value")}{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </Label>
          <Textarea
            id="value"
            className="font-mono"
            placeholder={t("form.valuePlaceholder")}
            value={formData.value}
            onChange={(e) => setField("value", e.target.value)}
            rows={4}
            aria-invalid={Boolean(errors.value)}
            aria-describedby={errors.value ? "value-error" : "value-help"}
            spellCheck={false}
          />
          {errors.value ? (
            <p id="value-error" className="text-sm text-destructive">
              {errors.value}
            </p>
          ) : (
            <p id="value-help" className="text-sm text-muted-foreground">
              {formData.encrypted
                ? t("form.valueHelperSecret")
                : t("form.valueHelperPlain")}
            </p>
          )}
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t bg-background p-4 md:-mx-8 md:px-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/variables")}
            disabled={loading}
          >
            {tCommon("cancel")}
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? t("create.submitting") : t("create.submit")}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
