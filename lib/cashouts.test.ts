import assert from "node:assert/strict";
import test from "node:test";

import { cashOutsCsv } from "./peak/cashouts";

const row = {
  id: "r1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  amountPence: 500,
  points: 500,
  reward: "Cash out £5",
  approvedAt: new Date("2026-10-28T10:00:00Z"),
  approvedBy: "Amara Okafor",
  paidAt: null,
  paidBy: null,
};

test("the payroll file has a header and one line per cash-out", () => {
  const lines = cashOutsCsv([row]).trim().split("\r\n");
  assert.equal(lines[0], '"Name","Email","Amount (GBP)","Points","Reward","Approved on","Approved by","Reference"');
  assert.equal(lines[1], '"Ada Lovelace","ada@example.com","5.00","500","Cash out £5","2026-10-28","Amara Okafor","r1"');
});

test("quotes are escaped and nothing can run as a spreadsheet formula", () => {
  const csv = cashOutsCsv([{ ...row, name: '=HYPERLINK("http://x")', reward: 'Say "thanks"', email: null }]);
  assert.match(csv, /"'=HYPERLINK\(""http:\/\/x""\)"/);
  assert.match(csv, /"Say ""thanks"""/);
});
