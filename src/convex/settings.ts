import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const DEFAULTS = {
  themePreference: "system" as "system" | "light" | "dark",
  notificationsEnabled: true,
  autosaveEnabled: true,
};

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("externalId", (q) => q.eq("externalId", identity.subject))
      .unique();
    if (!user) return null;

    const settings = await ctx.db
      .query("settings")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .unique();
    return settings ?? null;
  },
});

export const ensureSettings = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("externalId", (q) => q.eq("externalId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("settings")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .unique();
    if (existing) return existing._id;

    const id = await ctx.db.insert("settings", {
      userId: user._id,
      ...DEFAULTS,
      updatedAt: Date.now(),
    });
    return id;
  },
});

export const updateSettings = mutation({
  args: {
    themePreference: v.optional(
      v.union(v.literal("system"), v.literal("light"), v.literal("dark"))
    ),
    notificationsEnabled: v.optional(v.boolean()),
    autosaveEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("externalId", (q) => q.eq("externalId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("settings")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!existing) {
      await ctx.db.insert("settings", {
        userId: user._id,
        ...DEFAULTS,
        ...args,
        updatedAt: Date.now(),
      });
      return;
    }

    await ctx.db.patch(existing._id, { ...args, updatedAt: Date.now() });
  },
});

