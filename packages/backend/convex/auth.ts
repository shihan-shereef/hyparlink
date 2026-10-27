import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { ResendOTP } from "./ResendOTP";
import { ResendOTPReset, ResendOTPVerify } from "./passwordProviders";

// Full auth: email+password (with strength policy, email verification, and password reset),
// magic email OTP, and Google OAuth (set AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET to activate).
const PasswordWithFlows = Password({
  verify: ResendOTPVerify,
  reset: ResendOTPReset,
  validatePasswordRequirements: (password: string) => {
    if (
      password.length < 8 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/\d/.test(password)
    ) {
      throw new ConvexError(
        "Password must be at least 8 characters and include upper, lower, and a number.",
      );
    }
  },
});

const GoogleProvider = Google({
  clientId: process.env.AUTH_GOOGLE_ID,
  clientSecret: process.env.AUTH_GOOGLE_SECRET,
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [PasswordWithFlows, ResendOTP, GoogleProvider],
  // Brute-force protection: per-email token bucket (default is 10/hr) on password + OTP.
  signIn: { maxFailedAttempsPerHour: 5 },
  callbacks: {
    async redirect({ redirectTo }) {
      if (!redirectTo || redirectTo === "/") return "/";
      if (redirectTo.startsWith("http://") || redirectTo.startsWith("https://")) {
        return redirectTo;
      }
      const site = process.env.SITE_URL || "";
      if (!site) return redirectTo.startsWith("/") ? redirectTo : `/${redirectTo}`;
      return `${site.replace(/\/$/, "")}${redirectTo.startsWith("/") ? "" : "/"}${redirectTo}`;
    },
  },
});
