# IMPLEMENTATION_PLAN.md — Saboot (Forensic Visual-Diff Rental Arbitration Agent)

## 0. Mission & Non-Negotiable Constraints
Build **Saboot**, a MERN + Gemini Multimodal AI Agent application for **Homingo Hack Days 2026 (Track 1: AI Agents)**.
Saboot solves peer-to-peer rental deposit disputes in India (laptops, cameras, bike gear, PG rooms) by sealing Check-In condition photos with SHA-256, running a two-pass Forensic Visual-Diff + Adversarial Reviewer QA Gate on Check-Out, looking up deterministic Indian repair costs in MongoDB, routing settlements through a Human-in-the-Loop (HITL) Approval Queue, and exposing audit tools over a live stateless MCP server.

### Hard Rules for the Coding Agent
1. **Strictly ₹0 Infrastructure:** No AWS S3, no Cloudinary, no paid APIs, no credit-card services. Store `sharp`-compressed WebP images (max 1024px, ~60–100 KB each) directly inside MongoDB Atlas M0 documents.
2. **No Deprecated SDKs & Free-Tier Quota Safety:**
   - USE `@google/genai` (`import { GoogleGenAI } from "@google/genai"`). NEVER install or import `@google/generative-ai`.
   - USE Zod v4 native `z.toJSONSchema(schema)`. NEVER install `zod-to-json-schema`.
   - USE `config: { responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(schema) }` in `ai.models.generateContent(...)`, then strictly validate via `schema.parse(JSON.parse(response.text))`.
   - USE `process.env.GEMINI_MODEL || "gemini-3.5-flash-lite"` as the default (higher free-tier RPM/RPD quota for reliable dev & live judge testing) with optional `process.env.GEMINI_DIFF_MODEL` (e.g. `gemini-3.8-flash` for demo-day max vision precision, falling back automatically to `GEMINI_MODEL` on `429`/`503`). NEVER hardcode `gemini-1.5-*` or `gemini-2.5-*`.
3. **Deterministic Financial Math:** The LLM identifies visual findings ONLY. All rupee (`₹`) totals, repair-rate lookups, and deposit clamping (`0 <= totalDeduction <= depositAmount`) MUST execute in deterministic JavaScript using MongoDB `repair_rates`.
4. **100% Synthetic Data:** Never include real phone numbers, emails, Aadhaar/PAN, or real user PII anywhere in seed data.
5. **Phase-Gated Execution & Persistent Session Memory:** Complete one phase at a time. Run every verification command listed at the end of a phase and confirm it passes before starting the next phase. Update `PROGRESS.md` and push to GitHub after every completed phase so Colab/iPad runtime resets never lose progress or context.

---

## 1. Tech Stack & Repository Layout

### Stack
- **Backend (`/server`):** Node.js (ESM `"type": "module"`), Express 4.x/5.x, Mongoose, `cors`, `dotenv`, `multer` (memoryStorage, 8MB/file, max 4 files), `sharp`, `@google/genai`, `zod` (v4), `@modelcontextprotocol/sdk`, `node-cron`.
- **Frontend (`/client`):** React + Vite, Tailwind CSS v4 (`@tailwindcss/vite`), `axios`, `lucide-react`, `jspdf`.
- **Database:** MongoDB Atlas M0 Free Cluster.
- **Deployment:** Frontend on Vercel, Backend on Render Free Web Service.

### Exact Directory Structure
```text
saboot/
├── IMPLEMENTATION_PLAN.md
├── PROGRESS.md                      # Living session memory & phase checkpoint log
├── .gitignore
├── README.md
├── server/
│   ├── package.json
│   ├── .env.example
│   ├── server.js                    # Express app, CORS, routes, cron, /mcp, /health
│   ├── config/
│   │   └── db.js                    # Mongoose connection with retry logs
│   ├── models/
│   │   ├── Rental.js
│   │   ├── Inspection.js
│   │   ├── Settlement.js
│   │   └── RepairRate.js
│   ├── utils/
│   │   ├── hash.js                  # Canonical JSON + SHA-256 sealing & verification
│   │   ├── imagePrep.js             # sharp resize (1024px WebP) + buffer sha256 + base64
│   │   └── geminiClient.js          # Singleton GoogleGenAI + exponential backoff retry on 429
│   ├── agents/
│   │   ├── schemas.js               # All Zod v4 schemas for structured Gemini outputs
│   │   ├── checkinAgent.js          # Extracts preExistingFlaws + accessoriesPresent
│   │   ├── forensicDiffAgent.js     # Compares Check-In vs Check-Out; separates old vs new + angle/object guard
│   │   ├── rateLookupTool.js        # Deterministic MongoDB repair_rates matcher + ₹ math
│   │   └── reviewerGate.js          # Independent QA audit pass (PASS | FLAG)
│   ├── routes/
│   │   ├── rentalRoutes.js          # Check-in, list, get, checkout, verify-hash, tamper demo
│   │   ├── settlementRoutes.js      # Pending queue, HITL approve/edit/dispute
│   │   └── demoRoutes.js            # 1-click synthetic seed + repair rate list + demo assets
│   ├── mcp/
│   │   └── mcpServer.js             # Stateless Streamable HTTP /mcp endpoint
│   ├── jobs/
│   │   └── overdueJob.js            # node-cron scanning overdue rentals -> alerts
│   └── seed/
│       └── seedData.js              # 25+ Indian repair rates + 2 synthetic demo rentals + test assets
└── client/
    ├── package.json
    ├── vite.config.js               # React + @tailwindcss/vite
    ├── vercel.json                  # SPA rewrite rule for React Router / direct URL loads
    ├── .env.example                 # VITE_API_BASE_URL=http://localhost:5000
    └── src/
        ├── main.jsx
        ├── index.css                # @import "tailwindcss";
        ├── api/client.js            # Axios instance pointing to VITE_API_BASE_URL
        ├── utils/pdfReport.js       # Client-side jsPDF Forensic Verdict Certificate
        ├── components/
        │   ├── Navbar.jsx           # Nav + API health indicator + "Load Demo Data" button
        │   ├── TracePanel.jsx       # Glass-box step-by-step live agent execution trace
        │   ├── HashSealCard.jsx     # SHA-256 badge + Verify + Simulate Tamper / Restore
        │   ├── PhotoGrid.jsx        # Side-by-side Before vs After photo comparison
        │   └── StatusBadge.jsx
        └── pages/
            ├── Dashboard.jsx        # Active rentals, stats, overdue alerts, quick actions
            ├── CheckInPage.jsx      # Multi-photo upload + deposit ₹ -> sealed baseline
            ├── RentalDetailPage.jsx # Full Check-Out upload -> live forensic diff + trace
            └── ApprovalQueuePage.jsx# HITL Approve / Edit ₹ / Dispute + PDF download
```

---

## 2. Database Schemas (Mongoose)

### `server/models/Rental.js`
```js
{
  title: { type: String, required: true },             // e.g. "Sony A6400 Mirrorless Kit"
  category: {
    type: String,
    enum: ["electronics", "camera", "bike_gear", "pg_room", "general"],
    default: "general"
  },
  ownerName: { type: String, required: true },
  renterName: { type: String, required: true },
  depositAmount: { type: Number, required: true, min: 0 }, // INR
  dueDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ["CHECKED_IN", "UNDER_REVIEW", "SETTLED", "DISPUTED"],
    default: "CHECKED_IN"
  },
  overdueAlert: {
    flagged: { type: Boolean, default: false },
    flaggedAt: Date,
    note: String
  },
  checkinImages: [{
    label: String,
    mimeType: String,       // "image/webp"
    base64: String,
    sha256: String
  }],
  baselineSeal: {
    sha256Hash: String,     // SHA-256 over canonical payload
    sealedAt: Date,
    imageHashes: [String],
    preExistingFlaws: [{
      zone: String,
      description: String,
      severity: { type: String, enum: ["minor", "moderate", "severe"] }
    }],
    accessoriesPresent: [String],
    summary: String
  },
  tamperBackup: mongoose.Schema.Types.Mixed // Stores original preExistingFlaws for demo restore
} // timestamps: true
```

### `server/models/Inspection.js`
```js
{
  rentalId: { type: mongoose.Schema.Types.ObjectId, ref: "Rental", required: true },
  hashIntegrityPassed: { type: Boolean, required: true },
  sameObjectConfirmed: { type: Boolean, default: true },
  qualityWarning: { type: String, default: null },
  checkoutImages: [{
    label: String,
    mimeType: String,
    base64: String,
    sha256: String
  }],
  preExistingIgnored: [{
    zone: String,
    description: String,
    reason: String
  }],
  newFindings: [{
    type: { type: String, enum: ["damage", "missing_accessory"] },
    zone: String,
    itemKeyword: String,    // Normalized keyword for repair_rates lookup
    description: String,
    severity: { type: String, enum: ["minor", "moderate", "severe", "missing"] },
    evidenceNote: String
  }],
  agentTrace: [{
    step: String,           // e.g. "HASH_VERIFY", "FORENSIC_DIFF", "RATE_LOOKUP", "REVIEWER_QA_GATE"
    status: { type: String, enum: ["PASS", "WARN", "FLAG", "ERROR"] },
    detail: String,
    durationMs: Number,
    timestamp: { type: Date, default: Date.now }
  }]
} // timestamps: true
```

### `server/models/Settlement.js`
```js
{
  rentalId: { type: mongoose.Schema.Types.ObjectId, ref: "Rental", required: true },
  inspectionId: { type: mongoose.Schema.Types.ObjectId, ref: "Inspection", required: true },
  depositAmount: { type: Number, required: true },
  lineItems: [{
    findingDescription: String,
    type: String,
    severity: String,
    matchedRateId: { type: mongoose.Schema.Types.ObjectId, ref: "RepairRate", default: null },
    rateSourceLabel: String,
    deductionAmount: Number
  }],
  totalDeduction: { type: Number, required: true },
  refundToRenter: { type: Number, required: true },
  reviewerGate: {
    verdict: { type: String, enum: ["PASS", "FLAG"], required: true },
    confidence: { type: Number, min: 0, max: 100 },
    flags: [String],
    auditReasoning: String
  },
  hitlStatus: {
    type: String,
    enum: ["PENDING_APPROVAL", "APPROVED", "EDITED", "DISPUTED"],
    default: "PENDING_APPROVAL"
  },
  overrideTotalDeduction: { type: Number, default: null },
  finalOverrideNote: { type: String, default: "" },
  decidedAt: Date
} // timestamps: true
```

### `server/models/RepairRate.js`
```js
{
  category: { type: String, required: true }, // "electronics" | "camera" | "bike_gear" | "pg_room" | "general"
  itemKeyword: { type: String, required: true }, // lowercase, e.g. "charger", "lens cap", "scratch", "visor"
  severity: { type: String, enum: ["minor", "moderate", "severe", "missing"], required: true },
  costInr: { type: Number, required: true },
  sourceLabel: { type: String, required: true } // e.g. "Indian local repair benchmark (2026)"
}
```

---

## 3. Cryptographic Seal & Image Pipeline Specs

### `server/utils/imagePrep.js`
- Accept `req.files` from `multer.memoryStorage()`.
- For each file (max 4):
  1. Resize via `sharp(file.buffer).rotate().resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer()`.
  2. Compute `sha256` of the compressed buffer (`crypto.createHash("sha256").update(buf).digest("hex")`).
  3. Return `{ label: file.originalname, mimeType: "image/webp", base64: buf.toString("base64"), sha256 }`.

### `server/utils/hash.js`
- Build a deterministic canonical object:
  ```js
  export function computeBaselineSealHash({ imageHashes, preExistingFlaws, accessoriesPresent }) {
    const canonical = {
      imageHashes: [...imageHashes].sort(),
      preExistingFlaws: [...preExistingFlaws]
        .map(f => ({ zone: f.zone, description: f.description, severity: f.severity }))
        .sort((a, b) => (a.zone + a.description).localeCompare(b.zone + b.description)),
      accessoriesPresent: [...accessoriesPresent].sort()
    };
    return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  }
  ```
- Export `verifyRentalSeal(rental)`:
  - Recomputes each stored image's SHA-256 from `Buffer.from(img.base64, "base64")` and verifies it matches `img.sha256`.
  - Recomputes `computeBaselineSealHash(...)` and compares strictly against `rental.baselineSeal.sha256Hash`.
  - Returns `{ valid: boolean, expectedHash, actualHash, tamperedFieldHint }`.

---

## 4. AI Agent Pipeline Contracts (`server/agents/`)

### `server/utils/geminiClient.js`
- Initialize `const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });`.
- Helper `generateStructured({ parts, schema, systemInstruction, modelOverride })`:
  - Uses `model = modelOverride || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite"`.
  - Calls:
    ```js
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(schema)
      }
    });
    return schema.parse(JSON.parse(response.text));
    ```
  - Wrap with 3-attempt exponential backoff (1.5s, 3s, 6s) on `429` or `503` errors, plus automatic fallback from `GEMINI_DIFF_MODEL` to `GEMINI_MODEL` if a higher-tier free model hits daily/RPM limits.

### `server/agents/schemas.js` (Keep schemas flat—no recursive `$ref`)
1. **`CheckInSchema`:**
   - `summary`: `z.string()`
   - `preExistingFlaws`: `z.array(z.object({ zone: z.string(), description: z.string(), severity: z.enum(["minor", "moderate", "severe"]) }))`
   - `accessoriesPresent`: `z.array(z.string())` (e.g., `"charger"`, `"lens cap"`, `"carry strap"`, `"helmet visor"`)
2. **`ForensicDiffSchema`:**
   - `sameObjectConfirmed`: `z.boolean()` (false if check-out photo shows a completely different item or is too dark/blurry to verify)
   - `qualityWarning`: `z.string().nullable()`
   - `preExistingIgnored`: `z.array(z.object({ zone: z.string(), description: z.string(), reason: z.string() }))`
   - `newFindings`: `z.array(z.object({ type: z.enum(["damage", "missing_accessory"]), zone: z.string(), itemKeyword: z.string(), description: z.string(), severity: z.enum(["minor", "moderate", "severe", "missing"]), evidenceNote: z.string() }))`
3. **`ReviewerGateSchema`:**
   - `verdict`: `z.enum(["PASS", "FLAG"])`
   - `confidence`: `z.number()`
   - `flags`: `z.array(z.string())`
   - `auditReasoning`: `z.string()`

### Multi-Step Check-Out Orchestration (`POST /api/rentals/:id/checkout`)
Log every step with `{ step, status, detail, durationMs }` into `agentTrace`:
1. **`HASH_VERIFY` (Deterministic):** Call `verifyRentalSeal(rental)`. If `!valid`, log `status: "FLAG"` and pass `tamperDetected: true` to Reviewer Gate so the Reviewer automatically forces `verdict: "FLAG"`.
2. **`FORENSIC_DIFF` (Gemini Pass 1):** Send:
   - Text label `"--- CHECK-IN BASELINE PHOTOS ---"` + Check-In image inlineData parts.
   - Text JSON of `baselineSeal.preExistingFlaws` and `baselineSeal.accessoriesPresent`.
   - Text label `"--- CHECK-OUT RETURN PHOTOS ---"` + Check-Out image inlineData parts.
   - System instruction rules:
     - First verify `sameObjectConfirmed`: confirm Check-Out photos depict the same item/scene as Check-In and have adequate visibility (set `sameObjectConfirmed: false` and explain in `qualityWarning` if mismatched/unreadable).
     - Protect the renter from unfair charges: match every defect against `preExistingFlaws` first and list matched defects in `preExistingIgnored`.
     - Ignore lighting glare, shadows, dust, and camera angle differences.
     - Report ONLY genuinely new physical damage (scratches, marks, cracks, dents, tears, stickers/tape) OR items from `accessoriesPresent` that are clearly missing from the Check-Out photos.
     - Normalize `itemKeyword` to a simple lowercase term (`"scratch"`, `"mark"`, `"crack"`, `"dent"`, `"charger"`, `"cable"`, `"lens cap"`, `"visor"`, `"strap"`, `"battery"`, `"key"`).
3. **`RATE_LOOKUP` (Deterministic MongoDB Tool):**
   - For each finding in `newFindings`, query `RepairRate` by `(category + itemKeyword + severity)` → fallback `(general + itemKeyword + severity)` → fallback default table (`minor: 350, moderate: 900, severe: 2200, missing: 850` INR).
   - Compute `totalDeduction = Math.min(rental.depositAmount, sum(lineItems))` and `refundToRenter = rental.depositAmount - totalDeduction`.
4. **`REVIEWER_QA_GATE` (Gemini Pass 2 — Independent Adversarial Audit):**
   - Send Check-In baseline JSON, Forensic Diff output (`sameObjectConfirmed`, `qualityWarning`, `newFindings`), calculated line items, deposit amount, and `hashIntegrityPassed`.
   - Prompt role: *"You are an adversarial QA auditor protecting both renter and owner. Check if `sameObjectConfirmed` is false, if any item in `newFindings` duplicates `preExistingFlaws`, if deduction exceeds 60% of deposit without severe evidence, or if `hashIntegrityPassed` is false. Output FLAG if anything is questionable; otherwise PASS."*
   - Enforce deterministic safety override in Node.js: if `!hashIntegrityPassed || !diff.sameObjectConfirmed`, guarantee `reviewerGate.verdict = "FLAG"` regardless of model wording.
   - Save `Inspection` and `Settlement` (`hitlStatus: "PENDING_APPROVAL"`), update `rental.status = "UNDER_REVIEW"`, return `{ rental, inspection, settlement }`.

---

## 5. REST API, MCP Server & Scheduled Job Specs

### REST Endpoints
- `GET /health` → `{ ok: true, model, dbState, timestamp }`
- `POST /api/demo/seed` → Idempotently seeds `repair_rates` (25+ realistic Indian items) and 2 synthetic demo rentals (one `CHECKED_IN` ready for Check-Out demo + one `UNDER_REVIEW` with complete Inspection & Settlement so judges see every screen working right away).
- `GET /api/demo/rates` → Lists seeded `repair_rates` for UI transparency.
- `GET /api/rentals` → List rentals (omit heavy `base64` arrays or return first thumbnail only for fast list loading).
- `GET /api/rentals/:id` → Full rental + latest `inspection` + latest `settlement` + live `verifyRentalSeal` result.
- `POST /api/rentals/checkin` → `multipart/form-data` (`photos[]`, `title`, `category`, `ownerName`, `renterName`, `depositAmount`, `dueDate`) → `sharp` → `checkinAgent` → SHA-256 seal → save `Rental`.
- `POST /api/rentals/:id/checkout` → `multipart/form-data` (`photos[]`) → `sharp` → 4-stage pipeline → save `Inspection` + `Settlement`.
- `GET /api/rentals/:id/verify-hash` → Live SHA-256 recomputation proof.
- `POST /api/rentals/:id/simulate-tamper` → Demo-only endpoint: backs up `preExistingFlaws` into `tamperBackup` and mutates one flaw description WITHOUT updating `sha256Hash` so judges can witness tamper detection live.
- `POST /api/rentals/:id/restore-seal` → Restores `preExistingFlaws` from `tamperBackup`.
- `GET /api/settlements/pending` → All settlements populated with `rentalId` and `inspectionId`, newest first.
- `PATCH /api/settlements/:id/decision` → Body `{ action: "APPROVE" | "EDIT" | "DISPUTE", overrideTotalDeduction?, note? }`. Recomputes `refundToRenter` deterministically on `EDIT`, updates `settlement.hitlStatus` and `rental.status` (`SETTLED` or `DISPUTED`).

### Stateless MCP Server (`server/mcp/mcpServer.js`)
Mount at `POST /mcp` in `server.js` using `@modelcontextprotocol/sdk`:
- Imports:
  ```js
  import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
  import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
  ```
- Create a `buildMcpServer()` factory instantiated fresh per `POST /mcp` request, connected to `new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })`, with cleanup on `res.on("close", () => { transport.close(); server.close(); })`.
- Register 3 read-only forensic tools using `server.registerTool(...)`:
  1. `list_pending_settlements` — returns all HITL-pending settlements with rental title, deposit ₹, proposed deduction ₹, and Reviewer QA verdict.
  2. `verify_rental_seal` (`inputSchema: { rentalId: z.string() }`) — runs live SHA-256 verification against MongoDB and returns cryptographic integrity proof.
  3. `get_forensic_report` (`inputSchema: { rentalId: z.string() }`) — returns full `preExistingIgnored`, `newFindings`, line items, and Reviewer QA Gate reasoning.

### Scheduled Background Job (`server/jobs/overdueJob.js`)
- `node-cron` running every 15 minutes (`"*/15 * * * *"`) plus manual trigger `POST /api/jobs/run-overdue` for live demos.
- Scans `rentals` where `status === "CHECKED_IN"` and `dueDate < new Date()`, sets `overdueAlert: { flagged: true, flaggedAt: new Date(), note: "Checkout overdue — follow-up inspection required" }`.

---

## 6. Frontend UX & Visual Design Direction (`client/`)

### Visual Identity
- **Theme:** Clean, high-contrast **Forensic Slate & Emerald Trust** (`bg-slate-950` surface, `bg-slate-900` cards, `border-slate-800`, emerald accents for verified/protected items, amber for QA warnings, rose for new damage or tamper alerts, monospace font for SHA-256 hashes and ₹ ledger amounts).
- **Zero-Friction Judge UX:**
  - Top bar shows **Backend Status dot** (wakes Render `/health` automatically on mount) and a **"Seed Demo Rentals"** button.
  - **Check-In Page:** Drag-and-drop or mobile/iPad camera capture (`accept="image/*"`), instant photo preview, deposit input in `₹`, quick preset buttons (`"Laptop Kit"`, `"Bike Helmet"`, `"DSLR Camera"`, `"PG Room"`).
  - **Rental Detail / Check-Out Diff Page (Split-Screen Hero View):**
    - **Left Column:** Side-by-side **Check-In Sealed Photos** vs **Check-Out Photos**, live **HashSealCard** (`[Verify SHA-256]` + `[Simulate DB Tamper]` + `[Restore]`), Green **"Pre-Existing Flaws Ignored (₹0)"** card, and Red **"New Damage / Missing Accessories"** card with itemized `₹` rates.
    - **Right Column:** **Glass-Box Live Agent Trace Panel** showing every pipeline stage (`HASH_VERIFY` → `FORENSIC_DIFF` → `RATE_LOOKUP` → `REVIEWER_QA_GATE`) with status badges, millisecond timings, and Reviewer QA confidence meter.
  - **HITL Approval Queue Page:** Review pending settlements, **Approve**, **Edit Deduction ₹** (live refund recalculation), **Flag Dispute**, and click **"Download Forensic Verdict PDF"** (generated client-side via `jsPDF` including the SHA-256 seal hash, ignored old flaws, new itemized deductions, and final refund split).

---

## 7. Phased Execution Plan & Mandatory Verification Gates

Execute strictly in order. Do NOT move to the next phase until the current phase's verification checks pass.

### Phase 1: Monorepo Scaffold, MongoDB Connection & Seed Data
- Initialize `/server` and `/client` with exact dependencies and `.gitignore` (ignoring `node_modules`, `.env`, `dist`).
- Implement `server/config/db.js`, all 4 Mongoose models, `server/seed/seedData.js` (25+ Indian repair rates across `electronics`, `camera`, `bike_gear`, `pg_room`, `general`), and `GET /health`.
- **Gate 1 Verification:**
  - Start server (`npm run dev`).
  - `curl http://localhost:5000/health` returns `200` with `dbState: "connected"`.
  - `curl -X POST http://localhost:5000/api/demo/seed` inserts repair rates idempotently (running twice creates no duplicates).

### Phase 2: Image Compression, SHA-256 Seal & Check-In Agent
- Implement `utils/imagePrep.js`, `utils/hash.js`, `utils/geminiClient.js`, `agents/schemas.js`, `agents/checkinAgent.js`.
- Implement `POST /api/rentals/checkin`, `GET /api/rentals`, `GET /api/rentals/:id`, `GET /api/rentals/:id/verify-hash`, `POST /api/rentals/:id/simulate-tamper`, and `POST /api/rentals/:id/restore-seal`.
- **Gate 2 Verification:**
  - Upload 2 real local test photos via `curl -F` to `POST /api/rentals/checkin`.
  - Confirm compressed WebP size per image is under 150 KB in MongoDB, `baselineSeal.sha256Hash` is a 64-char hex string, and `GET /verify-hash` returns `valid: true`.
  - Trigger `/simulate-tamper` → confirm `GET /verify-hash` returns `valid: false` → trigger `/restore-seal` → confirm `valid: true`.

### Phase 3: Forensic Visual-Diff Agent, Rate Lookup & Reviewer QA Gate
- Implement `agents/forensicDiffAgent.js`, `agents/rateLookupTool.js`, `agents/reviewerGate.js`.
- Wire `POST /api/rentals/:id/checkout` and `routes/settlementRoutes.js` (`GET /api/settlements/pending`, `PATCH /api/settlements/:id/decision`).
- **Gate 3 Verification:**
  - Run `POST /api/rentals/:id/checkout` with modified Check-Out photos.
  - Confirm response contains non-empty `inspection.agentTrace` with all 4 steps (`HASH_VERIFY`, `FORENSIC_DIFF`, `RATE_LOOKUP`, `REVIEWER_QA_GATE`), deterministic `refundToRenter === depositAmount - totalDeduction`, and a `Settlement` in `PENDING_APPROVAL`.
  - Test `PATCH /api/settlements/:id/decision` with `EDIT` and `APPROVE` and confirm MongoDB state updates cleanly.

### Phase 4: Stateless MCP Server (`/mcp`) & Overdue Cron Job
- Implement `server/mcp/mcpServer.js` mounted at `POST /mcp` and `server/jobs/overdueJob.js` + `POST /api/jobs/run-overdue`.
- **Gate 4 Verification:**
  - Run `tools/list`:
    ```bash
    curl -s -X POST http://localhost:5000/mcp \
      -H "Content-Type: application/json" \
      -H "Accept: application/json, text/event-stream" \
      -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
    ```
  - Confirm JSON response lists `list_pending_settlements`, `verify_rental_seal`, and `get_forensic_report`.
  - Run a `tools/call` for `verify_rental_seal` with a real rental ID and confirm valid JSON tool output.

### Phase 5: React Frontend (All 4 Views + Glass-Box Trace + PDF Export)
- Configure Tailwind v4 in `client/vite.config.js` and `client/src/index.css`.
- Build `Navbar`, `Dashboard`, `CheckInPage`, `RentalDetailPage` (with `PhotoGrid`, `HashSealCard`, `TracePanel`), `ApprovalQueuePage`, and `utils/pdfReport.js`.
- **Gate 5 Verification:**
  - `npm run build` in `/client` exits with code 0 and zero errors.
  - Complete full UI walkthrough locally: Check-In real desk object → Verify Seal → Simulate Tamper → Restore → Check-Out with visible mark / missing item → inspect TracePanel → Approve in HITL Queue → download PDF Verdict.

### Phase 6: Free-Tier Cloud Deployment & Production Hardening
- Configure `CORS_ORIGIN` on backend to allow the deployed Vercel URL + localhost.
- Add `client/vercel.json` with SPA rewrite rule (`"/(.*)" -> "/index.html"`) so page refreshes on `/rentals/:id` never 404.
- Deploy `/server` on Render Free Web Service (Root Directory: `server`, Build: `npm install`, Start: `node server.js`).
- Deploy `/client` on Vercel (Root Directory: `client`, Env: `VITE_API_BASE_URL=https://<render-url>`).
- **Gate 6 Verification:**
  - Hit `https://<render-url>/health` and `POST https://<render-url>/mcp` (`tools/list`).
  - Complete one full live Check-In → Check-Out → HITL Approval → PDF download on the public Vercel URL.

### Phase 7: Hackathon Submission Polish
- Write a crisp `README.md` containing:
  1. Problem statement & live deployed URL + demo video link.
  2. Architecture overview (including Check-In Seal → Forensic Diff → Reviewer QA Gate → HITL → MCP).
  3. Local setup instructions & `.env.example` keys.
  4. MCP verification `curl` snippet.
  5. **Mandatory AI Disclosure Section** explicitly listing all AI models (`gemini-3.5-flash-lite` / `gemini-3.8-flash`), SDKs (`@google/genai`, `@modelcontextprotocol/sdk`), and coding assistants used.
