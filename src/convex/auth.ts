import { ConvexError } from "convex/values";
import { MutationCtx, QueryCtx } from "./_generated/server";

export async function getUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("You must be logged in to access this resource.");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("externalId", (q) => q.eq("externalId", identity.subject))
    .first();

  if (!user) {
    throw new ConvexError("User not found");
  }

  return user;
}
