/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { getDb, uuid, sanitizeSqliteValue } from "@/lib/db.server";
import { parseJwt } from "@/lib/jwt-utils";

export const Route = createFileRoute("/api/db")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization");
          const token = authHeader?.replace("Bearer ", "").trim();
          let userId = "10000000-0000-4000-8000-000000000001";
          if (token) {
            const parsed = parseJwt(token);
            if (parsed?.sub) userId = parsed.sub;
          }

          const body = await request.json();
          const { table, action, fields, filters, order, limit, data, single, maybeSingle } = body;

          if (!table) {
            return new Response(JSON.stringify({ error: "Table name required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const db = getDb();

          // Handle INSERT
          if (action === "insert") {
            const rows = Array.isArray(data) ? data : [data];
            const insertedRows: any[] = [];

            for (const rawRow of rows) {
              const row: Record<string, unknown> = { ...rawRow };
              if (!row.id) row.id = uuid();
              if (!row.user_id && table !== "demo_scenarios") {
                row.user_id = userId;
              }

              for (const key of Object.keys(row)) {
                if (
                  row[key] !== null &&
                  typeof row[key] === "object" &&
                  !(row[key] instanceof Date)
                ) {
                  row[key] = JSON.stringify(row[key]);
                }
              }

              const cols = Object.keys(row);
              const placeholders = cols.map(() => "?").join(", ");
              const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`;
              const values = cols.map((c) => sanitizeSqliteValue(row[c]));

              db.prepare(sql).run(...values);
              insertedRows.push(row);
            }

            const result = Array.isArray(data) ? insertedRows : insertedRows[0];
            return new Response(
              JSON.stringify({ data: single ? insertedRows[0] : result, error: null }),
              {
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          // Handle UPDATE
          if (action === "update") {
            const safeUpdate = { ...data };
            const sets: string[] = [];
            const values: unknown[] = [];

            for (const key of Object.keys(safeUpdate)) {
              sets.push(`${key} = ?`);
              values.push(sanitizeSqliteValue(safeUpdate[key]));
            }

            const whereClauses: string[] = [];
            if (Array.isArray(filters)) {
              for (const f of filters) {
                if (f.type === "eq") {
                  whereClauses.push(`${f.col} = ?`);
                  values.push(sanitizeSqliteValue(f.val));
                } else if (f.type === "neq") {
                  whereClauses.push(`${f.col} != ?`);
                  values.push(sanitizeSqliteValue(f.val));
                }
              }
            }

            const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
            const sql = `UPDATE ${table} SET ${sets.join(", ")} ${whereSql}`;
            db.prepare(sql).run(...values);
            return new Response(JSON.stringify({ data: null, error: null }), {
              headers: { "Content-Type": "application/json" },
            });
          }

          // Handle DELETE
          if (action === "delete") {
            const whereClauses: string[] = [];
            const values: unknown[] = [];

            if (Array.isArray(filters)) {
              for (const f of filters) {
                if (f.type === "eq") {
                  whereClauses.push(`${f.col} = ?`);
                  values.push(sanitizeSqliteValue(f.val));
                } else if (f.type === "neq") {
                  whereClauses.push(`${f.col} != ?`);
                  values.push(sanitizeSqliteValue(f.val));
                }
              }
            }

            const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
            const sql = `DELETE FROM ${table} ${whereSql}`;
            db.prepare(sql).run(...values);
            return new Response(JSON.stringify({ data: null, error: null }), {
              headers: { "Content-Type": "application/json" },
            });
          }

          // Default: SELECT
          const whereClauses: string[] = [];
          const values: unknown[] = [];

          if (Array.isArray(filters)) {
            for (const f of filters) {
              if (f.type === "eq") {
                whereClauses.push(`${f.col} = ?`);
                values.push(sanitizeSqliteValue(f.val));
              } else if (f.type === "neq") {
                whereClauses.push(`${f.col} != ?`);
                values.push(sanitizeSqliteValue(f.val));
              } else if (f.type === "in") {
                if (f.vals.length === 0) {
                  whereClauses.push("1 = 0");
                } else {
                  const q = f.vals.map(() => "?").join(", ");
                  whereClauses.push(`${f.col} IN (${q})`);
                  values.push(...f.vals.map(sanitizeSqliteValue));
                }
              }
            }
          }

          const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
          let orderSql = "";
          if (order?.col) {
            orderSql = `ORDER BY ${order.col} ${order.asc ? "ASC" : "DESC"}`;
          }
          let limitSql = "";
          if (typeof limit === "number") {
            limitSql = `LIMIT ${limit}`;
          }

          const selectFields = fields && fields !== "*" ? fields : "*";
          const sql = `SELECT ${selectFields} FROM ${table} ${whereSql} ${orderSql} ${limitSql}`;
          const rawRows = db.prepare(sql).all(...values) as any[];

          const rows = rawRows.map((r) => {
            const copy = { ...r };
            for (const k of Object.keys(copy)) {
              if (
                typeof copy[k] === "string" &&
                (k === "stages" || k === "payload" || k === "diff_json")
              ) {
                try {
                  copy[k] = JSON.parse(copy[k]);
                } catch {
                  // string
                }
              }
            }
            return copy;
          });

          if (single) {
            if (rows.length === 0) {
              return new Response(
                JSON.stringify({
                  data: null,
                  error: { message: "Row not found", code: "PGRST116" },
                }),
                { headers: { "Content-Type": "application/json" } },
              );
            }
            return new Response(JSON.stringify({ data: rows[0], error: null }), {
              headers: { "Content-Type": "application/json" },
            });
          }

          if (maybeSingle) {
            return new Response(JSON.stringify({ data: rows[0] ?? null, error: null }), {
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ data: rows, error: null }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error("[/api/db Error]:", err);
          return new Response(
            JSON.stringify({ data: null, error: { message: err?.message || "Internal error" } }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
