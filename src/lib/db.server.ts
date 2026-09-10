/* eslint-disable @typescript-eslint/no-explicit-any */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

let dbInstance: DatabaseSync | null = null;

const DB_PATH = path.resolve(process.cwd(), "intelliforge.sqlite");

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const exists = fs.existsSync(DB_PATH);
  dbInstance = new DatabaseSync(DB_PATH);

  // Initialize tables
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      email TEXT,
      full_name TEXT,
      organisation TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      kind TEXT DEFAULT 'text',
      origin TEXT,
      byte_size INTEGER DEFAULT 0,
      status TEXT DEFAULT 'uploaded',
      raw_text TEXT DEFAULT '',
      extraction_method TEXT DEFAULT 'direct_text',
      summary TEXT,
      is_demo INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      status TEXT DEFAULT 'queued',
      current_stage TEXT DEFAULT 'upload',
      stages TEXT DEFAULT '[]',
      error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS source_chunks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL,
      locator TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS facts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      label TEXT NOT NULL,
      value TEXT NOT NULL,
      is_locked INTEGER DEFAULT 0,
      locator TEXT,
      chunk_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      text TEXT NOT NULL,
      locator TEXT,
      chunk_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      name TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      locator TEXT,
      chunk_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS generation_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      output_type TEXT,
      output_types TEXT,
      audience TEXT,
      tone TEXT,
      detail TEXT,
      objective TEXT,
      language TEXT,
      instructions TEXT,
      intent_prompt TEXT,
      understood_intent TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS outputs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      request_id TEXT,
      output_type TEXT NOT NULL,
      audience TEXT NOT NULL,
      tone TEXT NOT NULL,
      content TEXT DEFAULT '',
      status TEXT DEFAULT 'generated',
      verification_status TEXT DEFAULT 'pending',
      evidence_coverage REAL DEFAULT 0,
      model TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS output_claims (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      output_id TEXT NOT NULL,
      ordinal INTEGER DEFAULT 0,
      sentence TEXT,
      claim_text TEXT,
      locator TEXT,
      chunk_id TEXT,
      evidence_text TEXT,
      grounded INTEGER DEFAULT 1,
      match_score REAL DEFAULT 1.0,
      grounding_score REAL DEFAULT 1.0,
      explanation TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fact_conflicts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      output_id TEXT NOT NULL,
      fact_id TEXT,
      fact_label TEXT,
      label TEXT,
      locked_value TEXT,
      expected_value TEXT,
      generated_text TEXT,
      actual_value TEXT,
      generated_value TEXT,
      suggestion TEXT,
      context_snippet TEXT,
      severity TEXT DEFAULT 'critical',
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trust_checks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      output_id TEXT NOT NULL,
      check_key TEXT NOT NULL,
      label TEXT NOT NULL,
      status TEXT NOT NULL,
      detail TEXT,
      method TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      output_id TEXT NOT NULL,
      decision TEXT NOT NULL,
      notes TEXT,
      diff_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS distributions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      output_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      recipient TEXT,
      payload TEXT,
      status TEXT DEFAULT 'sent',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      detail TEXT,
      payload TEXT,
      prev_hash TEXT,
      hash TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS demo_scenarios (
      slug TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      kind TEXT DEFAULT 'incident_report',
      body TEXT NOT NULL
    );
  `);

  // Run safe schema migrations for existing tables
  const safeAlterCols = [
    "ALTER TABLE outputs ADD COLUMN model TEXT",
    "ALTER TABLE outputs ADD COLUMN updated_at TEXT",
    "ALTER TABLE generation_requests ADD COLUMN output_types TEXT",
    "ALTER TABLE generation_requests ADD COLUMN objective TEXT",
    "ALTER TABLE generation_requests ADD COLUMN intent_prompt TEXT",
    "ALTER TABLE generation_requests ADD COLUMN understood_intent TEXT",
    "ALTER TABLE output_claims ADD COLUMN ordinal INTEGER DEFAULT 0",
    "ALTER TABLE output_claims ADD COLUMN evidence_text TEXT",
    "ALTER TABLE output_claims ADD COLUMN match_score REAL DEFAULT 1.0",
    "ALTER TABLE fact_conflicts ADD COLUMN fact_label TEXT",
    "ALTER TABLE fact_conflicts ADD COLUMN locked_value TEXT",
    "ALTER TABLE fact_conflicts ADD COLUMN generated_text TEXT",
    "ALTER TABLE fact_conflicts ADD COLUMN generated_value TEXT",
    "ALTER TABLE fact_conflicts ADD COLUMN suggestion TEXT",
  ];
  for (const sql of safeAlterCols) {
    try {
      dbInstance.exec(sql);
    } catch {
      // column already exists
    }
  }

  // Seed standard scenarios
  seedDemoScenarios(dbInstance);

  return dbInstance;
}

function seedDemoScenarios(db: DatabaseSync) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO demo_scenarios (slug, title, kind, body)
    VALUES (?, ?, ?, ?)
  `);

  insert.run(
    "cyber-incident-report",
    "Cyber Incident Report (Hyderabad)",
    "security_advisory",
    `INCIDENT ADVISORY - CRITICAL
Date: 12 August 2026
Location: Hyderabad Regional Gateway, Cyber Command
Incident Identifier: SEC-2026-HYD-092

EXECUTIVE SUMMARY:
On 12 August 2026 at 03:42 IST, a high-severity unauthorized intrusion incident was detected across perimeter security controllers in Hyderabad. Exactly 17 systems were affected across telemetry and routing units. 

IMPACT ASSESSMENT:
- Compromised infrastructure: 17 gateway switches and diagnostic controllers.
- Data integrity: Core database partitions remained intact with no verified data exfiltration.
- Service impact: 14% intermittent packet latency observed between 03:45 IST and 05:10 IST.

RECOMMENDED ACTION:
1. Immediately patch all 17 affected systems with Firmware Security Patch Version Y.
2. Rotate all cryptographic session keys across the southern telemetry grid.
3. Keep boundary isolation active until the CERT inspection completes at 18:00 IST.`,
  );

  insert.run(
    "ntro-incident-advisory",
    "NTRO Telecom Gateway Advisory",
    "telecom_advisory",
    `NATIONAL TECHNICAL RESEARCH ORGANISATION (NTRO)
TECHNICAL ADVISORY NOTE: TAN-2026-4401
CLASSIFICATION: RESTRICTED // OPERATIONAL IMMEDIATE
DATE: 14 OCTOBER 2026

SUBJECT: Telemetry Disruption on Northern Core Optical Transport Ring

1. SUMMARY OF OCCURRENCE
At 02:17 IST on 14 October 2026, automated monitoring flagged anomalous optical loss of signal across 4 redundant fiber transport spans between Chandigarh and Srinagar. Critical traffic was rerouted to secondary terrestrial microwave links within 420 milliseconds, preserving 94.2% nominal operational bandwidth.

2. CONFIRMED FACTS
- Affected segment: Northern Ring Spans 03, 04, 05, and 07.
- Root cause: Physical cable cut due to unscheduled highway excavation near Ambala junction.
- Total active circuits diverted: 38 trunk lines.
- Recovery ETA: Tier-1 field engineering restoration estimated within 6 hours (by 08:30 IST).
- No classified telemetry compromise was observed.

3. MANDATORY ACTIONS
All regional nodes must maintain automated dual-homed routing until physical continuity is recertified by the NTRO field verification team.`,
  );

  insert.run(
    "ndma-cyclone-storm-warning",
    "NDMA Cyclone Storm Warning",
    "disaster_alert",
    `NATIONAL DISASTER MANAGEMENT AUTHORITY (NDMA)
SEVERE WEATHER BULLETIN NO. 14 / CYCLONE 'VARUN'
ISSUED: 18 SEPTEMBER 2026, 06:00 IST

1. SITUATION OVERVIEW
Deep depression over the West Central Bay of Bengal has intensified into a Very Severe Cyclonic Storm (VSCS) 'VARUN'. The system is moving north-northwestwards at 18 km/h.

2. KEY FORECAST METRICS
- Maximum sustained surface wind speed: 145 km/h gusting to 165 km/h.
- Expected landfall location: Between Puri and Paradip along the Odisha coastline.
- Landfall timing: Estimated between 17:00 IST and 20:00 IST on 19 September 2026.
- Storm surge: Astronomical tide plus 2.5 meters above normal tide level in low-lying coastal areas.
- Rainfall warning: Extremely heavy rainfall (exceeding 200 mm in 24 hours) predicted across coastal districts.

3. DIRECTIVES FOR LOCAL AUTHORITIES
- Evacuation of 250,000 residents from vulnerable coastal zones within 5 km of shoreline.
- Immediate suspension of all fishing, shipping, and offshore operations.
- Deployment of 28 NDRF teams equipped with satellite emergency communication packs.`,
  );
}

// Generate RFC4122 v4 UUID
export function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function sanitizeSqliteValue(val: unknown): string | number | bigint | Uint8Array | null {
  if (val === undefined || val === null) return null;
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "number" || typeof val === "string" || typeof val === "bigint") return val;
  if (val instanceof Uint8Array) return val;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

/**
 * Creates a Supabase-compatible client interface over SQLite.
 * Compatible with supabase.from(table).select().insert().update().delete().eq().single()
 */
export function createLocalSupabaseClient(userId = "10000000-0000-4000-8000-000000000001") {
  const db = getDb();

  return {
    auth: {
      async getClaims(token?: string) {
        return { data: { claims: { sub: userId, role: "operator" } }, error: null };
      },
      async getSession() {
        return {
          data: {
            session: {
              access_token: tokenForUser(userId),
              user: { id: userId, email: "operator@intelliforge.ai" },
            },
          },
          error: null,
        };
      },
      async signOut() {
        return { error: null };
      },
    },

    from(table: string) {
      return createQueryBuilder(db, table, userId);
    },
  };
}

function tokenForUser(userId: string): string {
  // Return valid 3-part JWT
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(
    JSON.stringify({
      sub: userId,
      email: "operator@intelliforge.ai",
      role: "authenticated",
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 604800,
    }),
  ).toString("base64url");
  const s = Buffer.from("valid_signature_" + userId.slice(0, 8)).toString("base64url");
  return `${h}.${p}.${s}`;
}

type QueryFilter =
  | { type: "eq"; col: string; val: unknown }
  | { type: "neq"; col: string; val: unknown }
  | { type: "in"; col: string; vals: unknown[] };

function createQueryBuilder(db: DatabaseSync, table: string, defaultUserId: string) {
  let selectedFields = "*";
  const filters: QueryFilter[] = [];
  let orderByCol: string | null = null;
  let orderAsc = true;
  let limitCount: number | null = null;

  // Insert operation
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

    // When awaited or returned directly
    then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
      return builder.execute().then(onfulfilled, onrejected);
    },

    async execute() {
      try {
        // Handle INSERT
        if (insertData) {
          const rows = Array.isArray(insertData) ? insertData : [insertData];
          const insertedRows: any[] = [];

          for (const rawRow of rows) {
            const row: Record<string, unknown> = { ...rawRow };
            if (!row.id) row.id = uuid();
            if (!row.user_id && table !== "demo_scenarios") {
              row.user_id = defaultUserId;
            }

            // Serialize objects or arrays to JSON strings
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

          const result = Array.isArray(insertData) ? insertedRows : insertedRows[0];
          return { data: isSingle ? (insertedRows[0] ?? null) : result, error: null };
        }

        // Handle UPDATE
        if (updateData) {
          const sets: string[] = [];
          const values: unknown[] = [];

          const safeUpdate = { ...updateData };
          for (const key of Object.keys(safeUpdate)) {
            sets.push(`${key} = ?`);
            values.push(sanitizeSqliteValue(safeUpdate[key]));
          }

          const whereClauses: string[] = [];
          for (const f of filters) {
            if (f.type === "eq") {
              whereClauses.push(`${f.col} = ?`);
              values.push(sanitizeSqliteValue(f.val));
            } else if (f.type === "neq") {
              whereClauses.push(`${f.col} != ?`);
              values.push(sanitizeSqliteValue(f.val));
            }
          }

          const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
          const sql = `UPDATE ${table} SET ${sets.join(", ")} ${whereSql}`;
          db.prepare(sql).run(...values);
          return { data: null, error: null };
        }

        // Handle DELETE
        if (isDelete) {
          const whereClauses: string[] = [];
          const values: unknown[] = [];

          for (const f of filters) {
            if (f.type === "eq") {
              whereClauses.push(`${f.col} = ?`);
              values.push(sanitizeSqliteValue(f.val));
            } else if (f.type === "neq") {
              whereClauses.push(`${f.col} != ?`);
              values.push(sanitizeSqliteValue(f.val));
            }
          }

          const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
          const sql = `DELETE FROM ${table} ${whereSql}`;
          db.prepare(sql).run(...values);
          return { data: null, error: null };
        }

        // Handle SELECT
        const whereClauses: string[] = [];
        const values: unknown[] = [];

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

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
        let orderSql = "";
        if (orderByCol) {
          orderSql = `ORDER BY ${orderByCol} ${orderAsc ? "ASC" : "DESC"}`;
        }
        let limitSql = "";
        if (limitCount !== null) {
          limitSql = `LIMIT ${limitCount}`;
        }

        const sql = `SELECT ${selectedFields === "*" ? "*" : selectedFields} FROM ${table} ${whereSql} ${orderSql} ${limitSql}`;
        const rawRows = db.prepare(sql).all(...values) as any[];

        // Deserialize JSON columns if any (stages, payload, diff_json)
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
                // leave as string
              }
            }
          }
          return copy;
        });

        if (isSingle) {
          if (rows.length === 0) {
            return { data: null, error: { message: "Row not found", code: "PGRST116" } };
          }
          return { data: rows[0], error: null };
        }

        if (isMaybeSingle) {
          return { data: rows[0] ?? null, error: null };
        }

        return { data: rows, error: null };
      } catch (err: any) {
        console.error(`[SQLite Error in table ${table}]:`, err);
        return { data: null, error: { message: err?.message || "Database error" } };
      }
    },
  };

  return builder;
}
