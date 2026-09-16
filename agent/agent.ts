import { defineAgent } from "eve";

/**
 * The Fitcheck stylist. Routed through the Vercel AI Gateway, so the runtime needs
 * `AI_GATEWAY_API_KEY` (or a linked Vercel project supplying `VERCEL_OIDC_TOKEN`).
 *
 * Sandbox, shell and file tools are disabled one file at a time under `agent/tools/`
 * so the framework defaults this agent does need — `ask_question` and `load_skill` — stay on.
 */
export default defineAgent({
  model: "openai/gpt-5.4-mini",
  reasoning: "low",
});
