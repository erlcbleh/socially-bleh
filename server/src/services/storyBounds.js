import { parseRelationshipPageQuery } from "../utils/relationshipPagination.js";

export const MAX_ACTIVE_STORIES_PER_AUTHOR = 20;
export const MAX_STORY_FEED_AUTHOR_PAGE_SIZE = 25;

export function parseStoryFeedPageQuery(query = {}) {
  const page = parseRelationshipPageQuery(query);
  return { ...page, limit: Math.min(page.limit, MAX_STORY_FEED_AUTHOR_PAGE_SIZE) };
}

export function boundNewestStories(newestFirst, limit = MAX_ACTIVE_STORIES_PER_AUTHOR) {
  return {
    stories: newestFirst.slice(0, limit).reverse(),
    truncated: newestFirst.length > limit,
  };
}
