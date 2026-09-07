import { NextResponse } from "next/server";

import { hasRequiredScopes, readAgentAuth } from "@/lib/auth/agent-auth";
import {
  IdempotencyError,
  idempotencyApiKeyId,
  parseIdempotencyKey,
  readRequestId,
  withMultipartIdempotency,
} from "@/lib/domain/idempotency";
import { createRawAsset } from "@/lib/domain/raw-asset-repository";
import {
  discardPreparedRawAssetFile,
  parseRawAssetFormData,
  prepareParsedRawAsset,
  RawAssetUploadError,
  writePreparedRawAssetFile,
} from "@/lib/domain/raw-asset-upload";

function jsonWithRequestId(
  body: Record<string, unknown>,
  status: number,
  requestId: string,
) {
  return NextResponse.json({ request_id: requestId, ...body }, { status });
}

export async function POST(request: Request) {
  const requestId = readRequestId(request);
  const agent = await readAgentAuth(request);

  if (!agent || !hasRequiredScopes(agent.scopes, ["drafts:create"])) {
    return jsonWithRequestId({ error: "Unauthorized" }, 401, requestId);
  }

  try {
    const key = parseIdempotencyKey(request);
    const parsed = await parseRawAssetFormData(await request.formData());
    const prepared = prepareParsedRawAsset(parsed);
    const result = await withMultipartIdempotency({
      apiKeyId: idempotencyApiKeyId(agent.apiKeyId),
      key,
      method: "POST",
      path: new URL(request.url).pathname,
      multipart: parsed.multipart,
      execute: async (tx) => {
        try {
          const rawAsset = await createRawAsset(prepared.input, tx);

          await tx.agentRun.create({
            data: {
              agentName: agent.name,
              toolName: "create_raw_asset",
              status: "SUCCEEDED",
              input:
                parsed.source === "file"
                  ? {
                      originalName: parsed.file.originalName,
                      mimeType: parsed.file.mimeType,
                      kind: parsed.file.kind,
                      size: parsed.file.bytes.length,
                    }
                  : { textLength: parsed.text.length },
              output: { rawAssetId: rawAsset.id },
              apiKeyId: agent.apiKeyId,
              requestId,
            },
          });

          // Write after the DB rows so a create/AgentRun throw leaves no file.
          await writePreparedRawAssetFile(prepared);

          return {
            status: 201,
            body: { request_id: requestId, rawAsset },
          };
        } catch (error) {
          await discardPreparedRawAssetFile(prepared);
          throw error;
        }
      },
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof IdempotencyError) {
      return jsonWithRequestId(
        { error: error.message },
        error.status,
        requestId,
      );
    }

    if (error instanceof RawAssetUploadError) {
      return jsonWithRequestId({ error: error.message }, 400, requestId);
    }

    return jsonWithRequestId(
      { error: "Unable to create raw asset" },
      500,
      requestId,
    );
  }
}
