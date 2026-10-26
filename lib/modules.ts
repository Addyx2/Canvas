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
      "Gateway answers calls, texts and web chat, recognises who is speaking, and handles what it can: reporting an absence, requesting cover or answering questions. Emergencies and anything it can't handle go straight to a person, and staff can take over and hand back at any time.",
    status: "pilot",
    embedPath: "/embed/gateway",
    emits: [
      { type: "gateway.call.completed", description: "A conversation ended, with its summary." },
      { type: "gateway.absence.reported", description: "A carer reported they can't work a shift." },
      { type: "gateway.cover.requested", description: "A client asked for staff." },
      { type: "gateway.handover.requested", description: "A conversation needs a person now." },
    ],
    consumes: [
      { type: "platform.person.updated", description: "A person's name or phone changed, so Gateway recognises them when they call." },
      { type: "platform.person.removed", description: "A person left, so Gateway stops recognising them." },
    ],
    actions: [],
  },
  {
    key: "peak",
    name: "Peak",
    tagline: "Recognition that pays: points for shifts, punctuality and praise.",
    description:
      "Peak turns completed shifts, on-time clock-ins and praise into points, streaks and rewards. Carers cash points out through payroll or spend them on perks, and every point is in a ledger.",
    status: "pilot",
    embedPath: "/embed/peak",
    emits: [{ type: "peak.reward.redeemed", description: "A manager approved a reward; cash-outs carry the amount to pay through payroll." }],
    consumes: [
      { type: "platform.shift.completed", description: "A carer completed a shift." },
      { type: "platform.clock.in", description: "A carer clocked in, with how many minutes late." },
      { type: "platform.praise.received", description: "A client or manager praised a carer." },
      { type: "platform.person.updated", description: "A carer's name changed." },
    ],
    actions: [],
  },
];

export function findModule(key: string): ModuleManifest | undefined {
  return MODULES.find((m) => m.key === key);
}

/** Event types a platform may send to an installation of this module. */
export function acceptsEvent(moduleKey: string, type: string): boolean {
  return findModule(moduleKey)?.consumes.some((e) => e.type === type) ?? false;
}
