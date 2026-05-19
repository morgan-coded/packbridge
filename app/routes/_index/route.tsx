import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return null;
};

export default function App() {
  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <p className={styles.eyebrow}>PackBridge for Shopify B2B</p>
        <h1 className={styles.heading}>
          Translate B2B orders into ERP-safe pack units.
        </h1>
        <p className={styles.text}>
          PackBridge turns valid Shopify B2B order quantities into downstream
          units like cases, inner packs, and pallets, then delivers a signed
          payload to your ERP, EDI, or warehouse endpoint.
        </p>
        <ul className={styles.list}>
          <li>
            <strong>Customer-specific rules.</strong> Resolve pack logic by
            company, location, product, or variant.
          </li>
          <li>
            <strong>Audit-ready jobs.</strong> Track every normalized line item,
            warning, hold, and outbound delivery.
          </li>
          <li>
            <strong>Signed webhooks.</strong> Send HMAC-signed JSON to the
            systems your operations team already uses.
          </li>
        </ul>
        <p className={styles.note}>
          Install and open PackBridge from Shopify Admin or the Shopify App
          Store. For privacy details, see <a href="/privacy.html">the privacy
          policy</a>. For setup, see <a href="/docs.html">the documentation</a>.
        </p>
      </div>
    </div>
  );
}
