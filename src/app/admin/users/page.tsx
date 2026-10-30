"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { DEMO_ADMIN_PROFILE, DEMO_USER_PROFILE } from "@/lib/demo-data";
import { useSlopStore } from "@/store/slop-store";

export default function AdminUsersPage() {
  const currentUser = useSlopStore((s) => s.currentUser);
  const [q, setQ] = useState("");

  const users = useMemo(() => {
    const list = [DEMO_ADMIN_PROFILE, DEMO_USER_PROFILE];
    if (currentUser && !list.some((u) => u.id === currentUser.id)) {
      list.push(currentUser);
    }
    return list.filter((u) => {
      const hay = `${u.displayName} ${u.email} ${u.id}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [currentUser, q]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">
          Users
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Search accounts, review status, and note that bans/suspensions are
          enforced server-side once Supabase is connected. Admin role is never
          granted by display name alone.
        </p>
      </div>
      <Input
        placeholder="Search by name, email, or id"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="space-y-2">
        {users.map((user) => (
          <div
            key={user.id}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{user.displayName}</p>
                <p className="text-xs text-white/45">{user.email}</p>
              </div>
              <div className="flex gap-2 text-[11px] font-bold uppercase tracking-wide">
                <span className="rounded-full bg-white/10 px-2 py-1">
                  {user.role}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-1">
                  {user.status}
                </span>
                {user.isPremium && (
                  <span className="rounded-full bg-[var(--slop-violet)]/20 px-2 py-1 text-[var(--slop-violet)]">
                    premium
                  </span>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-white/35">
              Joined {new Date(user.createdAt).toLocaleDateString()} · id{" "}
              {user.id}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
