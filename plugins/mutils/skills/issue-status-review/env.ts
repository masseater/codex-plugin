import * as v from "valibot";

const EnvSchema = v.object({
  GITHUB_TOKEN: v.pipe(v.string(), v.minLength(1)),
});

/**
 * Parse and validate the environment the scripts need. Called lazily so that
 * importing a script module (for unit tests) does not require GITHUB_TOKEN.
 *
 * @returns The validated environment with a non-empty `GITHUB_TOKEN`.
 */
export function getEnv(): { GITHUB_TOKEN: string } {
  return v.parse(EnvSchema, process.env);
}
