import Link from "next/link";

export default function GuidePage() {
  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1>Parameters Guide</h1>
      <p>This page explains the purpose of each input, aggregate, suggestion, and applied parameter used by the app.</p>

      <section style={{ marginTop: 16 }}>
        <h2>Inputs (encrypted on-chain)</h2>
        <ul>
          <li>
            <strong>Liquidity</strong>: The amount of liquidity you contribute. Submitted as an encrypted 32-bit unsigned integer.
          </li>
          <li>
            <strong>Price Lower</strong>: Lower bound of your price range. Encrypted 32-bit unsigned integer.
          </li>
          <li>
            <strong>Price Upper</strong>: Upper bound of your price range. Encrypted 32-bit unsigned integer.
          </li>
          <li>
            <strong>Volatility</strong>: A non-sensitive signal (e.g., recent market volatility) to adjust suggested parameters. Encrypted 32-bit unsigned integer.
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2>Aggregates (encrypted handles)</h2>
        <ul>
          <li>
            <strong>aggLiquidity</strong>: Sum of all users' encrypted liquidity (Σ enc(liquidity)).
          </li>
          <li>
            <strong>sumLower</strong>: Sum of all users' encrypted lower bounds (Σ enc(price_lower)).
          </li>
          <li>
            <strong>sumUpper</strong>: Sum of all users' encrypted upper bounds (Σ enc(price_upper)).
          </li>
          <li>
            <strong>twoTimesNumPositions</strong>: Encrypted value of <em>2 × number_of_positions</em>. Used to keep read-only views simple without extra FHE ops.
          </li>
        </ul>
        <p>
          The UI displays these as <strong>handles</strong> (bytes32). After an in-browser decryption authorization, the app calls FHEVM to reveal the
          corresponding <strong>clears</strong> (plaintext values) for the current user when permitted.
        </p>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2>Suggestions (encrypted handles)</h2>
        <ul>
          <li>
            <strong>suggestedFeeRatio</strong>: A recommended fee ratio derived under FHE from the submitted encrypted volatility.
          </li>
          <li>
            <strong>suggestedTickSpacing</strong>: A recommended tick spacing similarly derived under FHE from encrypted volatility.
          </li>
        </ul>
        <p>
          The reference logic increases these suggestions by a small step when the encrypted volatility exceeds an encrypted threshold. These values are
          suggestions only and remain encrypted until decrypted with the user&apos;s authorization.
        </p>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2>Applied Parameters (clear/on-chain)</h2>
        <ul>
          <li>
            <strong>appliedFeeRatio</strong>: The final fee ratio in clear, set by the contract owner via <code>applyParameters</code>.
          </li>
          <li>
            <strong>appliedTickSpacing</strong>: The final tick spacing in clear, set by the contract owner.
          </li>
        </ul>
        <p>
          Applied parameters are decoupled from suggestions: owners may adopt, ignore, or adjust the suggested values before applying them in clear. dApps
          and integrations should read these applied values as the authoritative, effective configuration.
        </p>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2>Handles vs Clears</h2>
        <ul>
          <li>
            <strong>Handles</strong> (bytes32): Opaque references to encrypted on-chain values (e.g., aggregates, suggestions). Not human-readable.
          </li>
          <li>
            <strong>Clears</strong> (plaintext): Values obtained after the user signs a short-lived authorization and the app calls FHEVM decryption.
          </li>
        </ul>
      </section>

      <div style={{ marginTop: 24 }}>
        <Link href="/">← Back to App</Link>
      </div>
    </main>
  );
}


