import { z } from 'zod';

export const MacJunkCleanSchema = z.object({
  ids: z.array(z.enum(['caches', 'logs', 'crashReports', 'xcodeDerivedData'])).min(1)
});

export const LargeFileScanSchema = z.object({
  roots: z.array(z.string().min(1)).min(1),
  minBytes: z.number().min(1),
  maxResults: z.number().int().min(1).max(500).optional()
});

export const TerminateProcessSchema = z.object({
  pid: z.number().int().min(2)
});

export const LargeFileDeleteSchema = z.object({
  paths: z.array(z.string().min(1)).min(1),
  roots: z.array(z.string().min(1)).min(1),
  useTrash: z.boolean().optional()
});

export type MacJunkCleanInput = z.infer<typeof MacJunkCleanSchema>;
export type LargeFileScanInput = z.infer<typeof LargeFileScanSchema>;
export type TerminateProcessInput = z.infer<typeof TerminateProcessSchema>;
export type LargeFileDeleteInput = z.infer<typeof LargeFileDeleteSchema>;
