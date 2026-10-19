import type { AppointmentStatus, CaseStatus, CatalogueStatus, SampleState } from "./enums";

/**
 * The state machines staff drive by hand. They live here, beside the enums, so the staff desk can offer only
 * the legal next states without importing a server module; the models re-export and enforce them.
 */

export const CASE_TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> = {
  received: ["assigned", "awaiting_client", "awaiting_staff", "completed", "cancelled"],
  assigned: ["awaiting_client", "awaiting_staff", "completed", "cancelled"],
  awaiting_client: ["assigned", "awaiting_staff", "completed", "cancelled"],
  awaiting_staff: ["assigned", "awaiting_client", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/** Sample fulfilment (C04): requested → accepted → shipped, or declined at either step. */
export const SAMPLE_TRANSITIONS: Record<SampleState, readonly SampleState[]> = {
  requested: ["accepted", "declined"],
  accepted: ["shipped", "declined"],
  shipped: [],
  declined: [],
};

export const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  requested: ["awaiting_confirmation", "confirmed", "rescheduled", "cancelled"],
  awaiting_confirmation: ["confirmed", "rescheduled", "cancelled"],
  confirmed: ["confirmed", "rescheduled", "cancelled", "completed"],
  rescheduled: ["awaiting_confirmation", "confirmed", "rescheduled", "cancelled"],
  cancelled: [],
  completed: [],
};

export const CATALOGUE_TRANSITIONS: Record<CatalogueStatus, readonly CatalogueStatus[]> = {
  draft: ["approved", "withdrawn"],
  approved: ["withdrawn"],
  withdrawn: ["approved", "draft"],
};
