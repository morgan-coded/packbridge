import type { LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import { CSV_TEMPLATE } from "../services/csv-importer.server";

/**
 * Serves the CSV template as a downloadable file.
 * Route path: /app/rules/template.csv
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return new Response(CSV_TEMPLATE, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="packbridge-rules-template.csv"',
    },
  });
};
