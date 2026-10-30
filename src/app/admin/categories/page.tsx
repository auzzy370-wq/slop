"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSlopStore } from "@/store/slop-store";
import { slugify, uid } from "@/lib/utils";
import { toast } from "sonner";

export default function AdminCategoriesPage() {
  const categories = useSlopStore((s) => s.categories);
  const upsertCategory = useSlopStore((s) => s.upsertCategory);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("✨");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">
          Categories
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Organize the library. Videos can belong to multiple categories.
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <Input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Input
          placeholder="Icon (emoji or short label)"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
        />
        <Button
          onClick={() => {
            if (!name.trim()) {
              toast.error("Name required");
              return;
            }
            upsertCategory({
              id: uid("cat"),
              slug: slugify(name),
              name: name.trim(),
              description: description.trim(),
              icon: icon || "✨",
              imageUrl: null,
              displayOrder: categories.length + 1,
              active: true,
            });
            setName("");
            setDescription("");
            toast.success("Category created");
          }}
        >
          Create category
        </Button>
      </section>

      <div className="space-y-2">
        {categories
          .slice()
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3"
            >
              <div>
                <p className="font-semibold">
                  {cat.icon} {cat.name}
                </p>
                <p className="text-xs text-white/45">{cat.description}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  upsertCategory({ ...cat, active: !cat.active })
                }
              >
                {cat.active ? "Disable" : "Enable"}
              </Button>
            </div>
          ))}
      </div>
    </div>
  );
}
