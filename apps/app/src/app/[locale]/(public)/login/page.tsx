import { AuthForm } from "@/components/auth-form";
import { EmailOtpSignin } from "@/components/email-otp-signin";
import Image from "next/image";

export const metadata = {
  title: "Login",
};

export default function Page() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center">
      <div className="flex flex-col items-center justify-center gap-4 py-8">
        <Image src="/logo.png" alt="logo" width={96} height={96} />
        <AuthForm />
        <div className="flex w-72 items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          one-time email code
          <span className="h-px flex-1 bg-border" />
        </div>
        <EmailOtpSignin />
      </div>
    </div>
  );
}
