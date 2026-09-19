import { z } from 'zod';

export const usernameSchema = z.string().trim().min(3).max(60).regex(/^[A-Za-z0-9._-]+$/, 'Username invalide');
export const passwordSchema = z.string().min(8).max(200);

const optionalEmailSchema = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? null : value,
  z.string().trim().email().nullable().optional()
);

export const loginSchema = z.object({ username: usernameSchema, password: passwordSchema });

export const participationConfirmSchema = z.object({
  localBureauId: z.string().uuid(),
  delta: z.number().int().min(-10000).max(10000).refine(v => v !== 0, 'delta must not be 0'),
  operationUuid: z.string().uuid(),
  deviceId: z.string().min(8).max(200)
});

export const RESULT_CATEGORY_CODES = ['PAM', 'PI', 'RNI', 'PJD', 'USFP', 'MP', 'REJECTED'] as const;
export const resultCategoryCodeSchema = z.enum(RESULT_CATEGORY_CODES);
const voteValueSchema = z.number().int().min(0).max(1_000_000);

export const resultValuesSchema = z.object({
  PAM: voteValueSchema,
  PI: voteValueSchema,
  RNI: voteValueSchema,
  PJD: voteValueSchema,
  USFP: voteValueSchema,
  MP: voteValueSchema,
  REJECTED: voteValueSchema
}).strict();

export const bureauResultSchema = z.object({
  localBureauId: z.string().uuid(),
  results: resultValuesSchema,
  operationUuid: z.string().uuid()
});

export const presenceSchema = z.object({
  connectionStatus: z.enum(['CONNECTED', 'OFFLINE', 'BACKGROUND']).default('CONNECTED')
});

export const correctionRequestSchema = z.object({
  submissionId: z.string().uuid(),
  categoryCode: resultCategoryCodeSchema,
  proposedVotes: voteValueSchema,
  reason: z.string().trim().min(3).max(1000)
});

export const correctionResolveSchema = z.object({ approve: z.boolean() });
export const electionModeSchema = z.object({ mode: z.enum(['PREPARATION', 'VOTING', 'COUNTING', 'COMPLETED']) });

export const localBureauCreateSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(500).optional().nullable()
});

export const localBureauUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  address: z.string().trim().max(500).optional().nullable(),
  active: z.boolean().optional()
}).refine(v => Object.keys(v).length > 0, 'Aucune modification');

export const appRoleSchema = z.enum(['OBSERVER', 'REGIONAL_ADMIN']);

export const userCreateSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(2).max(200),
  role: appRoleSchema,
  localBureauId: z.string().uuid().optional().nullable(),
  phone: z.preprocess(v => typeof v === 'string' && v.trim() === '' ? null : v, z.string().trim().max(50).optional().nullable()),
  email: optionalEmailSchema,
  active: z.boolean().default(true)
}).superRefine((v, ctx) => {
  if (v.role === 'OBSERVER' && !v.localBureauId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['localBureauId'], message: 'Bureau local obligatoire pour un observateur' });
  if (v.role === 'REGIONAL_ADMIN' && v.localBureauId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['localBureauId'], message: 'Un administrateur régional ne doit pas être affecté à un bureau local' });
});

export const userUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(200).optional(),
  phone: z.preprocess(v => typeof v === 'string' && v.trim() === '' ? null : v, z.string().trim().max(50).optional().nullable()),
  email: optionalEmailSchema,
  localBureauId: z.string().uuid().optional().nullable(),
  active: z.boolean().optional()
}).refine(v => Object.keys(v).length > 0, 'Aucune modification');

export const resetPasswordSchema = z.object({ password: passwordSchema });
export const changePasswordSchema = z.object({ currentPassword: passwordSchema, newPassword: passwordSchema });

export const importObserverRowSchema = z.object({
  bureauCode: z.string().trim().min(1).max(80),
  bureauName: z.string().trim().min(1).max(200),
  bureauAddress: z.string().trim().max(500).optional().nullable(),
  username: usernameSchema,
  password: passwordSchema,
  observerName: z.string().trim().min(2).max(200),
  phone: z.preprocess(v => typeof v === 'string' && v.trim() === '' ? null : v, z.string().trim().max(50).optional().nullable()),
  email: optionalEmailSchema
});
export const importObserversSchema = z.object({ rows: z.array(importObserverRowSchema).min(1).max(2000) });

export type ParticipationConfirmInput = z.infer<typeof participationConfirmSchema>;
export type ResultCategoryCode = z.infer<typeof resultCategoryCodeSchema>;
export type ResultValues = z.infer<typeof resultValuesSchema>;
export type BureauResultInput = z.infer<typeof bureauResultSchema>;
export type PresenceInput = z.infer<typeof presenceSchema>;
export type ElectionMode = z.infer<typeof electionModeSchema>['mode'];
