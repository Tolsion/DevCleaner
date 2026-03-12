import { z } from 'zod';

export const ScanStartSchema = z.object({
  roots: z.array(z.string().min(1)).min(1),
  targets: z.array(z.string().min(1)).optional(),
  ignore: z.array(z.string().min(1)).optional()
});

export type ScanStartInput = z.infer<typeof ScanStartSchema>;
