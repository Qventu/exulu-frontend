"use client";

import { useState, useContext } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { AlertTriangle } from "lucide-react";
import { GET_USERS, UPDATE_USER_BY_ID } from "@/queries/queries";
import { UserContext } from "@/app/(application)/authenticated";

interface SuperAdminToggleProps {
  user: {
    id: string;
    super_admin?: boolean;
    email: string;
    [key: string]: any;
  };
}

export function SuperAdminToggle({ user }: SuperAdminToggleProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingChange, setPendingChange] = useState<boolean | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useContext(UserContext);
  const [updateUser] = useMutation(UPDATE_USER_BY_ID, {
    refetchQueries: [
      GET_USERS,
      "GetUsers",
    ],
  });
  const isSuperAdmin = Boolean(user.super_admin);
  const isCurrentUser = currentUser?.id === user.id;
  const handleToggleChange = (checked: boolean) => {
    if (isCurrentUser && isSuperAdmin && !checked) {
      toast({
        title: "Cannot Disable Own Super Admin Rights",
        description: "You cannot disable your own super admin privileges for security reasons.",
        variant: "destructive",
      });
      return;
    }
    setPendingChange(checked);
    setIsDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (pendingChange === null) return;

    setIsLoading(true);
    try {
      await updateUser({
        variables: {
          id: user.id,
          super_admin: pendingChange,
        },
      });
      
      setIsDialogOpen(false);
      setPendingChange(null);
      toast({
        title: pendingChange ? "Super Admin Enabled" : "Super Admin Disabled",
        description: `Super admin access has been ${pendingChange ? 'granted to' : 'removed from'} ${user.email}.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update super admin status.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsDialogOpen(false);
    setPendingChange(null);
  };

  return (
    <>
      <div className="flex items-center space-x-2">
        <Switch
          checked={isSuperAdmin}
          onCheckedChange={handleToggleChange}
          disabled={isLoading}
          className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
        />
        <span className="text-sm text-muted-foreground">
          {isSuperAdmin ? "Yes" : "No"}
        </span>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[475px]">
          <DialogHeader>
            <DialogTitle>
              {pendingChange ? "Grant" : "Remove"} Super Admin Access
            </DialogTitle>
            <DialogDescription>
              {pendingChange 
                ? `Are you sure you want to grant super admin access to ${user.email}? This will give them full administrative privileges.`
                : `Are you sure you want to remove super admin access from ${user.email}? They will lose all administrative privileges.`
              }
              {!pendingChange && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-800">
                    <strong>Warning:</strong> Ensure you are not removing super admin access from the last super administrator. 
                    This could prevent anyone from managing users and system settings and requiring a technical support intervention
                    to set the super admin status again via the database.
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={isLoading}
              variant={pendingChange ? "destructive" : "default"}
              className={pendingChange ? "bg-red-500 hover:bg-red-600" : ""}
            >
              {isLoading ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}