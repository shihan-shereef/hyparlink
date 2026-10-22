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
  "/assets/upload(.*)",
  "/editor/project(.*)",
  "/editor/session(.*)",
  "/backend-api(.*)",
  "/convex(.*)",
  "/monitoring(.*)",
]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  if (isPublicRoute(request)) {
    return;
  }

  const isSignIn = isSignInPage(request);
  if (isSignIn) {
    if (await convexAuth.isAuthenticated()) {
      return nextjsMiddlewareRedirect(request, "/");
    }
    return I18nMiddleware(request);
  }

  if (!(await convexAuth.isAuthenticated())) {
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
