import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect } from "react-router";

import styles from "./styles.module.css";

export const meta: MetaFunction = () => [
  { title: "PackBridge - Shopify B2B pack-unit translation" },
  {
    name: "description",
    content:
      "Translate valid Shopify B2B orders into downstream-safe pack units and deliver signed payloads to ERP, EDI, warehouse, or ops endpoints.",
  },
];

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
      <header className={styles.nav}>
        <a className={styles.brand} href="/">
          <span className={styles.brandMark} aria-hidden="true">
            PB
          </span>
          <span>
            <strong>PackBridge</strong>
            <small>Shopify B2B pack-unit translation</small>
          </span>
        </a>
        <nav className={styles.navLinks} aria-label="PackBridge sections">
          <a href="#workflow">Workflow</a>
          <a href="#trust">Trust</a>
          <a href="#fit">Fit</a>
          <a href="/docs.html">Docs</a>
          <a href="/faq.html">FAQ</a>
          <a href="/privacy.html">Privacy</a>
        </nav>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Post-order tools for Shopify B2B</p>
            <h1 className={styles.heading}>
              Translate Shopify orders into downstream-safe pack units.
            </h1>
            <p className={styles.text}>
              PackBridge takes valid Shopify B2B orders, resolves merchant
              pack rules, and sends signed JSON payloads to the ERP, EDI,
              warehouse, or ops endpoint that needs cases, inners, pallets,
              or other pack units.
            </p>
            <div className={styles.actions}>
              <a className={styles.primaryAction} href="/app">
                Open PackBridge
              </a>
              <a className={styles.secondaryAction} href="mailto:support@packbridge.app">
                Talk to support
              </a>
            </div>
            <dl className={styles.guardrails} aria-label="PackBridge guardrails">
              <div>
                <dt>Post-order</dt>
                <dd>Runs after Shopify creates the order.</dd>
              </div>
              <div>
                <dt>Read-only</dt>
                <dd>No product, checkout, or order writes.</dd>
              </div>
              <div>
                <dt>Signed</dt>
                <dd>HMAC payloads for downstream systems.</dd>
              </div>
            </dl>
          </div>

          <div className={styles.payloadPanel} aria-label="PackBridge payload example">
            <div className={styles.panelTop}>
              <span>Example translation</span>
              <strong>orders/create</strong>
            </div>
            <div className={styles.translationGrid}>
              <div className={styles.translationCard}>
                <span>Shopify order</span>
                <strong>100 each</strong>
                <p>SKU: NITRILE-GLOVE-L</p>
              </div>
              <div className={styles.arrow} aria-hidden="true">
                &rarr;
              </div>
              <div className={styles.translationCard}>
                <span>Pack rule</span>
                <strong>50 each / case</strong>
                <p>Company + variant scope</p>
              </div>
              <div className={styles.arrow} aria-hidden="true">
                &rarr;
              </div>
              <div className={styles.translationCard}>
                <span>Outbound payload</span>
                <strong>2 CASE</strong>
                <p>Signed JSON delivery</p>
              </div>
            </div>
            <pre className={styles.payload}>
{`{
  "source": "shopify",
  "input_quantity": 100,
  "output_quantity": 2,
  "output_unit": "CASE",
  "status": "completed"
}`}
            </pre>
          </div>
        </section>

        <section className={styles.section} id="workflow">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>How it works</p>
            <h2>Shopify stays the order source. PackBridge prepares the downstream handoff.</h2>
          </div>
          <div className={styles.steps}>
            <article>
              <span>01</span>
              <h3>Define pack rules</h3>
              <p>
                Scope rules by company, location, product, or variant. Import
                larger rule sets by CSV when setup needs to move faster.
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>Resolve each B2B order</h3>
              <p>
                When an order is created, PackBridge finds the most specific
                matching rule and validates divisibility against the pack size.
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>Deliver the payload</h3>
              <p>
                Downstream systems receive normalized quantities in signed JSON,
                with retries and delivery status recorded for review.
              </p>
            </article>
          </div>
        </section>

        <section className={`${styles.section} ${styles.trustSection}`} id="trust">
          <div>
            <p className={styles.eyebrow}>Trust boundaries</p>
            <h2>Designed for the gap between Shopify B2B and operations systems.</h2>
          </div>
          <div className={styles.trustGrid}>
            <article>
              <h3>Not checkout enforcement</h3>
              <p>
                Shopify handles valid order creation. PackBridge processes
                orders after creation and prepares the pack-unit translation
                your downstream workflow expects.
              </p>
            </article>
            <article>
              <h3>No write scopes</h3>
              <p>
                PackBridge reads orders, products, companies, and purchasing
                context so it can resolve rules. It does not modify shop data.
              </p>
            </article>
            <article>
              <h3>Audit trail included</h3>
              <p>
                Jobs keep the line-item events, warnings, holds, outbound
                attempts, and delivery status visible inside the admin UI.
              </p>
            </article>
            <article>
              <h3>Not a WMS or ERP</h3>
              <p>
                PackBridge does one narrow job: translate valid B2B orders into
                pack-unit payloads that other systems can consume.
              </p>
            </article>
          </div>
        </section>

        <section className={styles.section} id="fit">
          <div className={styles.fitPanel}>
            <div>
              <p className={styles.eyebrow}>Best fit</p>
              <h2>For merchants who sell in one unit and fulfill in another.</h2>
            </div>
            <ul className={styles.fitList}>
              <li>Industrial suppliers with case-pack rules</li>
              <li>Food, beverage, janitorial, or facility supply distributors</li>
              <li>Manufacturers with customer-specific pack logic</li>
              <li>Ops teams sending order data to ERP, EDI, or warehouse endpoints</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
