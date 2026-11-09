export type Severity = "risk" | "caution" | "safe";
export type DocType = "Rent agreement" | "Landlord notice" | "Bill" | "Contract" | "Other";

export interface Flag {
  id: string;
  title: string;
  severity: Exclude<Severity, "safe">;
  explanation: string;
  quote: string;
  source: string;
}

export interface Doc {
  id: string;
  title: string;
  type: DocType;
  scannedOn: string; // ISO
  from: string;
  lines: string[]; // document text; flagged lines contain the exact quote
  flags: Flag[];
  summary: string;
  facts: { label: string; value: string }[];
  reply: { polite: string; firm: string };
}

const today = new Date();
export const dayOffset = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const documents: Doc[] = [
  {
    id: "rent-agreement",
    title: "Flat 4B rent agreement",
    type: "Rent agreement",
    scannedOn: dayOffset(-3),
    from: "Harbourview Lettings",
    lines: [
      "1. Term. This agreement runs for 12 months from 1 December, renewable by mutual consent.",
      "2. Rent. The tenant shall pay ₹28,000 per month on or before the 5th of each month.",
      "3. Deposit. A security deposit of ₹1,68,000 is payable on signing, refundable within 60 days of vacating.",
      "4. Deductions. The landlord may deduct from the deposit any amount he considers reasonable for wear and tear.",
      "5. Notice. Either party may end this agreement by giving one month's written notice.",
      "6. Rent increase. The landlord may revise the rent at any time with 15 days' notice to the tenant.",
      "7. Early exit. If the tenant leaves before 12 months, the full deposit shall be forfeited.",
      "8. Maintenance. Minor repairs under ₹2,000 are the responsibility of the tenant.",
      "9. Use. The premises shall be used for residential purposes only.",
      "10. Pets. No pets without prior written consent of the landlord.",
      "11. Governing terms. This agreement is subject to the local tenancy laws in force.",
    ],
    flags: [
      {
        id: "f1",
        title: "Rent can rise at any time",
        severity: "risk",
        explanation:
          "This lets the landlord raise rent mid-contract with just 15 days' warning. Most tenancy rules only allow increases once a year, with at least 3 months' notice.",
        quote: "The landlord may revise the rent at any time with 15 days' notice to the tenant.",
        source: "Rule R3: Rent increase frequency and notice",
      },
      {
        id: "f2",
        title: "Losing your whole deposit",
        severity: "caution",
        explanation:
          "Forfeiting ₹1,68,000 for leaving early is far more than the landlord's real loss. A fair penalty is usually one or two months' rent.",
        quote: "If the tenant leaves before 12 months, the full deposit shall be forfeited.",
        source: "Rule R5: Proportionate early termination penalty",
      },
    ],
    summary:
      "A 12-month lease for Flat 4B at ₹28,000 a month with a six-month deposit. Most of it is standard, but two clauses tilt heavily toward the landlord: rent can rise at any time, and leaving early costs you the entire deposit. Ask for both to be changed before signing.",
    facts: [
      { label: "Monthly rent", value: "₹28,000" },
      { label: "Deposit", value: "₹1,68,000 (6 months)" },
      { label: "Notice period", value: "1 month" },
      { label: "Starts", value: "1 December" },
      { label: "Ends", value: "30 November next year" },
      { label: "Rent due", value: "5th of each month" },
    ],
    reply: {
      polite:
        "Dear Harbourview Lettings,\n\nThank you for sending the agreement for Flat 4B. Before I sign, could we adjust two clauses?\n\n• Clause 6: I'd like rent revisions limited to once a year with three months' notice.\n• Clause 7: I'd propose an early exit penalty of one month's rent instead of the full deposit.\n\nHappy to talk this through. Thank you!\n\nBest regards,\nPriya",
      firm:
        "Dear Harbourview Lettings,\n\nI've reviewed the agreement for Flat 4B and can't sign it as written.\n\n• Clause 6 must limit rent revisions to once a year with at least three months' notice.\n• Clause 7 must cap the early exit penalty at one month's rent.\n\nPlease send a revised copy by Friday.\n\nRegards,\nPriya",
    },
  },
  {
    id: "rent-increase",
    title: "Rent increase notice",
    type: "Landlord notice",
    scannedOn: dayOffset(-8),
    from: "Mr. R. Kapoor",
    lines: [
      "Dear tenant,",
      "This is to inform you that the monthly rent for your flat will increase from ₹22,000 to ₹26,500.",
      "The new rent applies from the 1st of next month.",
      "Please acknowledge receipt of this letter.",
      "Regards, R. Kapoor",
    ],
    flags: [
      {
        id: "f3",
        title: "20% jump with short notice",
        severity: "risk",
        explanation:
          "A 20% increase with under a month's notice is unusual. Your agreement and local rules likely require more notice and a reasonable increase.",
        quote: "will increase from ₹22,000 to ₹26,500.",
        source: "Rule R3: Rent increase frequency and notice",
      },
    ],
    summary:
      "Your landlord wants to raise rent by ₹4,500 (about 20%) starting next month. That's a big jump with little warning, so it's worth checking against your agreement before you accept.",
    facts: [
      { label: "Current rent", value: "₹22,000" },
      { label: "New rent", value: "₹26,500" },
      { label: "Increase", value: "20.5%" },
      { label: "Effective", value: "1st of next month" },
    ],
    reply: {
      polite:
        "Dear Mr. Kapoor,\n\nThank you for your letter. Could you share how the new amount was worked out? My agreement mentions three months' notice for revisions, so I'd like to discuss timing.\n\nKind regards,\nPriya",
      firm:
        "Dear Mr. Kapoor,\n\nI don't accept the proposed increase. It doesn't follow the notice terms in our agreement. I'll continue paying ₹22,000 until we agree on a lawful revision.\n\nRegards,\nPriya",
    },
  },
  {
    id: "electricity-bill",
    title: "October electricity bill",
    type: "Bill",
    scannedOn: dayOffset(-12),
    from: "City Power Ltd",
    lines: [
      "Account 88214-02. Billing period 1 to 31 October.",
      "Units consumed: 212 kWh. Energy charge: ₹1,484.",
      "Fixed charge: ₹120. Taxes: ₹96.",
      "Total payable: ₹1,700. Due date: as shown on the front.",
    ],
    flags: [],
    summary: "A normal monthly bill of ₹1,700 for 212 units. Charges match the published tariff. Nothing to worry about.",
    facts: [
      { label: "Amount", value: "₹1,700" },
      { label: "Units", value: "212 kWh" },
      { label: "Period", value: "October" },
    ],
    reply: { polite: "No reply needed for this bill.", firm: "No reply needed for this bill." },
  },
  {
    id: "broadband",
    title: "FibreNet broadband contract",
    type: "Contract",
    scannedOn: dayOffset(-20),
    from: "FibreNet",
    lines: [
      "Plan: 300 Mbps unlimited at ₹899 per month.",
      "Minimum term: 12 months.",
      "This contract renews automatically for a further 12 months unless cancelled 30 days before the end date.",
      "Router remains property of FibreNet.",
    ],
    flags: [
      {
        id: "f4",
        title: "Silent auto-renewal",
        severity: "caution",
        explanation:
          "Unless you cancel 30 days before the end, you're locked in for another full year. We've added a reminder so you don't miss the window.",
        quote: "This contract renews automatically for a further 12 months unless cancelled 30 days before the end date.",
        source: "Consumer rule C2: Auto-renewal disclosure",
      },
    ],
    summary: "A 12-month broadband plan at ₹899 a month. It renews for another year automatically unless you cancel in time.",
    facts: [
      { label: "Monthly", value: "₹899" },
      { label: "Term", value: "12 months" },
      { label: "Cancel by", value: "30 days before end" },
    ],
    reply: {
      polite: "Hello FibreNet,\n\nPlease note I don't wish to auto-renew my plan. Kindly confirm it will end on the contract end date.\n\nThanks,\nPriya",
      firm: "FibreNet,\n\nI'm giving notice that my contract must not renew. Please confirm in writing.\n\nPriya",
    },
  },
  {
    id: "bank-notice",
    title: "Savings account terms update",
    type: "Other",
    scannedOn: dayOffset(-27),
    from: "Northbank",
    lines: [
      "We're updating our savings account terms from next quarter.",
      "Interest rate stays at 3.5% per year.",
      "The minimum balance requirement is unchanged.",
    ],
    flags: [],
    summary: "Your bank is refreshing its terms wording. Your interest rate and minimum balance don't change.",
    facts: [
      { label: "Interest", value: "3.5% p.a." },
      { label: "Effective", value: "Next quarter" },
    ],
    reply: { polite: "No reply needed.", firm: "No reply needed." },
  },
];

export interface Deadline {
  id: string;
  what: string;
  docId: string;
  due: string;
  done?: boolean;
}

export const deadlines: Deadline[] = [
  { id: "d1", what: "Reply about rent increase", docId: "rent-increase", due: dayOffset(-2) },
  { id: "d2", what: "Pay electricity bill", docId: "electricity-bill", due: dayOffset(3) },
  { id: "d3", what: "Send changes on rent agreement", docId: "rent-agreement", due: dayOffset(5) },
  { id: "d4", what: "Pay December rent", docId: "rent-agreement", due: dayOffset(12) },
  { id: "d5", what: "Cancel broadband before auto-renewal", docId: "broadband", due: dayOffset(19) },
  { id: "d6", what: "Review new bank terms", docId: "bank-notice", due: dayOffset(28), done: true },
];

export const rules = [
  { id: "R1", name: "Deposit cap", severity: "caution" as Severity, text: "Security deposits above two months' rent are flagged as excessive for residential leases.", source: "Model Tenancy Act, s.11", reviewed: "Reviewed 2 Oct 2026" },
  { id: "R2", name: "Deposit refund timeline", severity: "caution" as Severity, text: "Deposits should be returned within one month of vacating, minus itemised deductions.", source: "Model Tenancy Act, s.11(2)", reviewed: "Reviewed 2 Oct 2026" },
  { id: "R3", name: "Rent increase frequency and notice", severity: "risk" as Severity, text: "Rent may be revised at most once a year with at least three months' written notice.", source: "Model Tenancy Act, s.9", reviewed: "Reviewed 14 Sep 2026" },
  { id: "R4", name: "Vague deductions", severity: "caution" as Severity, text: "Deductions must be itemised. Clauses letting the landlord deduct whatever they 'consider reasonable' are flagged.", source: "Fair contract terms guidance", reviewed: "Reviewed 14 Sep 2026" },
  { id: "R5", name: "Proportionate early termination penalty", severity: "risk" as Severity, text: "Penalties for leaving early should reflect actual loss, usually one to two months' rent.", source: "Indian Contract Act, s.74", reviewed: "Reviewed 30 Aug 2026" },
  { id: "R6", name: "Notice period symmetry", severity: "caution" as Severity, text: "Notice periods should be the same for landlord and tenant.", source: "Fair contract terms guidance", reviewed: "Reviewed 30 Aug 2026" },
  { id: "R7", name: "Entry without notice", severity: "risk" as Severity, text: "Landlords need at least 24 hours' written notice before entering, except emergencies.", source: "Model Tenancy Act, s.17", reviewed: "Reviewed 12 Aug 2026" },
  { id: "R8", name: "Essential repairs", severity: "safe" as Severity, text: "Structural repairs and essential services remain the landlord's responsibility.", source: "Model Tenancy Act, s.15", reviewed: "Reviewed 12 Aug 2026" },
];

export const daysUntil = (iso: string) => {
  const a = new Date(iso + "T00:00:00");
  const b = new Date(today.toISOString().slice(0, 10) + "T00:00:00");
  return Math.round((a.getTime() - b.getTime()) / 86400000);
};

export const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export const docSeverity = (d: Doc): Severity =>
  d.flags.some((f) => f.severity === "risk") ? "risk" : d.flags.length ? "caution" : "safe";
