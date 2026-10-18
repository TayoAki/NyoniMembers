import { ATELIER_LIMITS } from "./enums";

/**
 * House facts the Atelier quotes. Everything under `verified` is the site's own copy (nyonicouture.com,
 * read 18 October 2026, and docs/01-brand-brief.md). Everything under `proposed` is the app's own
 * operating rule and must be confirmed by the house before the affected feature is promised to a client.
 */
export const HOUSE_POLICY = {
  verified: {
    leadTime: "Your suit is made to order and is typically ready in about six weeks from your first fitting.",
    rush: "Rush timelines can sometimes be arranged for weddings and special events.",
    fittings:
      "Your process includes a private consultation with full measurements and a final fitting to perfect the result before delivery, with additional fittings if your garment needs them.",
    alterations:
      "Adjustments are part of the service. If anything needs refining after your final fitting, we will make it right until the agreed fit is achieved.",
    finalSale:
      "Upon confirmation of all bespoke clothing design at the time of placing the order, the design is final. Custom and bespoke items are final sale.",
    refunds:
      "No refunds. Exchanges only within 10 days of purchase. Store credit is offered for an extremely ill-fitting custom suit, or a remake where possible.",
    storeCredit:
      "Store credit can be used for a new custom garment or any other product and must be used within six months of issue; it is not transferable.",
    worldwide: "We dress clients across the country and internationally, with worldwide delivery to your door.",
    memberAlterations: "Complimentary alterations on your suits are a Signature, Prestige and Circle Elite privilege.",
    hours: "Mon–Sat 11am–7pm · Sun 12pm–6pm",
  },
  proposed: {
    photoRetentionDays: ATELIER_LIMITS.previewResultDays,
    quoteValidDays: ATELIER_LIMITS.quoteValidDays,
    responseTime: "A concierge replies within one business day.",
    eventBufferDays: ATELIER_LIMITS.eventBufferDays,
  },
} as const;

/** Bumped whenever the consent or disclosure text below changes; stored on every photo. */
export const CONSENT_VERSION = "2026-10-18.1";

export const PHOTO_CONSENT = {
  title: "See the design on you",
  what: "You can add one full-length photograph of yourself. We use it only to produce an illustrative preview of the suit you are designing.",
  limits: [
    "The preview is an illustration of cloth and cut on your photograph. It is not a fitting and does not measure you.",
    "Shoulder line, drape and length are confirmed only at a fitting with your clothier.",
    "Lighting, pose and the photograph's quality change the result.",
  ],
  provider:
    "The preview is produced by an image model from OpenAI on the house's account. Your photograph is sent for that purpose only and is not used to train models.",
  retention: `Your photograph and previews are kept for ${ATELIER_LIMITS.previewResultDays} days unless you remove them sooner from Privacy. The design itself is kept with your draft.`,
  notUsedFor: "Your photograph is never used for marketing, identity recognition, measurement or anything other than the preview you ask for.",
  suitable: [
    "Full length, head to shoes, standing straight",
    "One person in frame",
    "Even light, a plain background if you can",
    "Close-fitting clothes or a shirt and trousers",
  ],
  unsuitable: ["Group photographs", "Seated or cropped at the knee", "Heavy coats or bags", "Strong backlight or blur"],
} as const;

export const PROVIDER_DISCLOSURE_VERSION = "openai-gpt-image-2.2026-10";

/** Days of making the house needs before an event, and the words for the three readiness states. */
export function eventReadiness(eventDate: number | undefined, now: number): { state: "comfortable" | "tight" | "unlikely" | "none"; daysLeft: number | null; copy: string } {
  if (eventDate === undefined) return { state: "none", daysLeft: null, copy: "" };
  const daysLeft = Math.ceil((eventDate - now) / 86_400_000);
  if (daysLeft < 0) {
    return { state: "unlikely", daysLeft, copy: "Your date has passed. Your concierge can still help you plan the next occasion." };
  }
  if (daysLeft >= ATELIER_LIMITS.eventBufferDays + 14) {
    return { state: "comfortable", daysLeft, copy: `About ${Math.round(daysLeft / 7)} weeks until your date. ${HOUSE_POLICY.verified.leadTime}` };
  }
  if (daysLeft >= ATELIER_LIMITS.eventBufferDays - 7) {
    return { state: "tight", daysLeft, copy: `${daysLeft} days until your date. A first fitting is needed soon; ${HOUSE_POLICY.verified.rush.charAt(0).toLowerCase()}${HOUSE_POLICY.verified.rush.slice(1)}` };
  }
  return { state: "unlikely", daysLeft, copy: `${daysLeft} days until your date is inside the usual six weeks. Your concierge will tell you honestly what is possible before anything is promised.` };
}
