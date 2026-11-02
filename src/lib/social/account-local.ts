"use client";

import type { Profile } from "@/lib/types";

const ACCOUNTS_KEY = "slop_local_accounts_v1";

type LocalAccountRecord = {
  email: string;
  profile: Profile;
};

function readAccounts(): LocalAccountRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is LocalAccountRecord =>
        !!row &&
        typeof row === "object" &&
        typeof (row as LocalAccountRecord).email === "string" &&
        !!(row as LocalAccountRecord).profile?.id,
    );
  } catch {
    return [];
  }
}

function writeAccounts(rows: LocalAccountRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(rows.slice(0, 40)));
  } catch {
    /* ignore quota */
  }
}

/** Reuse a stable profile id for the same email across sign-in sessions. */
export function upsertLocalAccount(profile: Profile): Profile {
  const email = profile.email.trim().toLowerCase();
  const rows = readAccounts();
  const existing = rows.find((r) => r.email === email);
  if (existing) {
    const merged: Profile = {
      ...existing.profile,
      ...profile,
      id: existing.profile.id,
      email: existing.profile.email || profile.email,
      createdAt: existing.profile.createdAt || profile.createdAt,
    };
    writeAccounts(
      rows.map((r) => (r.email === email ? { email, profile: merged } : r)),
    );
    return merged;
  }
  writeAccounts([{ email, profile }, ...rows]);
  return profile;
}

export function findLocalAccountByEmail(email: string): Profile | null {
  const key = email.trim().toLowerCase();
  return readAccounts().find((r) => r.email === key)?.profile ?? null;
}
