import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const createPostSchema = z.object({
  content: z.string().max(500).optional().default(""),
  gifUrl: z.string().max(500).optional().nullable(),
  mediaUrl: z.string().max(500).optional().nullable(),
  mediaType: z.enum(["image", "video"]).optional().nullable(),
  parentPost: objectId.optional().nullable(),
  quotedPost: objectId.optional().nullable(),
  poll: z
    .object({
      options: z.array(z.string()).optional(),
      durationMinutes: z.number().optional(),
    })
    .optional()
    .nullable(),
});
