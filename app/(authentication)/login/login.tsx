"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import VerificationAlert from "@/app/(authentication)/login/error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";

export default function Login() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState("");
  const formRef = useRef<any>(null);
  const router = useRouter();

  async function handleOTPVerification(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const formattedEmail = encodeURIComponent(email.toLowerCase().trim());
    const formattedCode = encodeURIComponent(code);
    const formattedCallback = encodeURIComponent("/dashboard");
    const otpRequestURL = `../api/auth/callback/email?email=${formattedEmail}&token=${formattedCode}&callbackUrl=${formattedCallback}`;
    const response = await fetch(otpRequestURL);

    if (response) {
      if (response.url.includes("/dashboard")) {
        router.push(response.url);
      } else {
        router.replace(`/login?error=Verification`);
      }
    }

    setSubmitting(false);
  }

  useEffect(() => {
    if (formRef.current && code.length === 6) {
      formRef.current.requestSubmit();
    }
  }, [code]);

  const handleSignIn = async (e) => {
    setSubmitting(true);
    e.preventDefault();

    const res: any = await signIn("email", { email, redirect: false });
    if (res.error) {
      // Handle error
      console.error(res.error);
      setSubmitting(false);
      router.replace(`/login?error=${encodeURIComponent(res.error)}`);
    } else {
      // Handle successful request (you can redirect to another page or show a success message)
      // window.location.href = "/auth/verify-request";
      setSubmitted(true);
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full h-full lg:grid lg:grid-cols-2">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold">Login</h1>
            <p className="text-balance text-muted-foreground">
              Enter your email below to login to your account
            </p>
          </div>
          <VerificationAlert />
          {submitted ? (
            <form
              className="grid gap-4"
              onSubmit={handleOTPVerification}
              ref={formRef}
            >
              <div className="space-y-2">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={(value) => setCode(value)}>
                  <InputOTPGroup className="mx-auto">
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                <div className="text-center text-sm">
                  Enter your one-time password.
                </div>
              </div>
              <Button disabled={submitting} type="submit" className="w-full">
                {submitting ? (
                  <div className="flex items-center space-x-2">
                    <span className="size-2 animate-pulse rounded-full bg-primary-foreground" />
                    <span className="size-2 animate-pulse rounded-full bg-primary-foreground" />
                    <span className="size-2 animate-pulse rounded-full bg-primary-foreground" />
                  </div>
                ) : (
                  "Submit code"
                )}
              </Button>
            </form>
          ) : (
            <form className="grid gap-4" onSubmit={handleSignIn}>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button disabled={submitting} type="submit" className="w-full">
                {submitting ? (
                  <div className="flex items-center space-x-2">
                    <span className="size-2 animate-pulse rounded-full bg-primary-foreground" />
                    <span className="size-2 animate-pulse rounded-full bg-primary-foreground" />
                    <span className="size-2 animate-pulse rounded-full bg-primary-foreground" />
                  </div>
                ) : (
                  "Login with Email"
                )}
              </Button>
            </form>
          )}
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account? <div>Contact your admin</div>
          </div>
        </div>
      </div>
      <div className="hidden bg-muted lg:block">
        <Image
          src="/assets/vackground-com-vo-M6JACr-k-unsplash.jpg"
          alt="Image"
          width="1920"
          height="1080"
          className="size-full object-cover"
        />
      </div>
    </div>
  );
}
