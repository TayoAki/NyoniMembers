import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (error.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".")) throw error;
      for (const extension of [".ts", ".js"]) {
        const candidate = new URL(`${specifier}${extension}`, context.parentURL);
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
      throw error;
    }
  },
});

const {
  DAY_MS,
  HOUR_MS,
  SCENARIO_TIME_ZONE,
  newYorkInstant,
  newYorkUtcOffsetHours,
  nextWeekMonday,
  quoteTotals,
  scenarioPaths,
  scenarioPlan,
  utcNoon,
} = await import("../convex/dev/atelier_fixtures.ts");
const { LOOKS } = await import("../convex/shared/atelier/looks.ts");
const { CLOTH_SEED } = await import("../convex/shared/atelier/cloths.ts");
const { specHash } = await import("../convex/shared/atelier/spec.ts");
const { FIT_REGIONS, QUOTE_LINE_KINDS, ORDER_STATUS_LABELS, STAFF_ROLES, ATELIER_LIMITS } =
  await import("../convex/shared/atelier/enums.ts");
const { HOUSE_POLICY } = await import("../convex/shared/atelier/policy.ts");

/** A Sunday evening in October 2026, UTC: the week boundary is the awkward case for "next week". */
const NOW = Date.UTC(2026, 9, 18, 22, 30);
const CLOTH_CODES = new Set(CLOTH_SEED.map((cloth) => cloth.code));

function inNewYork(ms) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCENARIO_TIME_ZONE,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date(ms));
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return { weekday: get("weekday"), hour: Number(get("hour")) % 24, minute: Number(get("minute")) };
}

test("the plan is deterministic for a given now", () => {
  assert.deepEqual(scenarioPlan(NOW), scenarioPlan(NOW));
  assert.notDeepEqual(scenarioPlan(NOW), scenarioPlan(NOW + DAY_MS));
});

test("every dated fact sits at its stated distance from now", () => {
  const plan = scenarioPlan(NOW);
  assert.equal(plan.now, NOW);
  assert.equal(plan.inProgress.eventDate, NOW + 90 * DAY_MS);
  assert.equal(plan.inProgress.share.expiresAt, NOW + 7 * DAY_MS);
  assert.equal(plan.submitted.eventDate, NOW + 60 * DAY_MS);
  assert.equal(plan.submitted.quote.expiresAt, NOW + 14 * DAY_MS);
  assert.equal(plan.ordered.eventDate, NOW + 40 * DAY_MS);
  assert.equal(plan.ordered.order.estimatedReadyAt, NOW + 28 * DAY_MS);
  assert.equal(plan.delivered.order.shippedAt, NOW - 10 * DAY_MS);
  assert.equal(plan.delivered.order.deliveredAt, NOW - 7 * DAY_MS);
  assert.equal(plan.delivered.correction.remedy.deadline, NOW + 14 * DAY_MS);
  assert.equal(plan.group.eventDate, NOW + 120 * DAY_MS);
  assert.ok(
    plan.submitted.quote.offeredAt < NOW && plan.submitted.quote.offeredAt > NOW - DAY_MS,
    "the quote was offered within the last day",
  );
  assert.ok(plan.submitted.submittedAt < plan.submitted.assignedAt, "a case is assigned after it is submitted");
  assert.ok(
    plan.ordered.submittedAt < plan.ordered.quote.acceptedAt &&
      plan.ordered.quote.acceptedAt <= plan.ordered.order.createdAt,
  );
  assert.ok(
    plan.ordered.order.createdAt < plan.ordered.order.paymentConfirmedAt &&
      plan.ordered.order.paymentConfirmedAt < plan.ordered.order.releasedAt,
  );
  assert.ok(
    plan.delivered.order.deliveredAt < plan.delivered.correction.requestedAt &&
      plan.delivered.correction.requestedAt < plan.delivered.correction.updatedAt,
  );
});

test("the stand-in staff member holds every role and the drafts use the named looks in real cloths", () => {
  const plan = scenarioPlan(NOW);
  assert.equal(plan.staff.clerkId, "dev-staff");
  assert.deepEqual([...plan.staff.staffRoles], [...STAFF_ROLES]);
  assert.equal(plan.inProgress.look, LOOKS[0]);
  assert.equal(plan.submitted.look, LOOKS[3]);
  assert.equal(plan.ordered.look, LOOKS[2]);
  assert.equal(plan.delivered.look, LOOKS[5]);
  assert.equal(plan.submitted.look.spec.garment, "three_piece");
  assert.equal(plan.inProgress.shortlist.length, ATELIER_LIMITS.shortlistMax);
  assert.equal(
    new Set(plan.inProgress.shortlist).size,
    plan.inProgress.shortlist.length,
    "no duplicate cloth in the shortlist",
  );
  for (const code of plan.inProgress.shortlist) assert.ok(CLOTH_CODES.has(code), `${code} is a real cloth`);
  assert.ok(plan.inProgress.shortlist.includes(LOOKS[0].spec.clothCode), "the shortlist includes the look's own cloth");
  assert.equal(plan.inProgress.stage, "style");
  assert.deepEqual(plan.inProgress.completedSteps, ["occasion", "cloth", "style"]);
  assert.equal(plan.inProgress.revision, 3);
  assert.equal(plan.submitted.revision, 5);
  assert.equal(plan.ordered.revision, 2);
  assert.equal(plan.submitted.occasion, "black_tie");
  assert.equal(plan.inProgress.occasion, "wedding");
});

test("the proposal closes the vents and changes nothing else", () => {
  const { submitted } = scenarioPlan(NOW);
  const before = submitted.look.spec;
  const after = submitted.proposal.afterSpec;
  assert.equal(before.jacket.vents, "double");
  assert.equal(after.jacket.vents, "none");
  assert.deepEqual({ ...after, jacket: { ...after.jacket, vents: before.jacket.vents } }, before);
  assert.notEqual(specHash(after), specHash(before));
  assert.equal(
    submitted.messages.filter((message) => message.carriesProposal).length,
    1,
    "exactly one staff message carries the proposal",
  );
  assert.equal(submitted.messages.find((message) => message.carriesProposal)?.author, "staff");
  assert.deepEqual(
    submitted.messages.map((message) => message.author),
    ["system", "staff", "client"],
  );
  assert.ok(
    submitted.messages.every((message, index, all) => index === 0 || all[index - 1].at < message.at),
    "messages are in time order",
  );
});

test("the offered quote adds up and uses known line kinds and the house's final-sale terms", () => {
  const { submitted, ordered, delivered } = scenarioPlan(NOW);
  const quote = submitted.quote;
  const byKind = Object.fromEntries(quote.lines.map((line) => [line.kind, line.amountUsd]));
  assert.equal(byKind.commission, 2850);
  assert.equal(byKind.cloth, 0);
  assert.equal(byKind.option, 180);
  assert.equal(quote.lines.find((line) => line.kind === "option")?.label, "Full canvas");
  for (const line of quote.lines) assert.ok(QUOTE_LINE_KINDS.includes(line.kind), `${line.kind} is a quote line kind`);
  assert.equal(quote.subtotalUsd, 3030);
  assert.equal(quote.totalUsd, 3030);
  assert.deepEqual(quoteTotals(quote.lines), { subtotalUsd: 3030, totalUsd: 3030 });
  assert.equal(quote.leadTimeWeeks, 6);
  assert.equal(quote.fittingsIncluded, 2);
  assert.equal(quote.terms, HOUSE_POLICY.verified.finalSale);
  assert.equal(quote.acceptedAt, undefined, "the offered quote is not accepted");
  for (const accepted of [ordered.quote, delivered.quote]) {
    assert.ok(accepted.acceptedAt, "accepted quotes carry an acceptance time");
    assert.deepEqual(quoteTotals(accepted.lines), { subtotalUsd: accepted.subtotalUsd, totalUsd: accepted.totalUsd });
    assert.ok(accepted.totalUsd > 0);
  }
});

test("quote totals keep tax and shipping out of the subtotal", () => {
  const lines = [
    { code: "C", label: "Commission", amountUsd: 1000, kind: "commission" },
    { code: "S", label: "Shipping", amountUsd: 40, kind: "shipping" },
    { code: "T", label: "Tax", amountUsd: 70, kind: "tax" },
    { code: "D", label: "Discount", amountUsd: -100, kind: "discount" },
  ];
  assert.deepEqual(quoteTotals(lines), { subtotalUsd: 900, totalUsd: 1010 });
});

test("the order in the making has sourced milestones in time order with one estimate, last", () => {
  const { ordered } = scenarioPlan(NOW);
  assert.equal(ordered.order.status, "making");
  assert.equal(ordered.order.makerRef, "CLT-2026-0417");
  const labels = ordered.milestones.map((milestone) => milestone.label);
  assert.deepEqual(labels, [
    "Quote accepted",
    "Payment confirmed",
    ORDER_STATUS_LABELS.released,
    "Cloth cut",
    "Estimated ready",
  ]);
  assert.deepEqual(
    ordered.milestones.map((milestone) => milestone.source),
    ["client", "staff", "staff", "maker", "system"],
  );
  const estimated = ordered.milestones.filter((milestone) => milestone.estimated);
  assert.equal(estimated.length, 1);
  assert.equal(estimated[0], ordered.milestones.at(-1));
  assert.equal(estimated[0].at, ordered.order.estimatedReadyAt);
  for (let index = 1; index < ordered.milestones.length; index += 1) {
    assert.ok(
      ordered.milestones[index - 1].at < ordered.milestones[index].at,
      `milestone ${index} follows ${index - 1}`,
    );
  }
});

test("the delivered order flags only the jacket sleeves and proposes an included alteration", () => {
  const { delivered } = scenarioPlan(NOW);
  assert.equal(delivered.order.status, "correction_open");
  assert.equal(delivered.order.carrier, "UPS");
  assert.match(delivered.order.trackingRef, /^1Z/);
  assert.deepEqual(Object.keys(delivered.order.checklist).sort(), [...FIT_REGIONS].sort());
  assert.equal(delivered.order.checklist.jacket_sleeves, "issue");
  for (const region of FIT_REGIONS) {
    if (region !== "jacket_sleeves") assert.equal(delivered.order.checklist[region], "ok", `${region} is ok`);
  }
  assert.equal(delivered.correction.kind, "alteration");
  assert.equal(delivered.correction.region, "jacket_sleeves");
  assert.equal(delivered.correction.description, "Left sleeve sits about 1.5 cm long.");
  assert.equal(delivered.correction.status, "remedy_proposed");
  assert.equal(delivered.correction.remedy.coverage, "included");
  assert.equal(
    delivered.correction.remedy.logistics,
    "Bring the jacket to the Charlotte showroom or we send a prepaid label.",
  );
  assert.ok(
    delivered.milestones.every((milestone) => !milestone.estimated),
    "a delivered order has no estimates left",
  );
  assert.ok(delivered.milestones.every((milestone, index, all) => index === 0 || all[index - 1].at < milestone.at));
});

test("next week's Monday is a Monday strictly after this week, on any weekday", () => {
  for (let offset = 0; offset < 7; offset += 1) {
    const now = NOW + offset * DAY_MS;
    const monday = nextWeekMonday(now);
    assert.equal(new Date(monday).getUTCDay(), 1, "a Monday");
    assert.equal(new Date(monday).getUTCHours(), 12, "noon UTC");
    const daysAhead = (monday - utcNoon(now)) / DAY_MS;
    assert.ok(Number.isInteger(daysAhead) && daysAhead >= 1 && daysAhead <= 7, `${daysAhead} days ahead`);
    if (new Date(utcNoon(now)).getUTCDay() === 1) assert.equal(daysAhead, 7, "a Monday looks to the Monday after");
    assert.ok(monday - 7 * DAY_MS <= utcNoon(now), "it is the very next week, not the one after");
  }
});

test("the fitting asks for two windows next week and the consultation is confirmed for Tuesday 2–3pm New York", () => {
  const { appointments } = scenarioPlan(NOW);
  const monday = nextWeekMonday(NOW);
  assert.equal(appointments.fitting.service, "first_fitting");
  assert.equal(appointments.fitting.showroomId, "charlotte");
  assert.equal(appointments.fitting.timeZone, "America/New_York");
  assert.deepEqual(
    appointments.fitting.windows.map((window) => (window.date - monday) / DAY_MS),
    [0, 2],
    "Monday and Wednesday of next week",
  );
  assert.deepEqual(
    appointments.fitting.windows.map((window) => inNewYork(window.date).weekday),
    ["Mon", "Wed"],
  );
  for (const window of appointments.fitting.windows) assert.ok(window.date > NOW, "a window in the future");

  assert.equal(appointments.consultation.service, "consultation");
  assert.equal(appointments.consultation.showroomId, "atlanta");
  const start = inNewYork(appointments.consultation.confirmedStart);
  const end = inNewYork(appointments.consultation.confirmedEnd);
  assert.deepEqual(start, { weekday: "Tue", hour: 14, minute: 0 });
  assert.deepEqual(end, { weekday: "Tue", hour: 15, minute: 0 });
  assert.equal(appointments.consultation.confirmedEnd - appointments.consultation.confirmedStart, HOUR_MS);
  assert.equal(appointments.consultation.window.date, monday + DAY_MS);
  assert.ok(appointments.consultation.requestedAt < appointments.consultation.confirmedAt);
});

test("the New York clock arithmetic agrees with Intl on both sides of daylight time", () => {
  const cases = [
    { day: Date.UTC(2026, 0, 13, 12), offset: -5 },
    { day: Date.UTC(2026, 2, 8, 12), offset: -4, note: "the day daylight time begins (2am)" },
    { day: Date.UTC(2026, 6, 14, 12), offset: -4 },
    { day: Date.UTC(2026, 10, 1, 12), offset: -5, note: "the day daylight time ends (2am)" },
    { day: Date.UTC(2027, 11, 24, 12), offset: -5 },
  ];
  for (const { day, offset } of cases) {
    for (const hour of [9, 14, 18]) {
      const instant = newYorkInstant(day, hour);
      assert.equal(newYorkUtcOffsetHours(instant), offset);
      assert.equal(inNewYork(instant).hour, hour, `${new Date(day).toISOString().slice(0, 10)} ${hour}:00`);
      assert.equal(inNewYork(instant).minute, 0);
    }
  }
});

test("the privacy request is waiting on the provider with three steps done and the released order excepted", () => {
  const { privacy } = scenarioPlan(NOW);
  assert.equal(privacy.kind, "delete_photos");
  assert.equal(privacy.status, "downstream_pending");
  assert.deepEqual(
    privacy.steps.map((step) => step.status),
    ["done", "done", "done", "pending"],
  );
  assert.equal(privacy.steps.at(-1).label, "Waiting on provider deletion");
  assert.equal(privacy.steps.at(-1).at, undefined);
  for (const step of privacy.steps.slice(0, 3)) assert.ok(step.at >= privacy.requestedAt);
  assert.deepEqual(privacy.exceptions, ["Your released order keeps its specification and fit profile."]);
});

test("the wedding party shares the Armada with its cloth and lets three fields vary", () => {
  const { group } = scenarioPlan(NOW);
  assert.equal(group.name, "Okafor wedding party");
  assert.equal(group.occasion, "wedding");
  assert.equal(group.status, "inviting");
  assert.deepEqual(group.sharedSpec, LOOKS[0].spec);
  assert.ok(group.sharedSpec.clothCode, "the shared spec keeps its cloth");
  assert.deepEqual(group.permittedIndividual, ["jacket.vents", "trousers.hem", "monogram"]);
  assert.equal(group.participants.length, 3);
  const joined = group.participants.filter((participant) => participant.status === "joined");
  const invited = group.participants.filter((participant) => participant.status === "invited");
  assert.equal(joined.length, 1);
  assert.equal(invited.length, 2);
  assert.equal(joined[0].consent.shareStyleStatus, true);
  assert.ok(joined[0].joinedAt > group.createdAt);
  for (const participant of invited) {
    assert.deepEqual(participant.consent, { shareStyleStatus: false, shareFitStatus: false });
    assert.equal(participant.joinedAt, undefined);
  }
});

test("the notifications belong to the quote case's two moments", () => {
  const { notifications, submitted } = scenarioPlan(NOW);
  assert.equal(notifications.length, 2);
  assert.deepEqual(
    notifications.map((notification) => notification.at),
    [submitted.submittedAt, submitted.quote.offeredAt],
  );
  for (const notification of notifications) assert.match(notification.subject, /^Nyoni Couture · /);
});

test("every path is a client route carrying the guest key", () => {
  const guestKey = "0123456789abcdef0123456789abcdef";
  const ids = {
    draftA: "dA",
    draftB: "dB",
    draftC: "dC",
    draftD: "dD",
    quoteCase: "cQ",
    aftercareCase: "cA",
    fittingCase: "cF",
    orderMaking: "oM",
    orderCorrection: "oC",
    fittingRequested: "apR",
    consultationConfirmed: "apC",
    shareToken: "share-token",
    inviteToken: "invite-token",
  };
  const paths = scenarioPaths(ids, guestKey);
  assert.equal(paths.length, 13);
  for (const { label, path } of paths) {
    assert.ok(label.length > 0);
    assert.ok(path.startsWith("/atelier/"), path);
    assert.ok(path.endsWith(`?guest=${guestKey}`), path);
    assert.equal(path.split("?").length, 2, "one query string");
  }
  const bare = paths.map(({ path }) => path.split("?")[0]);
  assert.ok(bare.includes("/atelier/design/dA/style"));
  assert.ok(bare.includes("/atelier/design/dB/review"));
  assert.ok(bare.includes("/atelier/requests/cQ"));
  assert.ok(bare.includes("/atelier/requests/cA"));
  assert.ok(bare.includes("/atelier/requests/cF"));
  assert.ok(bare.includes("/atelier/orders/oM"));
  assert.ok(bare.includes("/atelier/orders/oC"));
  assert.ok(bare.includes("/atelier/fittings/apR"));
  assert.ok(bare.includes("/atelier/fittings/apC"));
  assert.ok(bare.includes("/atelier/shared/share-token"));
  assert.ok(bare.includes("/atelier/groups/join/invite-token"));
  assert.equal(new Set(bare).size, bare.length, "no duplicate paths");
});
