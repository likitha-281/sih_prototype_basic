/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClientQueryBuilder } from "./client-store";
import { getStoredOperatorSession, clearOperatorSession } from "@/lib/auth-service";

export const supabase = {
  from(table: string) {
    return createClientQueryBuilder(table);
  },

  channel(name: string) {
    const listeners: Array<{
      event: string;
      filter: any;
      callback: (payload: any) => void;
    }> = [];
    let eventHandler: ((e: Event) => void) | null = null;

    const channelObj = {
      name,
      on(event: string, filter: any, callback: (payload: any) => void) {
        listeners.push({ event, filter, callback });
        return channelObj;
      },
      subscribe(statusCallback?: (status: string) => void) {
        if (typeof window !== "undefined") {
          eventHandler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            for (const listener of listeners) {
              if (listener.event === "postgres_changes") {
                const tableFilter = listener.filter?.table;
                if (!tableFilter || tableFilter === detail?.table) {
                  listener.callback(detail);
                }
              } else {
                listener.callback(detail);
              }
            }
          };
          window.addEventListener("supabase_db_changes", eventHandler);
        }
        if (statusCallback) statusCallback("SUBSCRIBED");
        return channelObj;
      },
      unsubscribe() {
        if (typeof window !== "undefined" && eventHandler) {
          window.removeEventListener("supabase_db_changes", eventHandler);
          eventHandler = null;
        }
        return Promise.resolve("ok");
      },
    };

    return channelObj;
  },

  removeChannel(channel: any) {
    if (channel && typeof channel.unsubscribe === "function") {
      channel.unsubscribe();
    }
    return Promise.resolve("ok");
  },

  removeAllChannels() {
    return Promise.resolve([]);
  },

  getChannels() {
    return [];
  },

  auth: {
    async getSession() {
      const session = getStoredOperatorSession();
      return { data: { session }, error: null };
    },

    async getUser() {
      const session = getStoredOperatorSession();
      return { data: { user: session?.user ?? null }, error: null };
    },

    async getClaims(token?: string) {
      const session = getStoredOperatorSession();
      return {
        data: {
          claims: {
            sub: session?.user?.id || "10000000-0000-4000-8000-000000000001",
            role: "operator",
          },
        },
        error: null,
      };
    },

    async setSession(tokens: { access_token?: string; refresh_token?: string }) {
      const session = getStoredOperatorSession();
      return { data: { session }, error: null };
    },

    async signUp(params?: any) {
      return { data: { user: null, session: null }, error: null };
    },

    async signInWithPassword(params?: any) {
      return { data: { user: null, session: null }, error: null };
    },

    async signOut() {
      clearOperatorSession();
      return { error: null };
    },

    onAuthStateChange(callback: (event: string, session: any) => void) {
      if (typeof window === "undefined") {
        return { data: { subscription: { unsubscribe: () => {} } } };
      }

      const handler = () => {
        const session = getStoredOperatorSession();
        callback("SIGNED_IN", session);
      };

      window.addEventListener("operator_auth_change", handler);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              window.removeEventListener("operator_auth_change", handler);
            },
          },
        },
      };
    },
  },
} as any;
