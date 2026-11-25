import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import mongoose from "mongoose";
import * as z from "zod";
import { Inspection } from "../models/Inspection.js";
import { Rental } from "../models/Rental.js";
import { Settlement } from "../models/Settlement.js";
import { verifyRentalSeal } from "../utils/hash.js";

function jsonTextResult(payload, isError = false) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
    ...(isError ? { isError: true } : {}),
  };
}

async function loadRentalOrError(rentalId) {
  if (!rentalId || !mongoose.Types.ObjectId.isValid(rentalId)) {
    return {
      errorResult: jsonTextResult(
        { error: `Invalid rentalId: "${rentalId || ""}"` },
        true
      ),
    };
  }

  const rental = await Rental.findById(rentalId).lean();
  if (!rental) {
    return {
      errorResult: jsonTextResult(
        { error: `Rental not found: ${rentalId}` },
        true
      ),
    };
  }

  return { rental };
}

/**
 * Creates a fresh stateless McpServer instance wired with Saboot's
 * read-only forensic inspection and cryptographic verification tools.
 */
export function buildMcpServer() {
  const server = new McpServer({
    name: "saboot-forensic-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "list_pending_settlements",
    {
      title: "List Pending Settlements",
      description:
        "Returns all HITL-pending settlements with rental title, deposit INR, proposed deduction INR, and Reviewer QA Gate verdict.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const settlements = await Settlement.find({
        hitlStatus: "PENDING_APPROVAL",
      })
        .populate({
          path: "rentalId",
          select: "title category ownerName renterName depositAmount status",
        })
        .sort({ createdAt: -1 })
        .lean();

      return jsonTextResult({
        count: settlements.length,
        settlements,
      });
    }
  );

  server.registerTool(
    "verify_rental_seal",
    {
      title: "Verify Rental SHA-256 Seal",
      description:
        "Recomputes SHA-256 hashes over stored check-in photos and canonical baseline ledger in MongoDB to verify cryptographic seal integrity.",
      inputSchema: {
        rentalId: z.string().describe("MongoDB ObjectId of the rental"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ rentalId }) => {
      const { rental, errorResult } = await loadRentalOrError(rentalId);
      if (errorResult) return errorResult;

      const sealResult = verifyRentalSeal(rental);
      return jsonTextResult({
        rentalId: String(rental._id),
        title: rental.title,
        status: rental.status,
        ...sealResult,
      });
    }
  );

  server.registerTool(
    "get_forensic_report",
    {
      title: "Get Forensic Inspection Report",
      description:
        "Returns rental metadata (without base64 images), live SHA-256 seal verification, latest Inspection (preExistingIgnored, newFindings, agentTrace), and latest Settlement.",
      inputSchema: {
        rentalId: z.string().describe("MongoDB ObjectId of the rental"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ rentalId }) => {
      const { rental, errorResult } = await loadRentalOrError(rentalId);
      if (errorResult) return errorResult;

      const sealVerification = verifyRentalSeal(rental);
      const { checkinImages, ...rentalMetadata } = rental;

      const [inspection, settlement] = await Promise.all([
        Inspection.findOne({ rentalId: rental._id })
          .sort({ createdAt: -1 })
          .select("-checkoutImages")
          .lean(),
        Settlement.findOne({ rentalId: rental._id })
          .sort({ createdAt: -1 })
          .lean(),
      ]);

      return jsonTextResult({
        rental: {
          ...rentalMetadata,
          checkinImageCount: Array.isArray(checkinImages)
            ? checkinImages.length
            : 0,
        },
        sealVerification,
        inspection,
        settlement,
      });
    }
  );

  return server;
}

/**
 * Express handler for stateless Streamable HTTP MCP requests on POST /mcp.
 */
export async function handleMcpRequest(req, res) {
  const server = buildMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[mcp] Request error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: err.message || "Internal MCP server error",
        },
        id: req.body?.id ?? null,
      });
    }
  }
}
