import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { isValidGuestKey, randomToken } from "../atelier/access";
import { optionalEnv } from "../lib/env";
import { appError } from "../lib/errors";
import { ensureCatalogueSeeded } from "../model/atelier/catalogue";
import { planSteps, PROVIDER_RETENTION_EXCEPTION } from "../model/atelier/privacy";
import { clothSeedByCode } from "../shared/atelier/cloths";
import {
  CASE_KIND_LABELS,
  FIT_REGIONS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATE_LABELS,
  STAFF_ROLES,
  type AppointmentPeriod,
  type AppointmentService,
  type CaseStatus,
  type ChecklistState,
  type CorrectionKind,
  type CorrectionStatus,
  type FitRegion,
  type GroupStatus,
  type MessageAuthor,
  type MilestoneSource,
  type Occasion,
  type OrderStatus,
  type ParticipantStatus,
  type PrivacyKind,
  type PrivacyStatus,
  type RemedyCoverage,
  type StaffRole,
  type StudioStep,
} from "../shared/atelier/enums";
import { LOOKS, type Look } from "../shared/atelier/looks";
import { HOUSE_POLICY } from "../shared/atelier/policy";
import { CANVAS_OPTIONS, completedStepsFor, specHash, type SuitSpec } from "../shared/atelier/spec";
import type {
  vContact,
  vParticipantConsent,
  vPreferredWindow,
  vPrivacyStep,
  vQuoteLine,
} from "../shared/atelier/validators";

/**
 * Dev-only fixtures for reviewing the Atelier's screens before a real client exists:
 *
 *   npx convex env set ALLOW_DEV_SMOKE 1
 *   npx convex run dev/atelier_fixtures:seedScenario '{"guestKey":"0123456789abcdef0123456789abcdef"}'
 *
 * One run writes a whole guest-owned scenario (a design in progress, one submitted with a quote
 * offered, one in the making, one delivered with a correction open, two fittings, a share link, a
 * privacy request and a wedding party) and returns every id with the paths to open. Each run makes a
 * fresh scenario; only the stand-in staff member is reused. Like `smoke.ts`, it refuses unless
 * ALLOW_DEV_SMOKE=1 is set on the deployment, which production never sets.
 *
 * `scenarioPlan` is pure (timestamps and words only) so the shape of the scenario can be unit-tested
 * without a deployment: tests/atelier-fixtures.test.mjs.
 */

const ALLOW_DEV_SMOKE = "ALLOW_DEV_SMOKE";

function assertFixturesEnabled(): void {
  if (optionalEnv(ALLOW_DEV_SMOKE) !== "1") {
    throw appError("FORBIDDEN", "Dev fixtures are disabled. Set ALLOW_DEV_SMOKE=1 on this deployment.");
  }
}

// ---------------------------------------------------------------------------------------------
// Pure plan: every timestamp and every word the scenario uses, derived from one `now`.
// ---------------------------------------------------------------------------------------------

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
export const DEV_STAFF_CLERK_ID = "dev-staff";
export const SCENARIO_TIME_ZONE = "America/New_York";

type Contact = Infer<typeof vContact>;
type QuoteLine = Infer<typeof vQuoteLine>;
type PrivacyStep = Infer<typeof vPrivacyStep>;
type PreferredWindow = Infer<typeof vPreferredWindow>;
type ParticipantConsent = Infer<typeof vParticipantConsent>;

export type PlannedMilestone = {
  kind: string;
  label: string;
  at: number;
  source: MilestoneSource;
  estimated: boolean;
  note?: string;
};
export type PlannedMessage = { author: MessageAuthor; body: string; at: number; carriesProposal?: boolean };
export type PlannedQuote = {
  version: number;
  lines: QuoteLine[];
  subtotalUsd: number;
  totalUsd: number;
  leadTimeWeeks: number;
  fittingsIncluded: number;
  terms: string;
  createdAt: number;
  offeredAt: number;
  expiresAt: number;
  acceptedAt?: number;
};
export type PlannedParticipant = {
  name: string;
  email: string;
  status: ParticipantStatus;
  consent: ParticipantConsent;
  joinedAt?: number;
};

export type ScenarioPlan = {
  now: number;
  staff: { clerkId: string; name: string; email: string; staffRoles: readonly StaffRole[] };
  client: Contact;
  inProgress: {
    look: Look;
    occasion: Occasion;
    eventDate: number;
    shortlist: string[];
    stage: StudioStep;
    completedSteps: StudioStep[];
    revision: number;
    createdAt: number;
    updatedAt: number;
    share: { audience: string; createdAt: number; expiresAt: number };
  };
  submitted: {
    look: Look;
    occasion: Occasion;
    eventDate: number;
    revision: number;
    completedSteps: StudioStep[];
    createdAt: number;
    submittedAt: number;
    assignedAt: number;
    nextAction: string;
    caseStatus: CaseStatus;
    messages: PlannedMessage[];
    proposal: { afterSpec: SuitSpec; rationale: string; createdAt: number };
    quote: PlannedQuote;
    lastActivityAt: number;
  };
  ordered: {
    look: Look;
    occasion: Occasion;
    eventDate: number;
    revision: number;
    createdAt: number;
    submittedAt: number;
    caseStatus: CaseStatus;
    quote: PlannedQuote;
    order: {
      status: OrderStatus;
      createdAt: number;
      paymentConfirmedAt: number;
      releasedAt: number;
      estimatedReadyAt: number;
      makerRef: string;
    };
    milestones: PlannedMilestone[];
  };
  delivered: {
    look: Look;
    occasion: Occasion;
    eventDate: number;
    revision: number;
    createdAt: number;
    submittedAt: number;
    quote: PlannedQuote;
    order: {
      status: OrderStatus;
      createdAt: number;
      paymentConfirmedAt: number;
      releasedAt: number;
      shippedAt: number;
      carrier: string;
      trackingRef: string;
      deliveredAt: number;
      checklist: Record<FitRegion, ChecklistState>;
    };
    milestones: PlannedMilestone[];
    correction: {
      kind: CorrectionKind;
      region: FitRegion;
      description: string;
      status: CorrectionStatus;
      requestedAt: number;
      updatedAt: number;
      remedy: { kind: CorrectionKind; coverage: RemedyCoverage; logistics: string; deadline: number };
      messages: PlannedMessage[];
    };
  };
  appointments: {
    fitting: {
      service: AppointmentService;
      showroomId: "charlotte";
      windows: PreferredWindow[];
      timeZone: string;
      requestedAt: number;
      notes: string;
    };
    consultation: {
      service: AppointmentService;
      showroomId: "atlanta";
      timeZone: string;
      requestedAt: number;
      confirmedAt: number;
      confirmedStart: number;
      confirmedEnd: number;
      window: PreferredWindow;
    };
  };
  privacy: {
    kind: PrivacyKind;
    status: PrivacyStatus;
    requestedAt: number;
    steps: PrivacyStep[];
    exceptions: string[];
  };
  group: {
    name: string;
    occasion: Occasion;
    eventDate: number;
    brief: string;
    sharedSpec: SuitSpec;
    permittedIndividual: string[];
    status: GroupStatus;
    createdAt: number;
    updatedAt: number;
    participants: PlannedParticipant[];
  };
  notifications: { subject: string; body: string; at: number }[];
};

/**
 * A photograph removal as the real plan runs it for a browser: every step settled, the provider's own retention
 * disclosed as the one exception, so the request reads "Completed with exceptions" and has nothing left to run.
 */
function privacyStepsSettled(requestedAt: number): PrivacyStep[] {
  const outcomes: Record<string, Pick<PrivacyStep, "status" | "note"> & { after: number }> = {
    revoke_preview_links: { status: "done", note: "1 preview result withdrawn", after: 60_000 },
    cancel_preview_jobs: { status: "done", note: "No preview job was waiting", after: 60_000 },
    delete_photos: { status: "done", note: "1 photograph deleted", after: 5 * 60_000 },
    delete_fit_photos: {
      status: "done",
      note: "Posture photographs belong to an account; this browser holds none.",
      after: 5 * 60_000,
    },
    notify_provider: { status: "exception", note: PROVIDER_RETENTION_EXCEPTION, after: 6 * 60_000 },
  };
  return planSteps("delete_photos").map((step) => {
    const outcome = outcomes[step.key];
    if (!outcome) throw new Error(`The fixture has no outcome for privacy step ${step.key}.`);
    return { ...step, status: outcome.status, note: outcome.note, at: requestedAt + outcome.after };
  });
}

export function utcNoon(ms: number): number {
  const day = new Date(ms);
  return Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 12);
}

/** Noon UTC of the Monday after this week's; the same calendar day in every US time zone. */
export function nextWeekMonday(now: number): number {
  const today = utcNoon(now);
  const weekday = new Date(today).getUTCDay();
  const daysToMonday = (8 - weekday) % 7 || 7;
  return today + daysToMonday * DAY_MS;
}

function nthSundayUtc(year: number, month: number, n: number): number {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return Date.UTC(year, month, 1 + ((7 - firstWeekday) % 7) + (n - 1) * 7);
}

/** US rule since 2007: daylight time from the second Sunday in March to the first Sunday in November, 2am local. */
export function newYorkUtcOffsetHours(utcMs: number): number {
  const year = new Date(utcMs).getUTCFullYear();
  const daylightStart = nthSundayUtc(year, 2, 2) + 7 * HOUR_MS;
  const daylightEnd = nthSundayUtc(year, 10, 1) + 6 * HOUR_MS;
  return utcMs >= daylightStart && utcMs < daylightEnd ? -4 : -5;
}

/** The instant at `hour` o'clock on the New York wall clock, on the calendar day `dayUtcNoon` falls on. */
export function newYorkInstant(dayUtcNoon: number, hour: number): number {
  const day = new Date(dayUtcNoon);
  const wall = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour);
  return wall - newYorkUtcOffsetHours(wall + 5 * HOUR_MS) * HOUR_MS;
}

export function quoteTotals(lines: readonly QuoteLine[]): { subtotalUsd: number; totalUsd: number } {
  const subtotalUsd = lines
    .filter((line) => line.kind !== "tax" && line.kind !== "shipping")
    .reduce((sum, line) => sum + line.amountUsd, 0);
  const totalUsd = lines.reduce((sum, line) => sum + line.amountUsd, 0);
  return { subtotalUsd, totalUsd };
}

function lookAt(index: number): Look {
  const look = LOOKS[index];
  if (!look) throw new Error(`LOOKS[${index}] is missing; the fixture scenario expects at least six looks.`);
  return look;
}

function clothName(code: string | null): string {
  return (code ? clothSeedByCode(code)?.name : undefined) ?? code ?? "Cloth";
}

const FULL_CANVAS = CANVAS_OPTIONS.find((option) => option.code === "full");

function quoteFor(
  spec: SuitSpec,
  commissionUsd: number,
  at: { createdAt: number; offeredAt: number; expiresAt: number; acceptedAt?: number },
  withFullCanvas: boolean,
): PlannedQuote {
  const lines: QuoteLine[] = [
    { code: "COMMISSION", label: "Made-to-measure commission", amountUsd: commissionUsd, kind: "commission" },
    { code: spec.clothCode ?? "CLOTH", label: `${clothName(spec.clothCode)} · included`, amountUsd: 0, kind: "cloth" },
  ];
  if (withFullCanvas)
    lines.push({
      code: FULL_CANVAS?.productionId ?? "CANVAS_FULL",
      label: FULL_CANVAS?.label ?? "Full canvas",
      amountUsd: 180,
      kind: "option",
    });
  return {
    version: 1,
    lines,
    ...quoteTotals(lines),
    leadTimeWeeks: 6,
    fittingsIncluded: 2,
    terms: HOUSE_POLICY.verified.finalSale,
    ...at,
  };
}

function checklistWithIssue(region: FitRegion): Record<FitRegion, ChecklistState> {
  return Object.fromEntries(FIT_REGIONS.map((key) => [key, key === region ? "issue" : "ok"])) as Record<
    FitRegion,
    ChecklistState
  >;
}

export function scenarioPlan(now: number): ScenarioPlan {
  const armada = lookAt(0);
  const leonardo = lookAt(2);
  const dominico = lookAt(3);
  const giorgio = lookAt(5);
  const monday = nextWeekMonday(now);
  const tuesday = monday + DAY_MS;
  const wednesday = monday + 2 * DAY_MS;
  const client: Contact = {
    name: "Marcus Thompson",
    email: "marcus@example.test",
    channel: "email",
    preferredShowroom: "atlanta",
  };

  const submittedAtB = now - 3 * DAY_MS;
  const quoteOfferedAtB = now - 20 * HOUR_MS;
  const proposalSpec: SuitSpec = { ...dominico.spec, jacket: { ...dominico.spec.jacket, vents: "none" } };

  const submittedAtC = now - 35 * DAY_MS;
  const acceptedAtC = now - 30 * DAY_MS;
  const releasedAtC = now - 28 * DAY_MS;
  const estimatedReadyAtC = now + 28 * DAY_MS;

  const submittedAtD = now - 110 * DAY_MS;
  const acceptedAtD = now - 100 * DAY_MS;
  const releasedAtD = now - 98 * DAY_MS;
  const shippedAtD = now - 10 * DAY_MS;
  const deliveredAtD = now - 7 * DAY_MS;
  const correctionRequestedAtD = now - 5 * DAY_MS;
  const remedyProposedAtD = now - 3 * DAY_MS;

  const privacyRequestedAt = now - 2 * DAY_MS;

  return {
    now,
    staff: {
      clerkId: DEV_STAFF_CLERK_ID,
      name: "Adaeze Nwosu",
      email: "staff@nyonicouture.test",
      staffRoles: STAFF_ROLES,
    },
    client,
    inProgress: {
      look: armada,
      occasion: "wedding",
      eventDate: now + 90 * DAY_MS,
      shortlist: [
        armada.spec.clothCode ?? "taveller-4-seasons",
        "loro-piana-365-s-130s-wool",
        "vitale-barberis-perennial",
      ],
      stage: "style",
      completedSteps: ["occasion", "cloth", "style"],
      revision: 3,
      createdAt: now - 2 * DAY_MS,
      updatedAt: now - HOUR_MS,
      share: { audience: "Best man", createdAt: now - HOUR_MS, expiresAt: now + 7 * DAY_MS },
    },
    submitted: {
      look: dominico,
      occasion: "black_tie",
      eventDate: now + 60 * DAY_MS,
      revision: 5,
      completedSteps: completedStepsFor(dominico.spec, {
        occasionSet: true,
        previewDone: false,
        fitRouteSet: true,
      }) as StudioStep[],
      createdAt: now - 10 * DAY_MS,
      submittedAt: submittedAtB,
      assignedAt: submittedAtB + 2 * HOUR_MS,
      nextAction: "Prepare quote",
      caseStatus: "assigned",
      messages: [
        {
          author: "system",
          body: `${CASE_KIND_LABELS.quote} received. A concierge will take it up and you will see their name here.`,
          at: submittedAtB,
        },
        {
          author: "staff",
          body: "Marcus, I have your design in front of me. The Zegna 15 Milmil 15 drapes beautifully, and on a double-breasted jacket I would close the back: no vents keeps the line clean when you button it. I have attached the change for you to accept or decline, and your quote follows.",
          at: now - 2 * DAY_MS,
          carriesProposal: true,
        },
        {
          author: "client",
          body: "Thank you. That makes sense to me; I will look at the quote tonight.",
          at: now - DAY_MS,
        },
      ],
      proposal: {
        afterSpec: proposalSpec,
        rationale:
          "The 15 Milmil 15 is a light, fluid cloth. On a double-breasted jacket, side vents in a cloth with this drape tend to flare when you sit; a ventless back holds the line and suits the formality of the evening.",
        createdAt: now - 2 * DAY_MS,
      },
      quote: quoteFor(
        dominico.spec,
        2850,
        { createdAt: quoteOfferedAtB - HOUR_MS, offeredAt: quoteOfferedAtB, expiresAt: now + 14 * DAY_MS },
        true,
      ),
      lastActivityAt: quoteOfferedAtB,
    },
    ordered: {
      look: leonardo,
      occasion: "business",
      eventDate: now + 40 * DAY_MS,
      revision: 2,
      createdAt: now - 40 * DAY_MS,
      submittedAt: submittedAtC,
      caseStatus: "awaiting_client",
      quote: quoteFor(
        leonardo.spec,
        clothSeedByCode(leonardo.spec.clothCode ?? "")?.priceUsd ?? 1875,
        {
          createdAt: now - 33 * DAY_MS,
          offeredAt: now - 33 * DAY_MS,
          expiresAt: now - 19 * DAY_MS,
          acceptedAt: acceptedAtC,
        },
        false,
      ),
      order: {
        status: "making",
        createdAt: acceptedAtC,
        paymentConfirmedAt: now - 29 * DAY_MS,
        releasedAt: releasedAtC,
        estimatedReadyAt: estimatedReadyAtC,
        makerRef: "CLT-2026-0417",
      },
      milestones: [
        { kind: "quote_accepted", label: "Quote accepted", at: acceptedAtC, source: "client", estimated: false },
        {
          kind: "payment_confirmed",
          label: PAYMENT_STATE_LABELS.confirmed,
          at: now - 29 * DAY_MS,
          source: "staff",
          estimated: false,
        },
        { kind: "released", label: ORDER_STATUS_LABELS.released, at: releasedAtC, source: "staff", estimated: false },
        { kind: "cloth_cut", label: "Cloth cut", at: now - 21 * DAY_MS, source: "maker", estimated: false },
        { kind: "estimated_ready", label: "Estimated ready", at: estimatedReadyAtC, source: "system", estimated: true },
      ],
    },
    delivered: {
      look: giorgio,
      occasion: "business",
      eventDate: now + 20 * DAY_MS,
      revision: 2,
      createdAt: now - 120 * DAY_MS,
      submittedAt: submittedAtD,
      quote: quoteFor(
        giorgio.spec,
        clothSeedByCode(giorgio.spec.clothCode ?? "")?.priceUsd ?? 1695,
        {
          createdAt: now - 108 * DAY_MS,
          offeredAt: now - 108 * DAY_MS,
          expiresAt: now - 94 * DAY_MS,
          acceptedAt: acceptedAtD,
        },
        false,
      ),
      order: {
        status: "correction_open",
        createdAt: acceptedAtD,
        paymentConfirmedAt: now - 99 * DAY_MS,
        releasedAt: releasedAtD,
        shippedAt: shippedAtD,
        carrier: "UPS",
        trackingRef: "1Z999AA10123456784",
        deliveredAt: deliveredAtD,
        checklist: checklistWithIssue("jacket_sleeves"),
      },
      milestones: [
        { kind: "quote_accepted", label: "Quote accepted", at: acceptedAtD, source: "client", estimated: false },
        {
          kind: "payment_confirmed",
          label: PAYMENT_STATE_LABELS.confirmed,
          at: now - 99 * DAY_MS,
          source: "staff",
          estimated: false,
        },
        { kind: "released", label: ORDER_STATUS_LABELS.released, at: releasedAtD, source: "staff", estimated: false },
        {
          kind: "shipped",
          label: ORDER_STATUS_LABELS.shipped,
          at: shippedAtD,
          source: "carrier",
          estimated: false,
          note: "UPS 1Z999AA10123456784",
        },
        { kind: "delivered", label: "Delivered", at: deliveredAtD, source: "carrier", estimated: false },
        {
          kind: "correction_opened",
          label: ORDER_STATUS_LABELS.correction_open,
          at: correctionRequestedAtD,
          source: "client",
          estimated: false,
        },
      ],
      correction: {
        kind: "alteration",
        region: "jacket_sleeves",
        description: "Left sleeve sits about 1.5 cm long.",
        status: "remedy_proposed",
        requestedAt: correctionRequestedAtD,
        updatedAt: remedyProposedAtD,
        remedy: {
          kind: "alteration",
          coverage: "included",
          logistics: "Bring the jacket to the Charlotte showroom or we send a prepaid label.",
          deadline: now + 14 * DAY_MS,
        },
        messages: [
          {
            author: "system",
            body: `${CASE_KIND_LABELS.aftercare} received. A concierge will take it up and you will see their name here.`,
            at: correctionRequestedAtD,
          },
          {
            author: "staff",
            body: "Marcus, thank you for the photographs. A 1.5 cm sleeve adjustment is a straightforward alteration and is included in your commission. Bring the jacket to Charlotte when it suits you, or tell me and I will send a prepaid label.",
            at: remedyProposedAtD,
          },
        ],
      },
    },
    appointments: {
      fitting: {
        service: "first_fitting",
        showroomId: "charlotte",
        windows: [
          { date: monday, period: "afternoon" },
          { date: wednesday, period: "morning" },
        ],
        timeZone: SCENARIO_TIME_ZONE,
        requestedAt: now - DAY_MS,
        notes: "Happy to come in with the shoes I will wear.",
      },
      consultation: {
        service: "consultation",
        showroomId: "atlanta",
        timeZone: SCENARIO_TIME_ZONE,
        requestedAt: now - 5 * DAY_MS,
        confirmedAt: now - 4 * DAY_MS,
        confirmedStart: newYorkInstant(tuesday, 14),
        confirmedEnd: newYorkInstant(tuesday, 15),
        window: { date: tuesday, period: "afternoon" satisfies AppointmentPeriod },
      },
    },
    privacy: {
      kind: "delete_photos",
      status: "completed",
      requestedAt: privacyRequestedAt,
      steps: privacyStepsSettled(privacyRequestedAt),
      exceptions: [PROVIDER_RETENTION_EXCEPTION],
    },
    group: {
      name: "Okafor wedding party",
      occasion: "wedding",
      eventDate: now + 120 * DAY_MS,
      brief:
        "Navy two-piece with a peak lapel for the groomsmen. Everyone matches on cloth, lapel and buttons; vents, hem and monogram are your own.",
      sharedSpec: armada.spec,
      permittedIndividual: ["jacket.vents", "trousers.hem", "monogram"],
      status: "inviting",
      createdAt: now - 6 * DAY_MS,
      updatedAt: now - DAY_MS,
      participants: [
        {
          name: "Emeka Okafor",
          email: "emeka@example.test",
          status: "joined",
          consent: { shareStyleStatus: true, shareFitStatus: false },
          joinedAt: now - 4 * DAY_MS,
        },
        {
          name: "Tunde Adeyemi",
          email: "tunde@example.test",
          status: "invited",
          consent: { shareStyleStatus: false, shareFitStatus: false },
        },
        {
          name: "Daniel Reyes",
          email: "daniel@example.test",
          status: "invited",
          consent: { shareStyleStatus: false, shareFitStatus: false },
        },
      ],
    },
    notifications: [
      {
        subject: `Nyoni Couture · ${CASE_KIND_LABELS.quote} received`,
        body: "We have your quote request. Your concierge will be in touch within one business day.",
        at: submittedAtB,
      },
      {
        subject: "Nyoni Couture · Your quote is ready",
        body: "Adaeze has prepared your quote. Open your request to review and approve it.",
        at: quoteOfferedAtB,
      },
    ],
  };
}

/** The client-facing routes of src/lib/routes.ts, with the guest key the preview browser should adopt. */
export type ScenarioRouteIds = {
  draftA: string;
  draftB: string;
  draftC: string;
  draftD: string;
  quoteCase: string;
  aftercareCase: string;
  fittingCase: string;
  orderMaking: string;
  orderCorrection: string;
  fittingRequested: string;
  consultationConfirmed: string;
  shareToken: string;
  inviteToken: string;
};

export type ScenarioPath = { label: string; path: string };

export function scenarioPaths(ids: ScenarioRouteIds, guestKey: string): ScenarioPath[] {
  const guest = (path: string) => `${path}?guest=${guestKey}`;
  return [
    { label: "Design A · in progress (style step)", path: guest(`/atelier/design/${ids.draftA}/style`) },
    { label: "Design B · submitted, quote offered", path: guest(`/atelier/design/${ids.draftB}/review`) },
    { label: "Design C · ordered, in the making", path: guest(`/atelier/design/${ids.draftC}/review`) },
    { label: "Design D · delivered, correction open", path: guest(`/atelier/design/${ids.draftD}/review`) },
    { label: "Request · quote (assigned, proposal, quote offered)", path: guest(`/atelier/requests/${ids.quoteCase}`) },
    { label: "Request · aftercare (remedy proposed)", path: guest(`/atelier/requests/${ids.aftercareCase}`) },
    { label: "Request · fitting (received)", path: guest(`/atelier/requests/${ids.fittingCase}`) },
    { label: "Order · in the making", path: guest(`/atelier/orders/${ids.orderMaking}`) },
    { label: "Order · correction open", path: guest(`/atelier/orders/${ids.orderCorrection}`) },
    { label: "Fitting · requested", path: guest(`/atelier/fittings/${ids.fittingRequested}`) },
    { label: "Consultation · confirmed", path: guest(`/atelier/fittings/${ids.consultationConfirmed}`) },
    { label: "Shared design (Best man)", path: guest(`/atelier/shared/${ids.shareToken}`) },
    { label: "Group invite (Tunde Adeyemi)", path: guest(`/atelier/groups/join/${ids.inviteToken}`) },
  ];
}

// ---------------------------------------------------------------------------------------------
// The mutation: writes the plan with ctx.db.insert, exact schema fields, nothing clever.
// ---------------------------------------------------------------------------------------------

const vSeedResult = v.object({
  staffUserId: v.id("users"),
  catalogueVersion: v.number(),
  draftIds: v.object({
    inProgress: v.id("atelierDrafts"),
    submitted: v.id("atelierDrafts"),
    ordered: v.id("atelierDrafts"),
    delivered: v.id("atelierDrafts"),
  }),
  revisionIds: v.object({
    submitted: v.id("atelierRevisions"),
    ordered: v.id("atelierRevisions"),
    delivered: v.id("atelierRevisions"),
  }),
  caseIds: v.object({
    quote: v.id("atelierCases"),
    orderedQuote: v.id("atelierCases"),
    deliveredQuote: v.id("atelierCases"),
    aftercare: v.id("atelierCases"),
    fitting: v.id("atelierCases"),
  }),
  messageIds: v.array(v.id("atelierCaseMessages")),
  proposalId: v.id("atelierProposals"),
  quoteIds: v.object({
    offered: v.id("atelierQuotes"),
    accepted: v.id("atelierQuotes"),
    delivered: v.id("atelierQuotes"),
  }),
  orderIds: v.object({ making: v.id("atelierOrders"), correctionOpen: v.id("atelierOrders") }),
  milestoneIds: v.array(v.id("atelierOrderMilestones")),
  correctionId: v.id("atelierCorrections"),
  appointmentIds: v.object({ requested: v.id("atelierAppointments"), confirmed: v.id("atelierAppointments") }),
  shareId: v.id("atelierShares"),
  shareToken: v.string(),
  privacyRequestId: v.id("atelierPrivacyRequests"),
  groupId: v.id("atelierGroups"),
  participantIds: v.array(v.id("atelierGroupParticipants")),
  inviteTokens: v.array(v.string()),
  notificationIds: v.array(v.id("atelierNotifications")),
  auditIds: v.array(v.id("atelierAuditLog")),
  paths: v.array(v.object({ label: v.string(), path: v.string() })),
});

export const seedScenario = internalMutation({
  args: { guestKey: v.string(), staffClerkId: v.optional(v.string()) },
  returns: vSeedResult,
  handler: async (ctx, { guestKey, staffClerkId }) => {
    assertFixturesEnabled();
    if (!isValidGuestKey(guestKey)) throw appError("INVALID_INPUT", "guestKey must be 32 lowercase hex characters.");
    const now = Date.now();
    const plan = scenarioPlan(now);
    const owner = { guestKey };
    const catalogueVersion = await ensureCatalogueSeeded(ctx, now);
    const staff = await ensureStaff(ctx, plan, staffClerkId, now);
    const staffId = staff._id;

    const messageIds: Id<"atelierCaseMessages">[] = [];
    const milestoneIds: Id<"atelierOrderMilestones">[] = [];
    const notificationIds: Id<"atelierNotifications">[] = [];
    const auditIds: Id<"atelierAuditLog">[] = [];

    const audit = async (
      action: string,
      targetTable: string,
      targetId: string,
      at: number,
      meta?: Record<string, unknown>,
    ) => {
      auditIds.push(
        await ctx.db.insert("atelierAuditLog", {
          actorUserId: staffId,
          actorKind: "staff",
          action,
          targetTable,
          targetId,
          ...(meta ? { meta } : {}),
          at,
        }),
      );
    };

    const message = async (
      caseId: Id<"atelierCases">,
      planned: PlannedMessage,
      proposalId?: Id<"atelierProposals">,
    ) => {
      const id = await ctx.db.insert("atelierCaseMessages", {
        caseId,
        author: planned.author,
        authorUserId: planned.author === "staff" ? staffId : undefined,
        body: planned.body,
        proposalId: planned.carriesProposal ? proposalId : undefined,
        createdAt: planned.at,
      });
      messageIds.push(id);
      return id;
    };

    const milestones = async (orderId: Id<"atelierOrders">, planned: readonly PlannedMilestone[]) => {
      for (const milestone of planned) {
        milestoneIds.push(
          await ctx.db.insert("atelierOrderMilestones", {
            orderId,
            kind: milestone.kind,
            label: milestone.label,
            at: milestone.at,
            source: milestone.source,
            byUserId: milestone.source === "staff" ? staffId : undefined,
            note: milestone.note,
            estimated: milestone.estimated,
          }),
        );
      }
    };

    // 2. Draft A: in progress.
    const a = plan.inProgress;
    const draftA = await ctx.db.insert("atelierDrafts", {
      ...owner,
      name: a.look.name,
      occasion: a.occasion,
      eventDate: a.eventDate,
      spec: a.look.spec,
      shortlist: a.shortlist,
      stage: a.stage,
      completedSteps: a.completedSteps,
      catalogueVersion,
      revision: a.revision,
      status: "draft",
      lookKey: a.look.key,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      lastSavedAt: a.updatedAt,
    });

    // 3. Draft B: submitted, assigned, proposal and quote offered.
    const b = plan.submitted;
    const draftB = await ctx.db.insert("atelierDrafts", {
      ...owner,
      name: b.look.name,
      occasion: b.occasion,
      eventDate: b.eventDate,
      spec: b.look.spec,
      shortlist: b.look.spec.clothCode ? [b.look.spec.clothCode] : [],
      fitRoute: "atelier",
      stage: "review",
      completedSteps: b.completedSteps,
      catalogueVersion,
      revision: b.revision,
      status: "submitted",
      lookKey: b.look.key,
      createdAt: b.createdAt,
      updatedAt: b.submittedAt,
      lastSavedAt: b.submittedAt,
    });
    const revisionB = await ctx.db.insert("atelierRevisions", {
      draftId: draftB,
      revision: b.revision,
      spec: b.look.spec,
      specHash: specHash(b.look.spec),
      occasion: b.occasion,
      eventDate: b.eventDate,
      catalogueVersion,
      reason: "submitted",
      createdAt: b.submittedAt,
    });
    const quoteCase = await ctx.db.insert("atelierCases", {
      kind: "quote",
      ...owner,
      draftId: draftB,
      revisionId: revisionB,
      contact: plan.client,
      message: "Black-tie wedding in sixty days; I would like the three-piece quoted as designed.",
      submissionKey: `fixture:${randomToken()}`,
      status: b.caseStatus,
      ownerStaffId: staffId,
      assignedAt: b.assignedAt,
      nextAction: b.nextAction,
      nextActionDueAt: b.assignedAt + 2 * DAY_MS,
      priority: "normal",
      lastActivityAt: b.lastActivityAt,
      createdAt: b.submittedAt,
    });
    const proposalId = await ctx.db.insert("atelierProposals", {
      caseId: quoteCase,
      draftId: draftB,
      baseRevision: b.revision,
      beforeSpec: b.look.spec,
      afterSpec: b.proposal.afterSpec,
      rationale: b.proposal.rationale,
      commercialImpact: "none",
      status: "proposed",
      createdByStaffId: staffId,
      createdAt: b.proposal.createdAt,
    });
    for (const planned of b.messages) await message(quoteCase, planned, proposalId);
    const quoteOffered = await ctx.db.insert("atelierQuotes", {
      caseId: quoteCase,
      draftId: draftB,
      revisionId: revisionB,
      version: b.quote.version,
      lines: b.quote.lines,
      subtotalUsd: b.quote.subtotalUsd,
      totalUsd: b.quote.totalUsd,
      leadTimeWeeks: b.quote.leadTimeWeeks,
      fittingsIncluded: b.quote.fittingsIncluded,
      terms: b.quote.terms,
      expiresAt: b.quote.expiresAt,
      status: "offered",
      offeredAt: b.quote.offeredAt,
      createdByStaffId: staffId,
      createdAt: b.quote.createdAt,
    });
    for (const notification of plan.notifications) {
      notificationIds.push(
        await ctx.db.insert("atelierNotifications", {
          ...owner,
          caseId: quoteCase,
          channel: "email",
          to: plan.client.email,
          subject: notification.subject,
          body: notification.body,
          status: "queued",
          createdAt: notification.at,
        }),
      );
    }
    await audit("case.assign", "atelierCases", quoteCase, b.assignedAt, { ownerStaffId: staffId });
    await audit("proposal.create", "atelierProposals", proposalId, b.proposal.createdAt, {
      caseId: quoteCase,
      baseRevision: b.revision,
    });
    await audit("quote.offer", "atelierQuotes", quoteOffered, b.quote.offeredAt, {
      caseId: quoteCase,
      totalUsd: b.quote.totalUsd,
    });

    // 4. Draft C: ordered, in the making.
    const c = plan.ordered;
    const {
      draftId: draftC,
      revisionId: revisionC,
      caseId: orderedQuoteCase,
      quoteId: quoteAccepted,
    } = await submittedWithAcceptedQuote(ctx, {
      owner,
      staffId,
      catalogueVersion,
      look: c.look,
      occasion: c.occasion,
      eventDate: c.eventDate,
      revision: c.revision,
      createdAt: c.createdAt,
      submittedAt: c.submittedAt,
      caseStatus: c.caseStatus,
      quote: c.quote,
      contact: plan.client,
      caseMessage: "Charcoal for the office and the conference season; the Leonardo as it stands.",
      closedAt: undefined,
    });
    const orderMaking = await ctx.db.insert("atelierOrders", {
      ...owner,
      caseId: orderedQuoteCase,
      quoteId: quoteAccepted,
      revisionId: revisionC,
      draftId: draftC,
      spec: c.look.spec,
      specHash: specHash(c.look.spec),
      status: c.order.status,
      payment: {
        state: "confirmed",
        amountUsd: c.quote.totalUsd,
        reference: `SQ-${randomToken().slice(0, 12).toUpperCase()}`,
        confirmedAt: c.order.paymentConfirmedAt,
        provider: "Square",
      },
      eventDate: c.eventDate,
      estimatedReadyAt: c.order.estimatedReadyAt,
      releasedAt: c.order.releasedAt,
      releasedByStaffId: staffId,
      makerRef: c.order.makerRef,
      createdAt: c.order.createdAt,
      updatedAt: c.order.releasedAt,
    });
    await ctx.db.patch(orderedQuoteCase, { orderId: orderMaking });
    await milestones(orderMaking, c.milestones);
    await audit("quote.accept.record", "atelierQuotes", quoteAccepted, c.quote.acceptedAt ?? c.order.createdAt, {
      caseId: orderedQuoteCase,
    });
    await audit("payment.confirm", "atelierOrders", orderMaking, c.order.paymentConfirmedAt, {
      provider: "Square",
      amountUsd: c.quote.totalUsd,
    });
    await audit("order.release", "atelierOrders", orderMaking, c.order.releasedAt, { makerRef: c.order.makerRef });

    // 5. Draft D: delivered, with a correction open.
    const d = plan.delivered;
    const {
      draftId: draftD,
      revisionId: revisionD,
      caseId: deliveredQuoteCase,
      quoteId: quoteDelivered,
    } = await submittedWithAcceptedQuote(ctx, {
      owner,
      staffId,
      catalogueVersion,
      look: d.look,
      occasion: d.occasion,
      eventDate: d.eventDate,
      revision: d.revision,
      createdAt: d.createdAt,
      submittedAt: d.submittedAt,
      caseStatus: "completed",
      quote: d.quote,
      contact: plan.client,
      caseMessage: "The glen check three-piece, waistcoat with a cloth back so I can wear it on its own.",
      closedAt: d.order.deliveredAt,
    });
    const orderCorrection = await ctx.db.insert("atelierOrders", {
      ...owner,
      caseId: deliveredQuoteCase,
      quoteId: quoteDelivered,
      revisionId: revisionD,
      draftId: draftD,
      spec: d.look.spec,
      specHash: specHash(d.look.spec),
      status: d.order.status,
      payment: {
        state: "confirmed",
        amountUsd: d.quote.totalUsd,
        reference: `SQ-${randomToken().slice(0, 12).toUpperCase()}`,
        confirmedAt: d.order.paymentConfirmedAt,
        provider: "Square",
      },
      eventDate: d.eventDate,
      releasedAt: d.order.releasedAt,
      releasedByStaffId: staffId,
      makerRef: "CLT-2026-0288",
      shippedAt: d.order.shippedAt,
      carrier: d.order.carrier,
      trackingRef: d.order.trackingRef,
      deliveredAt: d.order.deliveredAt,
      firstFitChecklist: d.order.checklist,
      createdAt: d.order.createdAt,
      updatedAt: d.correction.updatedAt,
    });
    await ctx.db.patch(deliveredQuoteCase, { orderId: orderCorrection });
    await milestones(orderCorrection, d.milestones);
    const aftercareCase = await ctx.db.insert("atelierCases", {
      kind: "aftercare",
      ...owner,
      draftId: draftD,
      revisionId: revisionD,
      orderId: orderCorrection,
      contact: plan.client,
      message: d.correction.description,
      submissionKey: `fixture:${randomToken()}`,
      status: "awaiting_client",
      ownerStaffId: staffId,
      assignedAt: d.correction.requestedAt + HOUR_MS,
      nextAction: "Await the client's decision on the remedy",
      priority: "normal",
      lastActivityAt: d.correction.updatedAt,
      createdAt: d.correction.requestedAt,
    });
    const correctionId = await ctx.db.insert("atelierCorrections", {
      orderId: orderCorrection,
      ...owner,
      caseId: aftercareCase,
      kind: d.correction.kind,
      region: d.correction.region,
      description: d.correction.description,
      photoStorageIds: [],
      status: d.correction.status,
      remedy: { ...d.correction.remedy, approvedByStaffId: staffId },
      createdAt: d.correction.requestedAt,
      updatedAt: d.correction.updatedAt,
    });
    await ctx.db.patch(aftercareCase, { correctionId });
    for (const planned of d.correction.messages) await message(aftercareCase, planned);
    await audit("payment.confirm", "atelierOrders", orderCorrection, d.order.paymentConfirmedAt, {
      provider: "Square",
      amountUsd: d.quote.totalUsd,
    });
    await audit("order.release", "atelierOrders", orderCorrection, d.order.releasedAt, { makerRef: "CLT-2026-0288" });
    await audit("order.ship", "atelierOrders", orderCorrection, d.order.shippedAt, {
      carrier: d.order.carrier,
      trackingRef: d.order.trackingRef,
    });
    await audit("correction.triage", "atelierCorrections", correctionId, d.correction.requestedAt + DAY_MS, {
      region: d.correction.region,
    });
    await audit("correction.remedy.propose", "atelierCorrections", correctionId, d.correction.updatedAt, {
      kind: d.correction.remedy.kind,
      coverage: d.correction.remedy.coverage,
    });

    // 6. Appointments.
    const fitting = plan.appointments.fitting;
    const fittingCase = await ctx.db.insert("atelierCases", {
      kind: "fitting",
      ...owner,
      draftId: draftC,
      orderId: orderMaking,
      contact: plan.client,
      message: fitting.notes,
      submissionKey: `fixture:${randomToken()}`,
      status: "received",
      priority: "normal",
      lastActivityAt: fitting.requestedAt,
      createdAt: fitting.requestedAt,
    });
    const fittingRequested = await ctx.db.insert("atelierAppointments", {
      ...owner,
      caseId: fittingCase,
      draftId: draftC,
      service: fitting.service,
      showroomId: fitting.showroomId,
      preferredWindows: fitting.windows,
      notes: fitting.notes,
      timeZone: fitting.timeZone,
      status: "requested",
      history: [{ at: fitting.requestedAt, from: "requested", to: "requested", by: "client" }],
      eventDate: c.eventDate,
      createdAt: fitting.requestedAt,
      updatedAt: fitting.requestedAt,
    });
    await ctx.db.patch(fittingCase, { appointmentId: fittingRequested });
    await message(fittingCase, {
      author: "system",
      body: `${CASE_KIND_LABELS.fitting} received. A concierge will take it up and you will see their name here.`,
      at: fitting.requestedAt,
    });
    const consultation = plan.appointments.consultation;
    const consultationConfirmed = await ctx.db.insert("atelierAppointments", {
      ...owner,
      draftId: draftA,
      service: consultation.service,
      showroomId: consultation.showroomId,
      preferredWindows: [consultation.window],
      timeZone: consultation.timeZone,
      status: "confirmed",
      confirmedStart: consultation.confirmedStart,
      confirmedEnd: consultation.confirmedEnd,
      calendarRef: `SQ-APT-${randomToken().slice(0, 10).toUpperCase()}`,
      history: [
        { at: consultation.requestedAt, from: "requested", to: "requested", by: "client" },
        {
          at: consultation.confirmedAt,
          from: "requested",
          to: "confirmed",
          by: "staff",
          note: "Confirmed with Adaeze at the Atlanta showroom.",
        },
      ],
      eventDate: a.eventDate,
      createdAt: consultation.requestedAt,
      updatedAt: consultation.confirmedAt,
    });
    await audit("appointment.confirm", "atelierAppointments", consultationConfirmed, consultation.confirmedAt, {
      confirmedStart: consultation.confirmedStart,
      confirmedEnd: consultation.confirmedEnd,
    });

    // 7. A share for Draft A.
    const shareToken = randomToken();
    const shareId = await ctx.db.insert("atelierShares", {
      draftId: draftA,
      token: shareToken,
      ...owner,
      audience: a.share.audience,
      expiresAt: a.share.expiresAt,
      createdAt: a.share.createdAt,
    });

    // 8. A photograph removal, run and completed with the provider's retention disclosed.
    const privacyRequestId = await ctx.db.insert("atelierPrivacyRequests", {
      ...owner,
      kind: plan.privacy.kind,
      status: plan.privacy.status,
      steps: plan.privacy.steps,
      exceptions: plan.privacy.exceptions,
      requestedAt: plan.privacy.requestedAt,
      completedAt: Math.max(...plan.privacy.steps.map((step) => step.at ?? plan.privacy.requestedAt)),
      handledByStaffId: staffId,
    });
    await audit("privacy.handle", "atelierPrivacyRequests", privacyRequestId, plan.privacy.requestedAt + 6 * 60_000, {
      status: plan.privacy.status,
    });

    // 9. A wedding party, organised by the stand-in staff member.
    const g = plan.group;
    const groupId = await ctx.db.insert("atelierGroups", {
      organizerUserId: staffId,
      name: g.name,
      eventDate: g.eventDate,
      occasion: g.occasion,
      brief: g.brief,
      sharedSpec: g.sharedSpec,
      permittedIndividual: g.permittedIndividual,
      status: g.status,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    });
    const participantIds: Id<"atelierGroupParticipants">[] = [];
    const inviteTokens: string[] = [];
    for (const participant of g.participants) {
      const inviteToken = randomToken();
      inviteTokens.push(inviteToken);
      participantIds.push(
        await ctx.db.insert("atelierGroupParticipants", {
          groupId,
          inviteToken,
          name: participant.name,
          email: participant.email,
          status: participant.status,
          consent: participant.consent,
          joinedAt: participant.joinedAt,
          createdAt: g.createdAt,
        }),
      );
    }

    const paths = scenarioPaths(
      {
        draftA,
        draftB,
        draftC,
        draftD,
        quoteCase,
        aftercareCase,
        fittingCase,
        orderMaking,
        orderCorrection,
        fittingRequested,
        consultationConfirmed,
        shareToken,
        inviteToken: inviteTokens[1] ?? inviteTokens[0] ?? "",
      },
      guestKey,
    );

    return {
      staffUserId: staffId,
      catalogueVersion,
      draftIds: { inProgress: draftA, submitted: draftB, ordered: draftC, delivered: draftD },
      revisionIds: { submitted: revisionB, ordered: revisionC, delivered: revisionD },
      caseIds: {
        quote: quoteCase,
        orderedQuote: orderedQuoteCase,
        deliveredQuote: deliveredQuoteCase,
        aftercare: aftercareCase,
        fitting: fittingCase,
      },
      messageIds,
      proposalId,
      quoteIds: { offered: quoteOffered, accepted: quoteAccepted, delivered: quoteDelivered },
      orderIds: { making: orderMaking, correctionOpen: orderCorrection },
      milestoneIds,
      correctionId,
      appointmentIds: { requested: fittingRequested, confirmed: consultationConfirmed },
      shareId,
      shareToken,
      privacyRequestId,
      groupId,
      participantIds,
      inviteTokens,
      notificationIds,
      auditIds,
      paths,
    };
  },
});

/** The stand-in concierge every staff field points at: found by `staffClerkId`, else "dev-staff", created once. */
async function ensureStaff(
  ctx: MutationCtx,
  plan: ScenarioPlan,
  staffClerkId: string | undefined,
  now: number,
): Promise<Doc<"users">> {
  const clerkId = staffClerkId ?? plan.staff.clerkId;
  const existing = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .unique();
  if (existing) return existing;
  if (staffClerkId)
    throw appError(
      "NOT_FOUND",
      `No user with clerkId "${staffClerkId}". Sign in once, or omit staffClerkId to use the stand-in.`,
    );
  const id = await ctx.db.insert("users", {
    clerkId,
    role: "admin",
    staffRoles: [...plan.staff.staffRoles],
    name: plan.staff.name,
    email: plan.staff.email,
    plan: "free",
    features: [],
    planCredits: 0,
    packCredits: 0,
    dailySpend: { dayKey: "", credits: 0 },
    prefs: { presentation: "masculine", fit: "regular", avoidColours: [] },
    createdAt: now,
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Staff fixture insert failed");
  return created;
}

type SubmittedInput = {
  owner: { guestKey: string };
  staffId: Id<"users">;
  catalogueVersion: number;
  look: Look;
  occasion: Occasion;
  eventDate: number;
  revision: number;
  createdAt: number;
  submittedAt: number;
  caseStatus: CaseStatus;
  quote: PlannedQuote;
  contact: Contact;
  caseMessage: string;
  closedAt: number | undefined;
};

/** A submitted draft, its "quote" revision, its quote case and an accepted quote: the ground an order stands on. */
async function submittedWithAcceptedQuote(
  ctx: MutationCtx,
  input: SubmittedInput,
): Promise<{
  draftId: Id<"atelierDrafts">;
  revisionId: Id<"atelierRevisions">;
  caseId: Id<"atelierCases">;
  quoteId: Id<"atelierQuotes">;
}> {
  const { look, quote } = input;
  const acceptedAt = quote.acceptedAt ?? quote.offeredAt;
  const draftId = await ctx.db.insert("atelierDrafts", {
    ...input.owner,
    name: look.name,
    occasion: input.occasion,
    eventDate: input.eventDate,
    spec: look.spec,
    shortlist: look.spec.clothCode ? [look.spec.clothCode] : [],
    fitRoute: "atelier",
    stage: "review",
    completedSteps: completedStepsFor(look.spec, {
      occasionSet: true,
      previewDone: false,
      fitRouteSet: true,
    }) as StudioStep[],
    catalogueVersion: input.catalogueVersion,
    revision: input.revision,
    status: "submitted",
    lookKey: look.key,
    createdAt: input.createdAt,
    updatedAt: input.submittedAt,
    lastSavedAt: input.submittedAt,
  });
  const revisionId = await ctx.db.insert("atelierRevisions", {
    draftId,
    revision: input.revision,
    spec: look.spec,
    specHash: specHash(look.spec),
    occasion: input.occasion,
    eventDate: input.eventDate,
    catalogueVersion: input.catalogueVersion,
    reason: "quote",
    createdAt: input.submittedAt,
  });
  const caseId = await ctx.db.insert("atelierCases", {
    kind: "quote",
    ...input.owner,
    draftId,
    revisionId,
    contact: input.contact,
    message: input.caseMessage,
    submissionKey: `fixture:${randomToken()}`,
    status: input.caseStatus,
    ownerStaffId: input.staffId,
    assignedAt: input.submittedAt + HOUR_MS,
    priority: "normal",
    lastActivityAt: acceptedAt,
    closedAt: input.closedAt,
    createdAt: input.submittedAt,
  });
  await ctx.db.insert("atelierCaseMessages", {
    caseId,
    author: "system",
    body: `${CASE_KIND_LABELS.quote} received. A concierge will take it up and you will see their name here.`,
    createdAt: input.submittedAt,
  });
  const quoteId = await ctx.db.insert("atelierQuotes", {
    caseId,
    draftId,
    revisionId,
    version: quote.version,
    lines: quote.lines,
    subtotalUsd: quote.subtotalUsd,
    totalUsd: quote.totalUsd,
    leadTimeWeeks: quote.leadTimeWeeks,
    fittingsIncluded: quote.fittingsIncluded,
    terms: quote.terms,
    expiresAt: quote.expiresAt,
    status: "accepted",
    offeredAt: quote.offeredAt,
    acceptedAt,
    acceptedSpecHash: specHash(look.spec),
    createdByStaffId: input.staffId,
    createdAt: quote.createdAt,
  });
  return { draftId, revisionId, caseId, quoteId };
}
