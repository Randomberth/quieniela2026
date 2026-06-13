/**
 * Comprehensive validation schemas using Zod.
 * 
 * Provides client-side validation for all user inputs with:
 * - Type safety
 * - Custom error messages (user-friendly)
 * - Business rule enforcement
 * - XSS protection through sanitization
 */

import { z } from 'zod';

// ─── Base Schemas ────────────────────────────────────────────────

/** Integer between 0-99 (valid score range) */
export const ScoreSchema = z.number()
  .int('Los goles deben ser números enteros')
  .min(0, 'Los goles no pueden ser negativos')
  .max(99, 'Los goles no pueden exceder 99 por equipo')
  .brand<'Score'>();

/** ISO date string validation */
export const ISODateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/, 'Fecha inválida')
  .refine((date) => !isNaN(Date.parse(date)), 'Fecha inválida');

/** Non-empty trimmed string with length limits */
export const SafeStringSchema = (min: number = 1, max: number = 500) =>
  z.string()
    .min(min, `Debe tener al menos ${min} caracteres`)
    .max(max, `No puede exceder ${max} caracteres`)
    .trim()
    .refine((str) => !str.includes('<') && !str.includes('>'), 'Caracteres no permitidos');

/** Email validation with sanitization */
export const EmailSchema = z.string()
  .email('Correo electrónico inválido')
  .max(254, 'Correo electrónico demasiado largo')
  .toLowerCase()
  .trim()
  .refine((email) => !email.includes('<') && !email.includes('>'), 'Caracteres no permitidos');

/** Password validation */
export const PasswordSchema = z.string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(100, 'Contraseña demasiado larga')
  .refine((pwd) => /[A-Z]/.test(pwd), 'Debe incluir al menos una mayúscula')
  .refine((pwd) => /[a-z]/.test(pwd), 'Debe incluir al menos una minúscula')
  .refine((pwd) => /\d/.test(pwd), 'Debe incluir al menos un número')
  .refine((pwd) => !pwd.includes('<') && !pwd.includes('>'), 'Caracteres no permitidos');

/** Username validation */
export const UsernameSchema = z.string()
  .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
  .max(30, 'El nombre de usuario no puede exceder 30 caracteres')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Solo letras, números, puntos, guiones y guiones bajos')
  .toLowerCase()
  .trim();

// ─── Domain Schemas ──────────────────────────────────────────────

/** Prediction input schema */
export const PredictionInputSchema = z.object({
  match_id: z.string().uuid('ID de partido inválido'),
  home_score: ScoreSchema,
  away_score: ScoreSchema,
});

/** Match filter schema (for filtering/querying) */
export const MatchFilterSchema = z.object({
  phase: z.enum(['group', 'round_of_32', 'round_of_16', 'quarter', 'semi', 'third_place', 'final']).optional(),
  status: z.enum(['pending', 'live', 'finished']).optional(),
  date_from: ISODateSchema.optional(),
  date_to: ISODateSchema.optional(),
  team_id: z.string().uuid('ID de equipo inválido').optional(),
}).refine(
  (data) => !(data.date_from && data.date_to) || new Date(data.date_from!) <= new Date(data.date_to!),
  { message: 'La fecha de inicio debe ser anterior o igual a la fecha de fin', path: ['date_to'] }
);

/** User profile update schema */
export const UserProfileUpdateSchema = z.object({
  username: UsernameSchema,
  full_name: SafeStringSchema(1, 100).nullable().optional(),
  preferred_language: z.enum(['es', 'en']).default('es'),
  avatar_url: z.string().url('URL inválida').nullable().optional(),
}).strict();

/** Authentication schemas */
export const SignUpSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  username: UsernameSchema,
}).strict();

export const SignInSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'La contraseña es requerida'),
}).strict();

/** Leaderboard filter schema */
export const LeaderboardFilterSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  min_predictions: z.number().int().min(0).optional(),
}).strict();

// ─── Validation Functions ────────────────────────────────────────

/**
 * Safe validation wrapper that catches Zod errors and returns user-friendly messages.
 * Returns { success: true, data: validated } or { success: false, error: string }
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      // Extract first error message for user display
      const firstError = result.error.format()._errors[0];
      return {
        success: false,
        error: firstError || 'Validación fallida',
      };
    }
  } catch (error) {
    // Catch unexpected errors (shouldn't happen with safeParse)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error de validación inesperado',
    };
  }
}

/**
 * Validate prediction scores with Zod.
 * Returns user-friendly error message or null if valid.
 */
export function validatePredictionScoresZod(
  homeScore: number,
  awayScore: number
): string | null {
  const result = PredictionInputSchema.shape.home_score
    .and(PredictionInputSchema.shape.away_score)
    .safeParse({ home_score: homeScore, away_score: awayScore });
  
  if (!result.success) {
    return result.error.format()._errors[0] || 'Goles inválidos';
  }
  return null;
}

/**
 * Sanitize user input to prevent XSS.
 * Removes dangerous HTML/script tags and limits length.
 */
export function sanitizeInput(input: string, maxLength = 500): string {
  if (typeof input !== 'string') return '';
  
  // Trim and limit length
  let sanitized = input.trim().slice(0, maxLength);
  
  // Encode special HTML characters
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  
  return sanitized;
}

/**
 * Sanitize object properties recursively.
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  maxLength = 500
): T {
  const sanitized = { ...obj };
  
  // Helper function to sanitize URLs
  const sanitizeURL = (url: string): string => {
    try {
      const parsed = new URL(url);
      const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
      if (!safeProtocols.includes(parsed.protocol.toLowerCase())) {
        return '';
      }
      if (parsed.href.toLowerCase().includes('javascript:')) {
        return '';
      }
      return parsed.toString();
    } catch {
      // Not a valid URL
      return sanitizeInput(url, maxLength);
    }
  };
  
  for (const key in sanitized) {
    const value = sanitized[key];
    if (typeof value === 'string') {
      // Special handling for URL fields
      if (key.includes('url') || key.includes('href') || key.includes('src')) {
        sanitized[key] = sanitizeURL(value) as any;
      } else {
        sanitized[key] = sanitizeInput(value, maxLength) as any;
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>, maxLength) as any;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeInput(item, maxLength) : item
      ) as any;
    }
  }
  
  return sanitized;
}

// ─── Type Inference ──────────────────────────────────────────────

export type Score = z.infer<typeof ScoreSchema>;
export type PredictionInput = z.infer<typeof PredictionInputSchema>;
export type MatchFilter = z.infer<typeof MatchFilterSchema>;
export type UserProfileUpdate = z.infer<typeof UserProfileUpdateSchema>;
export type SignUpInput = z.infer<typeof SignUpSchema>;
export type SignInInput = z.infer<typeof SignInSchema>;
export type LeaderboardFilter = z.infer<typeof LeaderboardFilterSchema>;