import { z } from 'zod';

export const schemas = {
  registerUser: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email().max(190),
    password: z.string().min(6).max(100),
    phone: z.string().max(30).optional()
  }),
  registerSeller: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email().max(190),
    password: z.string().min(6).max(100),
    phone: z.string().max(30).optional(),
    packageId: z.enum(['basic', 'standard', 'premium']),
    storeName: z.string().min(2).max(150),
    storeDescription: z.string().max(2000).optional(),
    storeLogo: z.string().url().optional()
  }),
  login: z.object({
    email: z.string().email(),
    password: z.string().min(1)
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
    image: z.string().url().optional(),
    categoryId: z.number().int().optional(),
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
