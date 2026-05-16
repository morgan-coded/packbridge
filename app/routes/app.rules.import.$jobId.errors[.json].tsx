import type { LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/**
 * Downloads the RuleImportJob.errors JSON blob as a file.
 * Route path: /app/rules/import/:jobId/errors.json
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const jobId = params.jobId!;

  const job = await prisma.ruleImportJob.findFirst({
    where: { id: jobId, shopDomain: session.shop },
  });
  if (!job) {
    throw new Response("Import job not found", { status: 404 });
  }

  const body = JSON.stringify(
    {
      jobId: job.id,
      fileName: job.fileName,
      totalRows: job.totalRows,
      successCount: job.successCount,
      errorCount: job.errorCount,
      status: job.status,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      errors: job.errors ?? [],
    },
    null,
    2,
  );

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="packbridge-import-${job.id}-errors.json"`,
    },
  });
};
