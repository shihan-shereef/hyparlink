import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  isAuthenticatedNextjs,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { createI18nMiddleware } from "next-international/middleware";

const I18nMiddleware = createI18nMiddleware({
  locales: ["en", "fr", "es"],
  defaultLocale: "en",
  urlMappingStrategy: "rewrite",
});

const isSignInPage = createRouteMatcher(["/login", "/login(.*)"]);
const isPublicRoute = createRouteMatcher([
  "/storage(.*)",
  "/cdn(.*)",
  "/outputs(.*)",
  "/audio(.*)",
  "/api(.*)",
  "/ai(.*)",
  "/editor/session(.*)",
  "/editor/project(.*)",
  "/backend-api(.*)",
  "/convex(.*)",
  "/monitoring(.*)",
  "/studio(.*)",
  "/studio-proxy(.*)",
  "/native-editor(.*)",
]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  if (isPublicRoute(request)) {
    const pathname = request.nextUrl.pathname;
    if (
      pathname.startsWith("/editor/session") ||
      pathname.startsWith("/editor/project") ||
      pathname.startsWith("/studio-proxy")
    ) {
      return;
    }
    return;
  }

  let authenticated = false;
  try {
    authenticated = await convexAuth.isAuthenticated();
  } catch (err) {
    console.warn("[middleware] convexAuth.isAuthenticated error:", err);
  }

  if (!authenticated) {
    try {
      const token = await convexAuth.getToken();
      if (token && typeof token === "string") {
        const parts = token.split(".");
        if (parts.length === 3 && parts[1]) {
          const payload = JSON.parse(
            Buffer.from(parts[1], "base64").toString("utf-8"),
          );
          if (payload.exp && payload.exp * 1000 > Date.now()) {
            authenticated = true;
          }
        }
      }
    } catch {
      // ignore parsing error
    }
  }

  const isSignIn = isSignInPage(request);
  if (isSignIn) {
    const isExplicitSignOutOrSwitch =
      request.nextUrl.searchParams.has("switch") ||
      request.nextUrl.searchParams.has("logout");
    if (authenticated && !isExplicitSignOutOrSwitch) {
      return nextjsMiddlewareRedirect(request, "/");
    }
    const response = I18nMiddleware(request);
    if (isExplicitSignOutOrSwitch) {
      response.cookies.delete("__convexAuthJWT");
      response.cookies.delete("__convexAuthRefreshToken");
    }
    return response;
  }

  if (!authenticated) {
    return nextjsMiddlewareRedirect(request, "/login");
  }

  return I18nMiddleware(request);
});

export const config = {
  matcher: [
    "/((?!_next/static|api|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|wav|ogg|m4a|aac)$).*)",

    // all routes except static assets
    "/((?!.*\\..*|_next).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
