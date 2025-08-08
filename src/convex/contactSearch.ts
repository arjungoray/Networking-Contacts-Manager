import { v } from "convex/values";
import { query } from "./_generated/server";
import { getUser } from "./auth";

export const searchContacts = query({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    if (!user) {
      return [];
    }

    if (!args.query) {
      return await ctx.db
        .query("contacts")
        .withIndex("userId", (q) => q.eq("userId", user._id))
        .collect();
    }

    // Since we can't search multiple fields at once, we'll search the 'name' field,
    // which is the most common use case. For a more comprehensive search,
    // a denormalized 'searchText' field would be recommended.
    return await ctx.db
      .query("contacts")
      .withSearchIndex("search_summary", (q) =>
        q.search("searchSummary", args.query).eq("userId", user._id),
      )
      .collect();
  },
});
