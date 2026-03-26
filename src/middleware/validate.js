/**
 * ─── Request Validation Middleware ───────────────────────────────────────────
 *
 * Validates req.body / req.query / req.params against a Joi schema.
 *
 * Usage:
 *   import Joi from "joi";
 *   import { validate } from "../middleware/validate.js";
 *
 *   const createUserSchema = Joi.object({
 *     name:  Joi.string().required(),
 *     email: Joi.string().email().required(),
 *   });
 *
 *   router.post("/users", validate(createUserSchema), controller.create);
 */

/**
 * @param {import("joi").ObjectSchema} schema - Joi schema
 * @param {"body"|"query"|"params"} source - part of the request to validate
 */
export function validate(schema, source = "body") {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map((d) => d.message).join("; ");
      return res.status(422).json({ success: false, message: messages });
    }

    req[source] = value;
    next();
  };
}
