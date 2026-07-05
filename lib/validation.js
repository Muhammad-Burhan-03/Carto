import { z } from 'zod';

// Strong password policy: 8+ chars, at least one uppercase, one lowercase,
// one digit. Special characters allowed but not required (keeps friction
// reasonable for a student/demo project while still being meaningfully
// stronger than the old 6-char-minimum policy).
const strongPassword = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(100)
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a number');

const otpCode = z.string().regex(/^\d{6}$/, 'Code must be 6 digits');

export const schemas = {
  registerUser: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email().max(190),
    password: strongPassword,
    phone: z.string().max(30).optional()
  }),
  registerSeller: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email().max(190),
    password: strongPassword,
    phone: z.string().max(30).optional(),
    packageId: z.enum(['basic', 'standard', 'premium']),
    storeName: z.string().min(2).max(150),
    storeDescription: z.string().max(2000).optional(),
    storeLogo: z.string().min(10).optional()
  }),
  login: z.object({
    email: z.string().email(),
    password: z.string().min(1),
    rememberMe: z.boolean().optional()
  }),
  verifyOtp: z.object({
    email: z.string().email(),
    role: z.enum(['user', 'seller']),
    otp: otpCode
  }),
  resendOtp: z.object({
    email: z.string().email(),
    role: z.enum(['user', 'seller'])
  }),
  forgotPassword: z.object({
    email: z.string().email(),
    role: z.enum(['user', 'seller'])
  }),
  resetPassword: z.object({
    email: z.string().email(),
    role: z.enum(['user', 'seller']),
    otp: otpCode,
    newPassword: strongPassword
  }),
  updateProfile: z.object({
    name: z.string().min(2).max(120).optional(),
    phone: z.string().max(30).optional()
  }),
  address: z.object({
    label: z.string().max(60).optional(),
    fullAddress: z.string().min(5).max(500),
    city: z.string().min(2).max(100),
    phone: z.string().max(30).optional(),
    isDefault: z.boolean().optional()
  }),
  product: z.object({
    name: z.string().min(2).max(200),
    description: z.string().max(5000).optional(),
    price: z.number().positive(),
    discount: z.number().min(0).max(100).optional(),
    stock: z.number().int().min(0),
    rating: z.number().min(0).max(5).optional(),
    image: z.string().min(10).optional(),
    category: z.string().max(80).optional(),
    brandId: z.number().int().optional()
  }),
  cartItem: z.object({
    productId: z.number().int(),
    quantity: z.number().int().min(1).max(999).optional()
  }),
  wishlistItem: z.object({
    productId: z.number().int()
  }),
  checkout: z.object({
    addressId: z.number().int(),
    paymentMethod: z.enum(['card', 'cod', 'wallet']).default('cod')
  }),
  review: z.object({
    productId: z.number().int(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(2000).optional()
  }),
  contact: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    subject: z.string().max(200).optional(),
    message: z.string().min(5).max(5000)
  }),
  newsletter: z.object({
    email: z.string().email()
  })
};

/** Express middleware factory: validates req.body against a schema, 400s on failure. */
export function validate(schemaKey) {
  const schema = schemas[schemaKey];
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }))
      });
    }
    req.validated = result.data;
    next();
  };
}
