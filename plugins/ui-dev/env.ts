import * as v from "valibot";

const EnvSchema = v.object({
  FIGMA_ACCESS_TOKEN: v.optional(v.pipe(v.string(), v.minLength(1))),
});

export const env = v.parse(EnvSchema, process.env);
