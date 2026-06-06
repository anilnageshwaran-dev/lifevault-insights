import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const fnErrorMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    // Re-throw framework redirects / typed responses untouched.
    if (error != null && typeof error === "object" && ("statusCode" in error || "isRedirect" in error)) {
      throw error;
    }
    console.error("[serverFn]", error);
    // Sanitise: never leak env var names, stack traces, or internal config to the client.
    throw new Error("An internal error occurred. Please try again.");
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth, fnErrorMiddleware],
  requestMiddleware: [errorMiddleware],
}));
