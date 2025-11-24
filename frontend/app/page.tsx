"use client";

import { ethers } from "ethers";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMetaMask } from "@/hooks/metamask/useMetaMaskProvider";
import { useFhevm } from "@/fhevm/useFhevm";
import { GenericStringInMemoryStorage } from "@/fhevm/GenericStringStorage";
import { useFHEAMM } from "@/hooks/useFHEAMM";

type PageType = "dashboard" | "position" | "volatility" | "aggregates" | "parameters" | "guide";

export default function Page() {
  const { provider, chainId, accounts, isConnected, connect } = useMetaMask();
  const [currentPage, setCurrentPage] = useState<PageType>("dashboard");

  const { instance, status } = useFhevm({
    provider: provider,
    chainId: chainId,
    initialMockChains: { 31337: "http://localhost:8545" },
    enabled: true,
  });

  const [signer, setSigner] = useState<ethers.JsonRpcSigner | undefined>(
    undefined
  );
  const [runner, setRunner] = useState<ethers.ContractRunner | undefined>(
    undefined
  );

  const sameChainRef = useRef<(c: number | undefined) => boolean>(() => true);
  const sameSignerRef = useRef<
    (s: ethers.JsonRpcSigner | undefined) => boolean
  >(() => true);

  useEffect(() => {
    if (!provider || !chainId) {
      setSigner(undefined);
      setRunner(undefined);
      return;
    }
    const web3 = new ethers.BrowserProvider(provider);
    web3.getSigner().then(setSigner).catch(() => setSigner(undefined));
    setRunner(web3);
  }, [provider, chainId]);

  useEffect(() => {
    const last = chainId;
    sameChainRef.current = (c) => c === last;
  }, [chainId]);

  useEffect(() => {
    const last = signer;
    sameSignerRef.current = (s) => s?.address === last?.address;
  }, [signer]);

  const storage = useMemo(() => new GenericStringInMemoryStorage(), []);

  const amm = useFHEAMM({
    instance,
    fhevmDecryptionSignatureStorage: storage,
    chainId,
    ethersSigner: signer,
    ethersReadonlyProvider: runner,
    sameChain: sameChainRef,
    sameSigner: sameSignerRef,
  });

  const getStatusType = (status: string) => {
    if (status.toLowerCase().includes("ready") || status.toLowerCase().includes("connected")) return "success";
    if (status.toLowerCase().includes("loading") || status.toLowerCase().includes("init")) return "loading";
    if (status.toLowerCase().includes("error") || status.toLowerCase().includes("fail")) return "error";
    return "info";
  };

  const menuItems = [
    { id: "dashboard" as PageType, label: "Dashboard", icon: "🏠" },
    { id: "position" as PageType, label: "Submit Position", icon: "📊" },
    { id: "volatility" as PageType, label: "Submit Volatility", icon: "📈" },
    { id: "aggregates" as PageType, label: "Aggregates", icon: "🔍" },
    { id: "parameters" as PageType, label: "Apply Parameters", icon: "👑" },
    { id: "guide" as PageType, label: "Parameter Guide", icon: "📚" },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage amm={amm} status={status} chainId={chainId} getStatusType={getStatusType} />;
      case "position":
        return <PositionPage amm={amm} />;
      case "volatility":
        return <VolatilityPage amm={amm} />;
      case "aggregates":
        return <AggregatesPage amm={amm} />;
      case "parameters":
        return <ParametersPage amm={amm} />;
      case "guide":
        return <GuidePage />;
      default:
        return <DashboardPage amm={amm} status={status} chainId={chainId} getStatusType={getStatusType} />;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", display: "flex" }}>
      {/* Sidebar */}
      <aside style={{
        width: "280px",
        background: "linear-gradient(180deg, #1a1a1a 0%, #2d2d2d 100%)",
        borderRight: "4px solid #FFD700",
        position: "fixed",
        height: "100vh",
        overflowY: "auto",
        zIndex: 1000
      }}>
        {/* Logo Section */}
        <div style={{
          padding: "24px 20px",
          borderBottom: "1px solid rgba(255, 215, 0, 0.2)"
        }}>
          <h1 style={{ 
            fontSize: "1.5rem", 
            fontWeight: "700",
            background: "linear-gradient(to right, #FFD700, #FFC700)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: "8px",
            lineHeight: "1.2"
          }}>
            🔐 FHE AMM
          </h1>
          <p style={{ color: "#999", fontSize: "0.75rem", margin: 0, lineHeight: "1.3" }}>
            Privacy-preserving Optimizer
          </p>
        </div>

        {/* Navigation Menu */}
        <nav style={{ padding: "16px 0" }}>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              style={{
                width: "100%",
                padding: "14px 20px",
                background: currentPage === item.id ? "rgba(255, 215, 0, 0.15)" : "transparent",
                border: "none",
                borderLeft: currentPage === item.id ? "4px solid #FFD700" : "4px solid transparent",
                color: currentPage === item.id ? "#FFD700" : "#e0e0e0",
                textAlign: "left",
                cursor: "pointer",
                fontSize: "0.95rem",
                fontWeight: currentPage === item.id ? "600" : "400",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}
              onMouseEnter={(e) => {
                if (currentPage !== item.id) {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage !== item.id) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <span style={{ fontSize: "1.25rem" }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Connection Status */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "20px",
          borderTop: "1px solid rgba(255, 215, 0, 0.2)"
        }}>
          {!isConnected ? (
            <button onClick={connect} style={{ 
              width: "100%",
              padding: "12px",
              fontSize: "0.9rem",
              fontWeight: "600",
              background: "#FFD700",
              color: "#1a1a1a",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.3s ease"
            }}>
              🦊 Connect MetaMask
            </button>
          ) : (
            <div style={{
              background: "rgba(255, 215, 0, 0.1)",
              border: "1px solid #FFD700",
              borderRadius: "8px",
              padding: "12px",
              color: "#FFD700",
              fontSize: "0.85rem",
              fontWeight: "600",
              textAlign: "center"
            }}>
              ✓ Wallet Connected
            </div>
          )}
          {chainId && (
            <div style={{
              marginTop: "12px",
              fontSize: "0.75rem",
              color: "#999",
              textAlign: "center"
            }}>
              Chain ID: <span style={{ color: "#FFD700", fontWeight: "600" }}>{chainId}</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ marginLeft: "280px", flex: 1, minHeight: "100vh" }}>
        {/* Top Status Bar */}
        <div style={{
          background: "#ffffff",
          borderBottom: "1px solid #e0e0e0",
          padding: "16px 32px",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
          position: "sticky",
          top: 0,
          zIndex: 100
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", color: "#1a1a1a", marginBottom: "4px" }}>
                {menuItems.find(item => item.id === currentPage)?.icon} {menuItems.find(item => item.id === currentPage)?.label}
              </h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "0.75rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Status:
              </span>
              <span className={`status-badge status-${getStatusType(status)}`} style={{ fontSize: "0.75rem" }}>
                {status || "Initializing..."}
              </span>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div style={{ padding: "32px" }}>
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

// Dashboard Page
function DashboardPage({ amm, status, chainId, getStatusType }: any) {
  return (
    <div>
      {/* Welcome Section */}
      <section style={{
        background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
        borderRadius: "12px",
        padding: "32px",
        marginBottom: "24px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        border: "2px solid #FFD700"
      }}>
        <h1 style={{ 
          fontSize: "2rem", 
          fontWeight: "700",
          color: "#FFD700",
          marginBottom: "12px"
        }}>
          Welcome to FHE AMM Optimizer
        </h1>
        <p style={{ color: "#e0e0e0", fontSize: "1rem", lineHeight: "1.6", margin: 0 }}>
          A privacy-preserving platform for optimizing Automated Market Maker parameters using Fully Homomorphic Encryption (FHE).
          Submit your position data and volatility metrics securely, and get aggregated suggestions without revealing individual inputs.
        </p>
      </section>

      {/* Contract Info */}
      <section style={{
        background: "#ffffff",
        borderRadius: "12px",
        padding: "24px",
        marginBottom: "24px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
        border: "1px solid #e0e0e0"
      }}>
        <h2 style={{ 
          fontSize: "1.5rem", 
          marginBottom: "20px",
          paddingBottom: "12px",
          borderBottom: "2px solid #FFD700",
          color: "#1a1a1a"
        }}>
          📄 Contract Information
        </h2>
        <div style={{ display: "grid", gap: "16px" }}>
          <div>
            <label style={{ 
              display: "block", 
              fontSize: "0.875rem", 
              color: "#666", 
              marginBottom: "8px",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              Contract Address
            </label>
            <div style={{ 
              background: "#f5f5f5", 
              padding: "12px 16px", 
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              fontFamily: "monospace",
              fontSize: "0.9rem",
              color: amm.contractAddress ? "#1a1a1a" : "#999",
              wordBreak: "break-all"
            }}>
              {amm.contractAddress || "(Contract not deployed)"}
            </div>
          </div>
          {amm.message && (
            <div style={{
              background: amm.message.toLowerCase().includes("fail") || amm.message.toLowerCase().includes("error") 
                ? "#fff3cd" 
                : amm.message.toLowerCase().includes("completed") 
                ? "#d4edda" 
                : "#d1ecf1",
              border: `1px solid ${amm.message.toLowerCase().includes("fail") || amm.message.toLowerCase().includes("error") 
                ? "#ffeaa7" 
                : amm.message.toLowerCase().includes("completed") 
                ? "#c3e6cb" 
                : "#bee5eb"}`,
              padding: "12px 16px",
              borderRadius: "8px",
              color: "#1a1a1a",
              fontSize: "0.9rem",
              fontWeight: "500"
            }}>
              {amm.message}
            </div>
          )}
        </div>
      </section>

      {/* Quick Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        <StatCard icon="💰" label="Applied Fee Ratio" value={amm.applied?.feeRatio?.toString() || "-"} />
        <StatCard icon="📏" label="Applied Tick Spacing" value={amm.applied?.tickSpacing?.toString() || "-"} />
        <StatCard icon="🔗" label="Chain ID" value={chainId?.toString() || "-"} />
        <StatCard icon="⚡" label="System Status" value={status || "Initializing"} />
      </div>
    </div>
  );
}

// Submit Position Page
function PositionPage({ amm }: any) {
  const [l, setL] = useState<number>(0);
  const [lo, setLo] = useState<number>(0);
  const [up, setUp] = useState<number>(0);

  return (
    <div>
      <section style={{
        background: "#ffffff",
        borderRadius: "12px",
        padding: "32px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
        border: "1px solid #e0e0e0",
        maxWidth: "600px",
        margin: "0 auto"
      }}>
        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "1.25rem", color: "#1a1a1a", marginBottom: "8px" }}>
            Submit Your Position Data
          </h3>
          <p style={{ color: "#666", fontSize: "0.9rem", margin: 0 }}>
            All data will be encrypted using FHE before submission to ensure privacy.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ 
              display: "block",
              fontSize: "0.875rem",
              fontWeight: "600",
              color: "#666",
              marginBottom: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              💧 Liquidity Amount
            </label>
            <input 
              placeholder="Enter liquidity amount" 
              type="number" 
              value={l || ""} 
              onChange={(e) => setL(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={{ 
              display: "block",
              fontSize: "0.875rem",
              fontWeight: "600",
              color: "#666",
              marginBottom: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              📉 Lower Price Bound
            </label>
            <input 
              placeholder="Enter lower price bound" 
              type="number" 
              value={lo || ""} 
              onChange={(e) => setLo(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={{ 
              display: "block",
              fontSize: "0.875rem",
              fontWeight: "600",
              color: "#666",
              marginBottom: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              📈 Upper Price Bound
            </label>
            <input 
              placeholder="Enter upper price bound" 
              type="number" 
              value={up || ""} 
              onChange={(e) => setUp(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <button 
            disabled={!amm.canSubmitPosition} 
            onClick={() => amm.submitPosition(l, lo, up)}
            style={{ width: "100%", padding: "16px", marginTop: "8px" }}
          >
            🔒 Submit Encrypted Position
          </button>

          {!amm.canSubmitPosition && (
            <p style={{ fontSize: "0.875rem", color: "#666", fontStyle: "italic", textAlign: "center", margin: 0 }}>
              ⓘ Please connect wallet and ensure contract is deployed
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

// Submit Volatility Page
function VolatilityPage({ amm }: any) {
  const [v, setV] = useState<number>(0);

  return (
    <div>
      <section style={{
        background: "#ffffff",
        borderRadius: "12px",
        padding: "32px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
        border: "1px solid #e0e0e0",
        maxWidth: "600px",
        margin: "0 auto"
      }}>
        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "1.25rem", color: "#1a1a1a", marginBottom: "8px" }}>
            Submit Volatility Data
          </h3>
          <p style={{ color: "#666", fontSize: "0.9rem", margin: 0 }}>
            Your volatility metric will be encrypted before submission to maintain confidentiality.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ 
              display: "block",
              fontSize: "0.875rem",
              fontWeight: "600",
              color: "#666",
              marginBottom: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              📊 Volatility Value
            </label>
            <input 
              placeholder="Enter volatility value" 
              type="number" 
              value={v || ""} 
              onChange={(e) => setV(Number(e.target.value))}
              style={{ width: "100%" }}
            />
            <p style={{ fontSize: "0.8rem", color: "#999", marginTop: "8px", marginBottom: 0 }}>
              Enter a numeric value representing the volatility metric
            </p>
          </div>

          <button 
            disabled={!amm.canSubmitVolatility} 
            onClick={() => amm.submitVolatility(v)}
            style={{ width: "100%", padding: "16px", marginTop: "8px" }}
          >
            🔒 Submit Encrypted Volatility
          </button>

          {!amm.canSubmitVolatility && (
            <p style={{ fontSize: "0.875rem", color: "#666", fontStyle: "italic", textAlign: "center", margin: 0 }}>
              ⓘ Please connect wallet and ensure contract is deployed
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

// Aggregates Page
function AggregatesPage({ amm }: any) {
  return (
    <div>
      <section style={{
        background: "#ffffff",
        borderRadius: "12px",
        padding: "24px",
        marginBottom: "24px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
        border: "1px solid #e0e0e0"
      }}>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "24px" }}>
          <button 
            disabled={!amm.canReadAggregates} 
            onClick={amm.refreshAggregates}
            style={{ flex: "1", minWidth: "200px" }}
          >
            🔄 Refresh Aggregates
          </button>
          <button 
            disabled={!amm.canDecryptAggregates} 
            onClick={amm.decryptAggregates}
            className="secondary"
            style={{ flex: "1", minWidth: "200px" }}
          >
            🔓 Decrypt Aggregates
          </button>
        </div>

        {/* Encrypted Handles Section */}
        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ 
            fontSize: "1.125rem", 
            marginBottom: "16px",
            color: "#1a1a1a",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            🔐 Encrypted Data Handles
          </h3>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", 
            gap: "16px" 
          }}>
            <DataCard 
              label="Aggregate Liquidity"
              value={amm.handles.aggLiquidity}
              icon="💧"
              type="handle"
            />
            <DataCard 
              label="Sum Lower Bound"
              value={amm.handles.sumLower}
              icon="📉"
              type="handle"
            />
            <DataCard 
              label="Sum Upper Bound"
              value={amm.handles.sumUpper}
              icon="📈"
              type="handle"
            />
            <DataCard 
              label="Position Count × 2"
              value={amm.handles.twoTimesNumPositions}
              icon="🔢"
              type="handle"
            />
            <DataCard 
              label="Suggested Fee Ratio"
              value={amm.handles.suggestedFeeRatio}
              icon="💰"
              type="handle"
            />
            <DataCard 
              label="Suggested Tick Spacing"
              value={amm.handles.suggestedTickSpacing}
              icon="📊"
              type="handle"
            />
          </div>
        </div>

        {/* Decrypted Values Section */}
        <div>
          <h3 style={{ 
            fontSize: "1.125rem", 
            marginBottom: "16px",
            color: "#1a1a1a",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            🔓 Decrypted Values
          </h3>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", 
            gap: "16px" 
          }}>
            <DataCard 
              label="Aggregate Liquidity"
              value={amm.clears.aggLiquidity?.toString()}
              icon="💧"
              type="clear"
            />
            <DataCard 
              label="Sum Lower Bound"
              value={amm.clears.sumLower?.toString()}
              icon="📉"
              type="clear"
            />
            <DataCard 
              label="Sum Upper Bound"
              value={amm.clears.sumUpper?.toString()}
              icon="📈"
              type="clear"
            />
            <DataCard 
              label="Position Count × 2"
              value={amm.clears.twoTimesNumPositions?.toString()}
              icon="🔢"
              type="clear"
            />
            <DataCard 
              label="Suggested Fee Ratio"
              value={amm.clears.suggestedFeeRatio?.toString()}
              icon="💰"
              type="clear"
            />
            <DataCard 
              label="Suggested Tick Spacing"
              value={amm.clears.suggestedTickSpacing?.toString()}
              icon="📊"
              type="clear"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

// Apply Parameters Page
function ParametersPage({ amm }: any) {
  const [f, setF] = useState<number>(0);
  const [t, setT] = useState<number>(0);

  return (
    <div>
      <section style={{
        background: "linear-gradient(135deg, #fff9e6 0%, #ffffff 100%)",
        borderRadius: "12px",
        padding: "32px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
        border: "2px solid #FFD700",
        maxWidth: "700px",
        margin: "0 auto"
      }}>
        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "1.25rem", color: "#1a1a1a", marginBottom: "8px" }}>
            👑 Apply Parameters (Owner Only)
          </h3>
          <p style={{ color: "#666", fontSize: "0.9rem", margin: 0 }}>
            Only the contract owner can apply new parameters to the AMM.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={{ 
                display: "block",
                fontSize: "0.875rem",
                fontWeight: "600",
                color: "#666",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                💰 Fee Ratio
              </label>
              <input 
                placeholder="Fee Ratio (clear)" 
                type="number" 
                value={f || ""} 
                onChange={(e) => setF(Number(e.target.value))}
              />
            </div>
            <div>
              <label style={{ 
                display: "block",
                fontSize: "0.875rem",
                fontWeight: "600",
                color: "#666",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                📏 Tick Spacing
              </label>
              <input 
                placeholder="Tick Spacing (clear)" 
                type="number" 
                value={t || ""} 
                onChange={(e) => setT(Number(e.target.value))}
              />
            </div>
          </div>

          <button 
            disabled={!amm.canApply} 
            onClick={() => amm.applyParameters(f, t)}
            style={{ width: "100%", padding: "16px", marginTop: "8px" }}
          >
            Apply Parameters
          </button>

          {!amm.canApply && (
            <p style={{ fontSize: "0.875rem", color: "#666", fontStyle: "italic", textAlign: "center", margin: 0 }}>
              ⓘ Only the contract owner can apply parameters
            </p>
          )}
        </div>

        <div style={{ 
          marginTop: "24px", 
          padding: "20px",
          background: "#ffffff",
          borderRadius: "8px",
          border: "1px solid #FFD700"
        }}>
          <h4 style={{ fontSize: "0.875rem", color: "#666", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Current Applied Parameters
          </h4>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px"
          }}>
            <div>
              <label style={{ 
                display: "block",
                fontSize: "0.75rem",
                color: "#999",
                marginBottom: "4px",
                textTransform: "uppercase"
              }}>
                Fee Ratio
              </label>
              <div style={{ 
                fontSize: "1.5rem", 
                fontWeight: "700",
                color: "#1a1a1a",
                fontFamily: "monospace"
              }}>
                {amm.applied?.feeRatio ?? "-"}
              </div>
            </div>
            <div>
              <label style={{ 
                display: "block",
                fontSize: "0.75rem",
                color: "#999",
                marginBottom: "4px",
                textTransform: "uppercase"
              }}>
                Tick Spacing
              </label>
              <div style={{ 
                fontSize: "1.5rem", 
                fontWeight: "700",
                color: "#1a1a1a",
                fontFamily: "monospace"
              }}>
                {amm.applied?.tickSpacing ?? "-"}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Guide Page
function GuidePage() {
  return (
    <div>
      <section style={{
        background: "#ffffff",
        borderRadius: "12px",
        padding: "32px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
        border: "1px solid #e0e0e0",
        maxWidth: "900px",
        margin: "0 auto"
      }}>
        <h2 style={{ fontSize: "1.75rem", color: "#1a1a1a", marginBottom: "24px" }}>
          📚 Parameter Guide
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <GuideSection
            icon="💧"
            title="Liquidity Amount"
            description="The amount of liquidity you want to provide to the AMM. This represents the capital you're willing to allocate to the liquidity pool."
          />

          <GuideSection
            icon="📉"
            title="Lower Price Bound"
            description="The minimum price at which you want your liquidity to be active. When the market price falls below this level, your position becomes inactive."
          />

          <GuideSection
            icon="📈"
            title="Upper Price Bound"
            description="The maximum price at which you want your liquidity to be active. When the market price rises above this level, your position becomes inactive."
          />

          <GuideSection
            icon="📊"
            title="Volatility Value"
            description="A measure of price fluctuation in the market. Higher volatility typically indicates more price movement and potentially higher risk and returns."
          />

          <GuideSection
            icon="💰"
            title="Fee Ratio"
            description="The percentage fee charged on swaps in the AMM. This parameter affects trader costs and liquidity provider earnings. Typical values range from 0.01% to 1%."
          />

          <GuideSection
            icon="📏"
            title="Tick Spacing"
            description="The granularity of price levels in the AMM. Smaller tick spacing allows for more precise price ranges but may increase gas costs. Common values are 1, 10, 60, or 200."
          />

          <div style={{
            background: "linear-gradient(135deg, #fff9e6 0%, #ffffff 100%)",
            border: "2px solid #FFD700",
            borderRadius: "8px",
            padding: "20px",
            marginTop: "16px"
          }}>
            <h3 style={{ fontSize: "1.125rem", color: "#1a1a1a", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              🔐 Privacy with FHE
            </h3>
            <p style={{ color: "#666", lineHeight: "1.6", margin: 0 }}>
              This platform uses Fully Homomorphic Encryption (FHE) to keep all your submitted data private. 
              Your position details and volatility metrics are encrypted before being sent to the contract, 
              ensuring that individual contributions remain confidential while still enabling aggregate calculations 
              and suggestions for optimal AMM parameters.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

// Helper Components
function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid #e0e0e0",
      borderRadius: "10px",
      padding: "20px",
      textAlign: "center",
      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)"
    }}>
      <div style={{ fontSize: "2rem", marginBottom: "8px" }}>{icon}</div>
      <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.25rem", fontWeight: "700", color: "#1a1a1a", fontFamily: "monospace" }}>
        {value}
      </div>
    </div>
  );
}

function DataCard({ label, value, icon, type }: { label: string; value?: string; icon: string; type: "handle" | "clear" }) {
  const hasValue = value && value !== "undefined";
  
  return (
    <div style={{
      background: type === "handle" ? "#f8f9fa" : "#fff9e6",
      border: `2px solid ${type === "handle" ? "#e0e0e0" : "#FFD700"}`,
      borderRadius: "10px",
      padding: "16px",
      transition: "all 0.3s ease",
      minHeight: "120px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between"
    }}>
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "8px",
        marginBottom: "12px"
      }}>
        <span style={{ fontSize: "1.5rem" }}>{icon}</span>
        <label style={{
          fontSize: "0.875rem",
          fontWeight: "600",
          color: "#666",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          lineHeight: "1.2"
        }}>
          {label}
        </label>
      </div>
      
      {hasValue ? (
        <div style={{
          background: "white",
          padding: "10px 12px",
          borderRadius: "6px",
          border: "1px solid #e0e0e0",
          wordBreak: "break-all",
          fontSize: type === "handle" ? "0.75rem" : "1.125rem",
          fontFamily: type === "handle" ? "monospace" : "inherit",
          fontWeight: type === "clear" ? "700" : "400",
          color: type === "handle" ? "#666" : "#1a1a1a",
          maxHeight: "80px",
          overflow: "auto"
        }}>
          {value}
        </div>
      ) : (
        <div style={{
          background: "white",
          padding: "10px 12px",
          borderRadius: "6px",
          border: "1px dashed #ccc",
          fontSize: "0.875rem",
          color: "#999",
          fontStyle: "italic",
          textAlign: "center"
        }}>
          {type === "handle" ? "Not loaded" : "Not decrypted"}
        </div>
      )}
    </div>
  );
}

function GuideSection({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div style={{
      padding: "20px",
      background: "#f8f9fa",
      borderRadius: "8px",
      border: "1px solid #e0e0e0"
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
        <span style={{ fontSize: "2rem", flexShrink: 0 }}>{icon}</span>
        <div>
          <h4 style={{ fontSize: "1.125rem", color: "#1a1a1a", marginBottom: "8px", fontWeight: "600" }}>
            {title}
          </h4>
          <p style={{ color: "#666", lineHeight: "1.6", margin: 0 }}>
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
