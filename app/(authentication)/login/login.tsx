"use client";

import google from "../../../public/assets/google.svg";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
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
import { ConfigContext } from "@/components/config-context";

export default function Login() {
  const configContext = React.useContext(ConfigContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submittedOTP, setSubmittedOTP] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState("");
  const formRef = useRef<any>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const destination = searchParams.get('destination') || '/';

  async function handleOTPVerification(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const formattedEmail = encodeURIComponent(email.toLowerCase().trim());
    const formattedCode = encodeURIComponent(code);
    const formattedCallback = encodeURIComponent(destination ? decodeURIComponent(destination) : "/dashboard");
    const otpRequestURL = `../api/auth/callback/email?email=${formattedEmail}&token=${formattedCode}&callbackUrl=${formattedCallback}`;
    const response = await fetch(otpRequestURL);

    if (!response) {
      setSubmitting(false);
    }

    if (response.url.includes(destination ? decodeURIComponent(destination) : "/dashboard")) {
      router.push(response.url);
      return;
    }
    router.replace(`/login?error=Verification`);

  }

  useEffect(() => {
    if (formRef.current && code.length === 6) {
      formRef.current.requestSubmit();
    }
  }, [code]);

  const authMode: "otp" | "password" | undefined = configContext?.auth_mode as "otp" | "password";

  const handleFormSignIn = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res: any = await signIn(
        authMode === "otp" ? "email" : "credentials",
        {
          email,
          password: authMode !== "otp" ? password : null,
          redirect: false
        }
      );

      if (res.error) {
        // Handle error
        console.error(res.error);
        setSubmitting(false);
        router.replace(`/login?error=${encodeURIComponent(res.error)}`);
        return;
      }

      // Handle successful request (you can redirect to another page or show a success message)
      // window.location.href = "/auth/verify-request";
      if (authMode === "otp") {
        setSubmittedOTP(true);
        setSubmitting(false);
        return;
      }

      router.push(destination ? decodeURIComponent(destination) : "/dashboard");
    } catch (error: any) {
      console.error(error);
      setSubmitting(false);
      router.replace(`/login?error=${encodeURIComponent(error?.message || "Unknown error")}`);
      return;
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signIn("google", { callbackUrl: destination ? decodeURIComponent(destination) : "/dashboard" });
    } catch (error: any) {
      console.error("Sign in failed:", error);
      setSubmitting(false);
      router.replace(`/login?error=${encodeURIComponent(error?.message || "Unknown error")}`);
    }
  }

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
          {submittedOTP ? (
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
            <form className="grid gap-4" onSubmit={handleFormSignIn}>
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
                {
                  authMode !== "otp" ? (
                    <>
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </>
                  ) : null
                }
              </div>
              <Button disabled={submitting} type="submit" className="w-full">
                {submitting ? (
                  <div className="flex items-center space-x-2">
                    <span className="size-2 animate-pulse rounded-full bg-primary-foreground" />
                    <span className="size-2 animate-pulse rounded-full bg-primary-foreground" />
                    <span className="size-2 animate-pulse rounded-full bg-primary-foreground" />
                  </div>
                ) : (
                  "Login"
                )}
              </Button>

              {
                configContext?.google_client_id && (<Button
                  variant="outline"
                  disabled={submitting}
                  type="button"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                >
                  {submitting ? (
                    <div className="flex items-center space-x-2">
                      <span className="size-2 animate-pulse rounded-full bg-primary-foreground" />
                      <span className="size-2 animate-pulse rounded-full bg-primary-foreground" />
                      <span className="size-2 animate-pulse rounded-full bg-primary-foreground" />
                    </div>
                  ) : (
                    <><Image className="size-4 mr-3" src={google} alt="Google logo" /> Sign up with Google</>
                  )}
                </Button>)
              }

            </form>
          )}
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account? <div>Contact your admin</div>
          </div>
        </div>
      </div>
      <div className="hidden bg-muted lg:block">
        <img
          src={configContext?.backend + "/cover.jpg"}
          alt="Image"
          width="1920"
          height="1080"
          className="size-full object-cover"
        />
      </div>
    </div>
  );
}
