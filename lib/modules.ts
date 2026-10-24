// The modules Canvas hosts. Each manifest is the contract a platform agrees to
// when it installs the module: what the module shows, the events it sends and
// receives, and the actions it asks the platform to carry out.

export type ModuleStatus = "pilot" | "planned";

export interface ModuleManifest {
  key: string;
  name: string;
  tagline: string;
  description: string;
  status: ModuleStatus;
  /** Path under /embed that renders the module inside a platform. */
  embedPath: string;
  /** Events the module sends to the platform (outbound webhooks). */
  emits: { type: string; description: string }[];
  /** Events the module accepts from the platform. */
  consumes: { type: string; description: string }[];
  /**
   * Actions the module asks the platform to carry out through the platform's
   * own tools. The platform applies its own permissions, approvals and audit.
   */
  actions: { name: string; description: string; changesData: boolean }[];
}

export const MODULES: ModuleManifest[] = [
  {
    key: "gateway",
    name: "Gateway",
    tagline: "One conversation layer for every channel, agent and person.",
    description:
      "Gateway answers calls and messages on phone, SMS, WhatsApp and web chat, works out who is speaking, and routes each conversation to the right AI agent or person. Agents such as Persona Assist join as participants, and staff can watch, take over and hand back.",
    status: "pilot",
    embedPath: "/embed/gateway",
    emits: [
      { type: "gateway.call.completed", description: "A conversation ended, with its summary and transcript reference." },
      { type: "gateway.absence.reported", description: "A carer reported they can't work a shift." },
      { type: "gateway.cover.requested", description: "A client asked for staff." },
      { type: "gateway.handover.requested", description: "A conversation needs a person now." },
    ],
    consumes: [
      { type: "platform.shift.assigned", description: "A shift was filled, so Gateway can tell the people waiting." },
      { type: "platform.person.updated", description: "Contact details changed, so Gateway recognises callers." },
    ],
    actions: [
      { name: "find_person", description: "Look up a caller by phone number.", changesData: false },
      { name: "mark_shift_uncovered", description: "Mark a shift as needing a carer.", changesData: true },
      { name: "offer_shift", description: "Offer an open shift to suitable carers.", changesData: true },
    ],
  },
  {
    key: "peak",
    name: "Peak",
    tagline: "Recognition that pays: points for shifts, punctuality and praise.",
    description:
      "Peak turns attendance and praise into points, streaks and rewards for carers, and builds the reliability record that feeds Shift Readiness.",
    status: "planned",
    embedPath: "/embed/peak",
    emits: [{ type: "peak.reward.redeemed", description: "A carer redeemed a reward." }],
    consumes: [
      { type: "platform.clock.in", description: "A carer clocked in, on time or late." },
      { type: "platform.praise.received", description: "A client praised a carer." },
    ],
    actions: [{ name: "list_workers", description: "Read the carers to score.", changesData: false }],
  },
];

export function findModule(key: string): ModuleManifest | undefined {
  return MODULES.find((m) => m.key === key);
}

/** Event types a platform may send to an installation of this module. */
export function acceptsEvent(moduleKey: string, type: string): boolean {
  return findModule(moduleKey)?.consumes.some((e) => e.type === type) ?? false;
}
