/* eslint-disable @typescript-eslint/no-explicit-any */
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { ensureValidUuid } from "@/lib/auth-service";
import { createLocalSupabaseClient } from "@/lib/db.server";
import { parseJwt, createOperatorJwt } from "@/lib/jwt-utils";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");

    let token = authHeader?.replace("Bearer ", "").trim();

    if (!token) {
      token = createOperatorJwt("10000000-0000-4000-8000-000000000001", "operator@intelliforge.ai");
    }

    let validUserId = "10000000-0000-4000-8000-000000000001";
    let claims: Record<string, unknown> = {
      sub: validUserId,
      role: "operator",
      email: "operator@intelliforge.ai",
    };

    // 1. Check if standard 3-part JWT
    if (token.split(".").length === 3) {
      const parsed = parseJwt(token);
      if (parsed?.sub) {
        validUserId = ensureValidUuid(parsed.sub);
        claims = {
          ...parsed,
          sub: validUserId,
        };
      }
    } else if (token.startsWith("operator-token-") || token.startsWith("operator-")) {
      // Legacy operator string
      const rawId = token.replace("operator-token-", "").replace("operator-", "");
      validUserId = ensureValidUuid(rawId);
      claims = { sub: validUserId, role: "operator" };
    } else {
      validUserId = ensureValidUuid(token);
      claims = { sub: validUserId, role: "operator" };
    }

    const supabase = createLocalSupabaseClient(validUserId);

    return next({
      context: {
        supabase: supabase as any,
        userId: validUserId,
        claims,
      },
    });
  },
);
