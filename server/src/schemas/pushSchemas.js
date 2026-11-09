import { z } from "zod";

export const subscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
});

export const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
});
