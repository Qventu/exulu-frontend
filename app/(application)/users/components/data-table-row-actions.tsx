"use client";

import { useMutation } from "@apollo/client";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { Row } from "@tanstack/react-table";
import {
  GET_USERS,
  REMOVE_USER_BY_ID,
  RESET_USER_PASSWORD,
} from "@/queries/queries";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { userSchema } from "../data/schema";
import { UserContext } from "@/app/(application)/authenticated";
import { useContext, useState } from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const { user: currentUser } = useContext(UserContext);
  const user = userSchema.parse(row.original);

  const { toast } = useToast();
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const [removeUser, removeUserResult] = useMutation(REMOVE_USER_BY_ID, {
    refetchQueries: [
      GET_USERS, // DocumentNode object parsed with gql
      "GetUsers", // Query name
    ],
  });

  const [resetPassword] = useMutation(RESET_USER_PASSWORD, {
    refetchQueries: [GET_USERS, "GetUsers"],
  });

  const generatePassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  const handleResetPassword = () => {
    const password = generatePassword();
    setGeneratedPassword(password);
    setIsResetPasswordOpen(true);
  };

  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      await resetPassword({
        variables: {
          id: user.id,
          password: generatedPassword,
        },
      });

      toast({
        title: "Password reset",
        description: `Password has been reset for ${user.email}.`,
      });

      setIsResetPasswordOpen(false);
      setGeneratedPassword("");
      setShowPassword(false);
    } catch (error) {
      console.error('Error resetting password:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset password. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsResetting(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied',
        description: 'Password copied to clipboard',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex size-8 p-0 data-[state=open]:bg-muted"
          >
            <DotsHorizontalIcon className="size-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[160px]">
          <DropdownMenuItem onClick={handleResetPassword}>
            Reset password
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              if (currentUser.id === user.id) {
                toast({
                  title: "Cannot delete your own user",
                  description: "You cannot delete your own user, that would be a bad idea.",
                });
                return;
              }
              const confirm = window.confirm("Are you sure you want to delete this user?");
              if (!confirm) {
                return;
              }
              removeUser({
                variables: {
                  id: user.id,
                },
              });
              toast({
                title: "Deleting user",
                description: "We deleted the user.",
              });
            }}
          >
            Delete user
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              A temporary password has been generated for {user.email}. Copy and send it to the user manually.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="password">Temporary Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={generatedPassword}
                  readOnly
                  className="pr-20"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => copyToClipboard(generatedPassword)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Please copy this password and send it to {user.email} manually. The user should change it on their first login.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsResetPasswordOpen(false);
                setGeneratedPassword("");
                setShowPassword(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmReset} disabled={isResetting}>
              {isResetting ? 'Resetting...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
