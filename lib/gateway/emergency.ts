// Words that mean someone may be in danger. Gateway never tries to handle
// these itself: it tells the person to call 999 and gets a member of staff.
const PATTERNS = [
  /\b(999|112|ambulance|paramedic)\b/i,
  /\b(not|isn'?t|stopped)\s+breathing\b/i,
  /\b(unconscious|unresponsive|collapsed|seizure|fitting|stroke|heart attack|chest pain|choking|overdose|bleeding heavily)\b/i,
  /\bha(s|ve)\s+(had\s+a\s+)?fall(en)?\b|\bfell\b|\bon the floor\b/i,
  /\b(suicid\w*|kill (my|him|her|them)sel(f|ves)|self[- ]harm)\b/i,
  /\b(abus\w*|safeguarding|assault\w*|hit me|hurting (me|him|her))\b/i,
  /\b(fire|smoke|gas leak)\b/i,
  /\bemergency\b/i,
];

export function looksLikeEmergency(text: string): boolean {
  return PATTERNS.some((p) => p.test(text));
}

export const EMERGENCY_REPLY =
  "If anyone is in danger or needs urgent medical help, call 999 now. I'm getting a member of our team to you straight away.";
