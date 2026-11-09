import type { Deadline, Doc, DocType, Flag } from "@/data/mock";

const API_BASE = (import.meta.env["VITE_API_BASE_URL"] || "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);
const USER_ID = "demo-user";
const CACHE_KEY = "paperguard-document-cache";

type ApiAmount = { label: string; value: number | string; currency: string };
type ApiDate = { label: string; date: string };
type ApiClause = { topic: string; value: string; quote: string };
type ApiExtraction = {
  doc_type: string;
  summary: string;
  parties: string[];
  amounts: ApiAmount[];
  dates: ApiDate[];
  clauses: ApiClause[];
  reply: string;
};
type ApiRuleHit = {
  rule_id: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  quote: string;
  source: string;
};
type ApiDeadline = {
  id: number | null;
  document_id: number | null;
  due_date: string;
  what: string;
  status: "open" | "done" | "overdue";
};
type ApiAnalysis = {
  document_id: number | null;
  saved: boolean;
  extraction: ApiExtraction;
  rule_hits: ApiRuleHit[];
  deadlines: ApiDeadline[];
  disclaimer: string;
};
type ApiDocumentDetail = {
  id: number;
  uploaded_at: string;
  extraction: ApiExtraction;
  rule_hits: ApiRuleHit[];
  deadlines: ApiDeadline[];
};
type ApiDocumentSummary = {
  id: number;
  doc_type: string;
  summary: string;
  uploaded_at: string;
  flag_count: number;
  highest_severity: string | null;
};

export type ConnectedDocument = { doc: Doc; deadlines: Deadline[] };

function apiUrl(path: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${API_BASE}${path}${separator}user_id=${encodeURIComponent(USER_ID)}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), init);
  if (!response.ok) {
    let message = `PaperGuard could not complete the request (${response.status}).`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) message = body.detail;
    } catch {
      // Keep the safe fallback message for non-JSON failures.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

function docType(value: string): DocType {
  const types: Record<string, DocType> = {
    rent_agreement: "Rent agreement",
    landlord_notice: "Landlord notice",
    bill: "Bill",
    contract: "Contract",
  };
  return types[value] ?? "Other";
}

function severity(hit: ApiRuleHit): Flag["severity"] {
  return hit.severity === "critical" || hit.severity === "high" ? "risk" : "caution";
}

function titleFor(extraction: ApiExtraction) {
  const name = docType(extraction.doc_type);
  const party = extraction.parties[0];
  return party ? `${name} - ${party}` : name;
}

function formatAmount(item: ApiAmount) {
  return `${item.currency} ${Number(item.value).toLocaleString("en-IN")}`;
}

function toConnectedDocument(
  id: string,
  uploadedAt: string,
  extraction: ApiExtraction,
  hits: ApiRuleHit[],
  apiDeadlines: ApiDeadline[],
  originalText?: string,
  originalName?: string,
): ConnectedDocument {
  const flags: Flag[] = hits.map((hit) => ({
    id: hit.rule_id,
    title: hit.message.split(".")[0] || "Rulebook warning",
    severity: severity(hit),
    explanation: hit.message,
    quote: hit.quote || "The rule matched an extracted fact. Check the original document.",
    source: hit.source,
  }));
  const textLines = originalText
    ? originalText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    : extraction.clauses.map((clause) => clause.quote).filter(Boolean);
  const lines = textLines.length ? textLines : [extraction.summary];
  const facts = [
    ...extraction.amounts.map((item) => ({ label: item.label, value: formatAmount(item) })),
    ...extraction.dates.map((item) => ({ label: item.label, value: item.date })),
  ];
  const doc: Doc = {
    id,
    title: originalName || titleFor(extraction),
    type: docType(extraction.doc_type),
    scannedOn: uploadedAt.slice(0, 10),
    from: extraction.parties.join(" and ") || "Uploaded document",
    lines,
    flags,
    summary: extraction.summary,
    facts,
    reply: { polite: extraction.reply, firm: extraction.reply },
  };
  const deadlines: Deadline[] = apiDeadlines.map((item, index) => ({
    id: String(item.id ?? `private-${index}`),
    what: item.what,
    docId: id,
    due: item.due_date,
    done: item.status === "done",
  }));
  return { doc, deadlines };
}

function readCache(): Record<string, ConnectedDocument> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_KEY) || "{}") as Record<
      string,
      ConnectedDocument
    >;
  } catch {
    return {};
  }
}

function cacheDocument(value: ConnectedDocument) {
  if (typeof window === "undefined") return;
  const cache = readCache();
  cache[value.doc.id] = value;
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export async function analyzeDocument(input: {
  file?: File;
  text?: string;
  noSave: boolean;
}): Promise<ConnectedDocument> {
  let body: BodyInit;
  let headers: HeadersInit | undefined;
  if (input.file) {
    const form = new FormData();
    form.append("file", input.file);
    form.append("no_save", String(input.noSave));
    form.append("user_id", USER_ID);
    body = form;
  } else {
    body = JSON.stringify({ text: input.text, no_save: input.noSave, user_id: USER_ID });
    headers = { "Content-Type": "application/json" };
  }
  const init: RequestInit = { method: "POST", body };
  if (headers) init.headers = headers;
  const response = await fetch(`${API_BASE}/api/analyze`, init);
  if (!response.ok) {
    let message = "PaperGuard could not analyze this document.";
    try {
      const error = (await response.json()) as { detail?: string };
      if (error.detail) message = error.detail;
    } catch {
      // Keep the safe fallback message.
    }
    throw new Error(message);
  }
  const result = (await response.json()) as ApiAnalysis;
  const id = String(result.document_id ?? `private-${Date.now()}`);
  const connected = toConnectedDocument(
    id,
    new Date().toISOString(),
    result.extraction,
    result.rule_hits,
    result.deadlines,
    input.text,
    input.file?.name,
  );
  cacheDocument(connected);
  return connected;
}

export async function getDocument(id: string): Promise<ConnectedDocument> {
  const cached = readCache()[id];
  if (cached) return cached;
  if (id.startsWith("private-")) throw new Error("This no-save result is no longer available.");
  const detail = await request<ApiDocumentDetail>(`/api/documents/${encodeURIComponent(id)}`);
  const connected = toConnectedDocument(
    String(detail.id),
    detail.uploaded_at,
    detail.extraction,
    detail.rule_hits,
    detail.deadlines,
  );
  cacheDocument(connected);
  return connected;
}

export async function getDocuments(): Promise<Doc[]> {
  const summaries = await request<ApiDocumentSummary[]>("/api/documents");
  const cache = readCache();
  return summaries.map((item) => {
    const cached = cache[String(item.id)]?.doc;
    if (cached) return cached;
    const placeholderFlags: Flag[] = Array.from({ length: item.flag_count }, (_, index) => ({
      id: `summary-${item.id}-${index}`,
      title: "Open this document to review the warning",
      severity:
        item.highest_severity === "high" || item.highest_severity === "critical"
          ? "risk"
          : "caution",
      explanation: "Open the document to see the full rulebook result.",
      quote: "",
      source: "PaperGuard rulebook",
    }));
    return {
      id: String(item.id),
      title: docType(item.doc_type),
      type: docType(item.doc_type),
      scannedOn: item.uploaded_at.slice(0, 10),
      from: "Uploaded document",
      lines: [item.summary],
      flags: placeholderFlags,
      summary: item.summary,
      facts: [],
      reply: { polite: "", firm: "" },
    };
  });
}

export async function getDeadlines(includeDone = true): Promise<Deadline[]> {
  const values = await request<ApiDeadline[]>(`/api/deadlines?include_done=${includeDone}`);
  return values.map((item) => ({
    id: String(item.id),
    docId: String(item.document_id),
    what: item.what,
    due: item.due_date,
    done: item.status === "done",
  }));
}

export async function setDeadlineDone(id: string, done: boolean): Promise<void> {
  await request(`/api/deadlines/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: done ? "done" : "open" }),
  });
}

export function calendarUrl() {
  return apiUrl("/api/deadlines/calendar");
}
