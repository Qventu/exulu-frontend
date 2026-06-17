"use client";

import { useMutation } from "@apollo/client";
import { Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CREATE_EVAL_SET } from "@/queries/queries";

interface CreateEvalSetModalProps {
  onSuccess: () => void;
}

export function CreateEvalSetModal({ onSuccess }: CreateEvalSetModalProps) {
  const t = useTranslations("evals.list");
  const tCommon = useTranslations("evals.common");
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");

  const [createEvalSet, { loading }] = useMutation(CREATE_EVAL_SET, {
    onCompleted: () => {
      setName("");
      setDescription("");
      onSuccess();
      setOpen(false);
    },
    onError: (error) => {
      toast.error(t("create.errorTitle"), { description: error.message });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t("create.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{t("create.title")}</DialogTitle>
          <DialogDescription>{t("create.description")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createEvalSet({
              variables: {
                data: {
                  name: name.trim(),
                  description: description.trim() || null,
                },
              },
            });
          }}
        >
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">{t("create.nameLabel")}</Label>
              <Input
                id="name"
                placeholder={t("create.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">{t("create.descriptionLabel")}</Label>
              <Textarea
                id="description"
                placeholder={t("create.descriptionPlaceholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
