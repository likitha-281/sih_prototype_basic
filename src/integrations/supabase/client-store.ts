/* eslint-disable @typescript-eslint/no-explicit-any */
import { getStoredOperatorSession } from "@/lib/auth-service";
import { createOperatorJwt } from "@/lib/jwt-utils";

type QueryFilter =
  | { type: "eq"; col: string; val: unknown }
  | { type: "neq"; col: string; val: unknown }
  | { type: "in"; col: string; vals: unknown[] };

export function createClientQueryBuilder(table: string) {
  let selectedFields = "*";
  const filters: QueryFilter[] = [];
  let orderByCol: string | null = null;
  let orderAsc = true;
  let limitCount: number | null = null;

  let insertData: Record<string, unknown> | Array<Record<string, unknown>> | null = null;
  let updateData: Record<string, unknown> | null = null;
  let isDelete = false;

  let isSingle = false;
  let isMaybeSingle = false;

  const builder = {
    select(fields = "*") {
      selectedFields = fields;
      return builder;
    },

    insert(data: Record<string, unknown> | Array<Record<string, unknown>>) {
      insertData = data;
      return builder;
    },

    update(data: Record<string, unknown>) {
      updateData = data;
      return builder;
    },

    delete() {
      isDelete = true;
      return builder;
    },

    eq(col: string, val: unknown) {
      filters.push({ type: "eq", col, val });
      return builder;
    },

    neq(col: string, val: unknown) {
      filters.push({ type: "neq", col, val });
      return builder;
    },

    in(col: string, vals: unknown[]) {
      filters.push({ type: "in", col, vals });
      return builder;
    },

    order(col: string, options?: { ascending?: boolean }) {
      orderByCol = col;
      orderAsc = options?.ascending !== false;
      return builder;
    },

    limit(n: number) {
      limitCount = n;
      return builder;
    },

    single() {
      isSingle = true;
      return builder.execute();
    },

    maybeSingle() {
      isMaybeSingle = true;
      return builder.execute();
    },

    then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
      return builder.execute().then(onfulfilled, onrejected);
    },

    async execute() {
      try {
        let action = "select";
        let payloadData: any = undefined;

        if (insertData) {
          action = "insert";
          payloadData = insertData;
        } else if (updateData) {
          action = "update";
          payloadData = updateData;
        } else if (isDelete) {
          action = "delete";
        }

        let token: string | undefined;
        if (typeof window !== "undefined") {
          const session = getStoredOperatorSession();
          token = session?.access_token;
        }

        if (!token) {
          token = createOperatorJwt(
            "10000000-0000-4000-8000-000000000001",
            "operator@intelliforge.ai",
          );
        }

        const res = await fetch("/api/db", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            table,
            action,
            fields: selectedFields,
            filters,
            order: orderByCol ? { col: orderByCol, asc: orderAsc } : null,
            limit: limitCount,
            data: payloadData,
            single: isSingle,
            maybeSingle: isMaybeSingle,
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          try {
            const errObj = JSON.parse(text);
            return { data: null, error: errObj.error || { message: text } };
          } catch {
            return { data: null, error: { message: text || "Database request failed" } };
          }
        }

        const json = await res.json();

        if (
          typeof window !== "undefined" &&
          (action === "insert" || action === "update" || action === "delete")
        ) {
          window.dispatchEvent(
            new CustomEvent("supabase_db_changes", {
              detail: { table, event: action.toUpperCase(), action, data: payloadData },
            }),
          );
        }

        return json;
      } catch (err: any) {
        return { data: null, error: { message: err?.message || "Network error" } };
      }
    },
  };

  return builder;
}
