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
  "/assets(.*)",
  "/editor(.*)",
  "/:locale/editor(.*)",
  "/backend-api(.*)",
  "/convex(.*)",
  "/freecut(.*)",
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
    if (
      pathname.startsWith("/editor") ||
      /^\/(en|fr|es)\/editor/.test(pathname)
    ) {
      return I18nMiddleware(request);
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
        if (parts.length === 3) {
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
    if (authenticated) {
      return nextjsMiddlewareRedirect(request, "/");
    }
    return I18nMiddleware(request);
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
