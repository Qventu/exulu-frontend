"use client";

import React, { useState, useContext } from 'react';
import { useMutation } from '@apollo/client';
import { UserContext } from '@/app/(application)/authenticated';
import { ConfigContext } from '@/components/config-context';
import { CREATE_USER, GET_USERS } from '@/queries/queries';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Copy, Eye, EyeOff } from 'lucide-react';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddUserModal({ isOpen, onClose }: AddUserModalProps) {
  const { user } = useContext(UserContext);
  const configContext = useContext(ConfigContext);
  const { toast } = useToast();

  const [step, setStep] = useState<'email' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [createUser] = useMutation(CREATE_USER, {
    refetchQueries: [GET_USERS, 'GetUsers'],
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

  const handleEmailSubmit = async () => {
    if (!email.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an email address',
        variant: 'destructive',
      });
      return;
    }

    if (!email.includes('@')) {
      toast({
        title: 'Error',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    if (configContext?.auth_mode === 'password') {
      const password = generatePassword();
      setGeneratedPassword(password);
      setStep('password');
    } else {
      await createUser({
        variables: {
          email: email.trim(),
          password: generatedPassword,
          type: "user",
          emailVerified: new Date(),
        },
      });
      
      toast({
        title: 'User created',
        description: `User ${email} has been created successfully.`,
      });
      
      handleClose();
    }
  };

  const handlePasswordSubmit = async () => {
    setIsCreating(true);
    
    try {
      await createUser({
        variables: {
          email: email.trim(),
          password: generatedPassword,
        },
      });
      
      toast({
        title: 'User created',
        description: `User ${email} has been created with a temporary password.`,
      });
      
      handleClose();
    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        title: 'Error',
        description: 'Failed to create user. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setStep('email');
    setEmail('');
    setGeneratedPassword('');
    setShowPassword(false);
    setIsCreating(false);
    onClose();
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

  if (!user?.super_admin) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'email' ? 'Add New User' : 'Generated Password'}
          </DialogTitle>
          <DialogDescription>
            {step === 'email' 
              ? 'Enter the email address for the new user.'
              : 'A temporary password has been generated. Copy and send it to the user manually.'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'email' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="mt-1"
                autoFocus
              />
            </div>
          </div>
        )}

        {step === 'password' && (
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
                Please copy this password and send it to {email} manually. The user should change it on their first login.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {step === 'email' && (
            <Button onClick={handleEmailSubmit} disabled={isCreating}>
              {configContext?.auth_mode === 'password' ? 'Continue' : 'Add User'}
            </Button>
          )}
          {step === 'password' && (
            <Button onClick={handlePasswordSubmit} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create User'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}