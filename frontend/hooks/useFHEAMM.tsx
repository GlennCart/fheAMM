"use client";

import { ethers } from "ethers";
import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { FhevmInstance } from "@/fhevm/fhevmTypes";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import { GenericStringStorage } from "@/fhevm/GenericStringStorage";
import { FHEAMMAddresses } from "@/abi/FHEAMMAddresses";
import { FHEAMMABI } from "@/abi/FHEAMMABI";

type FHEAMMInfoType = {
  abi: typeof FHEAMMABI.abi;
  address?: `0x${string}`;
  chainId?: number;
  chainName?: string;
};

export type AggregatesHandles = {
  aggLiquidity?: string;
  sumLower?: string;
  sumUpper?: string;
  twoTimesNumPositions?: string;
  suggestedFeeRatio?: string;
  suggestedTickSpacing?: string;
};

export type AggregatesClears = {
  aggLiquidity?: bigint;
  sumLower?: bigint;
  sumUpper?: bigint;
  twoTimesNumPositions?: bigint;
  suggestedFeeRatio?: bigint;
  suggestedTickSpacing?: bigint;
};

function getFHEAMMByChainId(chainId: number | undefined): FHEAMMInfoType {
  if (!chainId) {
    return { abi: FHEAMMABI.abi };
  }
  const entry = FHEAMMAddresses[chainId.toString() as keyof typeof FHEAMMAddresses];
  if (!entry || !("address" in entry) || entry.address === ethers.ZeroAddress) {
    return { abi: FHEAMMABI.abi, chainId };
  }
  return {
    address: entry?.address as `0x${string}` | undefined,
    chainId: entry?.chainId ?? chainId,
    chainName: entry?.chainName,
    abi: FHEAMMABI.abi,
  };
}

export const useFHEAMM = (parameters: {
  instance: FhevmInstance | undefined;
  fhevmDecryptionSignatureStorage: GenericStringStorage;
  chainId: number | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  ethersReadonlyProvider: ethers.ContractRunner | undefined;
  sameChain: RefObject<(chainId: number | undefined) => boolean>;
  sameSigner: RefObject<
    (ethersSigner: ethers.JsonRpcSigner | undefined) => boolean
  >;
}) => {
  const {
    instance,
    fhevmDecryptionSignatureStorage,
    chainId,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
  } = parameters;

  const [message, setMessage] = useState<string>("");
  const [applied, setApplied] = useState<{ feeRatio: number; tickSpacing: number } | undefined>(undefined);
  const [owner, setOwner] = useState<string | undefined>(undefined);
  const [signerAddress, setSignerAddress] = useState<string | undefined>(undefined);

  const ammRef = useRef<FHEAMMInfoType | undefined>(undefined);
  const busyRef = useRef<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  const [handles, setHandles] = useState<AggregatesHandles>({});
  const [clears, setClears] = useState<AggregatesClears>({});

  const amm = useMemo(() => {
    const c = getFHEAMMByChainId(chainId);
    ammRef.current = c;
    if (c.chainId !== undefined && !c.address) {
      setMessage(`⚠️ FHEAMM contract not deployed on chain ${c.chainId}. Please deploy the contract first.`);
    } else {
      setMessage("");
    }
    return c;
  }, [chainId]);

  const isDeployed = useMemo(() => {
    if (!amm) return undefined;
    return Boolean(amm.address) && amm.address !== ethers.ZeroAddress;
  }, [amm]);

  useEffect(() => {
    (async () => {
      try {
        if (!ethersSigner) { setSignerAddress(undefined); return; }
        const a = await (ethersSigner as any).getAddress();
        setSignerAddress(a);
      } catch { setSignerAddress(undefined); }
    })();
  }, [ethersSigner]);

  const canSubmitPosition = useMemo(() => {
    return !!amm.address && !!instance && !!ethersSigner && !busy;
  }, [amm.address, instance, ethersSigner, busy]);

  const submitPosition = useCallback((l: number, lo: number, up: number) => {
    if (busyRef.current) return;
    if (!amm.address || !instance || !ethersSigner) return;
    const thisChainId = chainId; const thisAddress = amm.address; const thisSigner = ethersSigner;
    busyRef.current = true; setBusy(true); setMessage("🚀 Preparing to submit position with encrypted data...");
    const run = async () => {
      await new Promise((r) => setTimeout(r, 80));
      const isStale = () => thisAddress !== ammRef.current?.address || !(sameChain.current?.(thisChainId) ?? false) || !(sameSigner.current?.(thisSigner) ?? false);
      try {
        const contract = new ethers.Contract(thisAddress, amm.abi, thisSigner);
        const userAddress = typeof (thisSigner as any).getAddress === "function"
          ? await (thisSigner as any).getAddress()
          : (thisSigner as any).address;
        if (!userAddress || typeof userAddress !== "string" || !userAddress.startsWith("0x")) {
          setMessage("❌ Unable to resolve wallet address for encryption. Please reconnect your wallet.");
          return;
        }
        const input = instance.createEncryptedInput(thisAddress, userAddress);
        input.add32(l);
        input.add32(lo);
        input.add32(up);
        const enc = await input.encrypt();
        if (isStale()) { setMessage("⚠️ Transaction cancelled - network or wallet changed"); return; }
        const tx = await contract.submitPosition(enc.handles[0], enc.handles[1], enc.handles[2], enc.inputProof);
        setMessage(`⏳ Transaction submitted! Waiting for confirmation... (${tx.hash.substring(0, 10)}...)`);
        await tx.wait();
        setMessage("✅ Position successfully submitted and encrypted!");
      } catch (err: any) { 
        setMessage(`❌ Failed to submit position: ${err?.message || "Unknown error"}`); 
      }
      finally { busyRef.current = false; setBusy(false); }
    };
    run();
  }, [amm.address, amm.abi, instance, ethersSigner, chainId, sameChain, sameSigner]);

  const canSubmitVolatility = useMemo(() => {
    return !!amm.address && !!instance && !!ethersSigner && !busy;
  }, [amm.address, instance, ethersSigner, busy]);

  const submitVolatility = useCallback((v: number) => {
    if (busyRef.current) return;
    if (!amm.address || !instance || !ethersSigner) return;
    const thisChainId = chainId; const thisAddress = amm.address; const thisSigner = ethersSigner;
    busyRef.current = true; setBusy(true); setMessage("🚀 Preparing to submit volatility data with encryption...");
    const run = async () => {
      await new Promise((r) => setTimeout(r, 80));
      const isStale = () => thisAddress !== ammRef.current?.address || !(sameChain.current?.(thisChainId) ?? false) || !(sameSigner.current?.(thisSigner) ?? false);
      try {
        const contract = new ethers.Contract(thisAddress, amm.abi, thisSigner);
        const userAddress = typeof (thisSigner as any).getAddress === "function"
          ? await (thisSigner as any).getAddress()
          : (thisSigner as any).address;
        if (!userAddress || typeof userAddress !== "string" || !userAddress.startsWith("0x")) {
          setMessage("❌ Unable to resolve wallet address for encryption. Please reconnect your wallet.");
          return;
        }
        const input = instance.createEncryptedInput(thisAddress, userAddress);
        input.add32(v);
        const enc = await input.encrypt();
        if (isStale()) { setMessage("⚠️ Transaction cancelled - network or wallet changed"); return; }
        const tx = await contract.submitVolatility(enc.handles[0], enc.inputProof);
        setMessage(`⏳ Transaction submitted! Waiting for confirmation... (${tx.hash.substring(0, 10)}...)`);
        await tx.wait();
        setMessage("✅ Volatility data successfully submitted and encrypted!");
      } catch (err: any) { 
        setMessage(`❌ Failed to submit volatility: ${err?.message || "Unknown error"}`); 
      }
      finally { busyRef.current = false; setBusy(false); }
    };
    run();
  }, [amm.address, amm.abi, instance, ethersSigner, chainId, sameChain, sameSigner]);

  const canReadAggregates = useMemo(() => {
    return !!amm.address && !!ethersReadonlyProvider && !busy;
  }, [amm.address, ethersReadonlyProvider, busy]);

  const refreshAggregates = useCallback(() => {
    if (busyRef.current) return;
    if (!ammRef.current?.address || !ethersReadonlyProvider) return;
    busyRef.current = true; setBusy(true);
    setMessage("🔄 Refreshing encrypted aggregates from contract...");
    const thisAddress = ammRef.current.address; const thisChainId = ammRef.current.chainId;
    const contract = new ethers.Contract(thisAddress, ammRef.current.abi, ethersReadonlyProvider);
    Promise.all([
      contract.getAggregates(),
      contract.getSuggestions(),
      contract.getMyPosition(),
    ])
      .then(([aggr, sugg, me]: [readonly string[], readonly string[], readonly [string, string, string, boolean]]) => {
        if ((sameChain.current?.(thisChainId) ?? false) && thisAddress === ammRef.current?.address) {
          setHandles({
            aggLiquidity: aggr[0],
            sumLower: aggr[1],
            sumUpper: aggr[2],
            twoTimesNumPositions: aggr[3],
            suggestedFeeRatio: sugg[0],
            suggestedTickSpacing: sugg[1],
          });
          setMessage("✅ Aggregates refreshed successfully!");
        }
      })
      .catch((err: any) => {
        setMessage(`❌ Failed to refresh aggregates: ${err?.message || "Unknown error"}`);
      })
      .finally(() => { busyRef.current = false; setBusy(false); });
  }, [ethersReadonlyProvider, sameChain]);

  useEffect(() => { refreshAggregates(); }, [refreshAggregates]);

  const canDecryptAggregates = useMemo(() => {
    const hasAnyHandle = Object.values(handles).some(Boolean);
    return !!amm.address && !!instance && !!ethersSigner && hasAnyHandle && !busy;
  }, [amm.address, instance, ethersSigner, handles, busy]);

  const decryptAggregates = useCallback(() => {
    if (busyRef.current) return;
    if (!amm.address || !instance || !ethersSigner) return;
    const toDecrypt: { handle: string; contractAddress: `0x${string}` }[] = [];
    const push = (h?: string) => { if (h && h !== ethers.ZeroHash) toDecrypt.push({ handle: h, contractAddress: amm.address! }); };
    push(handles.aggLiquidity);
    push(handles.sumLower);
    push(handles.sumUpper);
    push(handles.twoTimesNumPositions);
    push(handles.suggestedFeeRatio);
    push(handles.suggestedTickSpacing);
    if (toDecrypt.length === 0) {
      setClears({});
      return;
    }
    const thisChainId = chainId; const thisAddress = amm.address; const thisSigner = ethersSigner;
    busyRef.current = true; setBusy(true); setMessage("🔐 Initializing decryption process...");
    const run = async () => {
      const isStale = () => thisAddress !== ammRef.current?.address || !(sameChain.current?.(thisChainId) ?? false) || !(sameSigner.current?.(thisSigner) ?? false);
      try {
        setMessage("📝 Generating decryption signature...");
        const sig = await FhevmDecryptionSignature.loadOrSign(
          instance,
          [amm.address as `0x${string}`],
          ethersSigner,
          fhevmDecryptionSignatureStorage
        );
        if (!sig) { setMessage("❌ Unable to generate FHEVM decryption signature. Please try again."); return; }
        if (isStale()) { setMessage("⚠️ Decryption cancelled - network or wallet changed"); return; }
        setMessage("🔓 Decrypting encrypted data from FHEVM...");
        const res = await instance.userDecrypt(
          toDecrypt,
          sig.privateKey,
          sig.publicKey,
          sig.signature,
          sig.contractAddresses,
          sig.userAddress,
          sig.startTimestamp,
          sig.durationDays
        );
        const toBig = (v: unknown): bigint => {
          if (typeof v === "bigint") return v;
          if (typeof v === "boolean") return v ? 1n : 0n;
          if (typeof v === "string" || typeof v === "number") return BigInt(v as string);
          return BigInt(0);
        };
        setClears({
          aggLiquidity: handles.aggLiquidity ? toBig(res[handles.aggLiquidity]) : undefined,
          sumLower: handles.sumLower ? toBig(res[handles.sumLower]) : undefined,
          sumUpper: handles.sumUpper ? toBig(res[handles.sumUpper]) : undefined,
          twoTimesNumPositions: handles.twoTimesNumPositions ? toBig(res[handles.twoTimesNumPositions]) : undefined,
          suggestedFeeRatio: handles.suggestedFeeRatio ? toBig(res[handles.suggestedFeeRatio]) : undefined,
          suggestedTickSpacing: handles.suggestedTickSpacing ? toBig(res[handles.suggestedTickSpacing]) : undefined,
        });
        setMessage("✅ Decryption completed successfully! Check the output below.");
      } catch (err: any) {
        setMessage(`❌ Decryption failed: ${err?.message || "Unknown error"}`);
      } finally { busyRef.current = false; setBusy(false); }
    };
    run();
  }, [fhevmDecryptionSignatureStorage, ethersSigner, amm.address, instance, handles, chainId, sameChain, sameSigner]);

  const canApply = useMemo(() => {
    if (!amm.address || !ethersSigner || busy) return false;
    if (!owner || !signerAddress) return false;
    return owner.toLowerCase() === signerAddress.toLowerCase();
  }, [amm.address, ethersSigner, busy, owner, signerAddress]);

  const refreshApplied = useCallback(() => {
    if (!ammRef.current?.address || !ethersReadonlyProvider) return;
    const contract = new ethers.Contract(ammRef.current.address, ammRef.current.abi, ethersReadonlyProvider);
    Promise.all([contract.appliedFeeRatio(), contract.appliedTickSpacing(), contract.owner()]).then(([f, t, o]: [number, number, string]) => {
      setApplied({ feeRatio: Number(f), tickSpacing: Number(t) });
      setOwner(typeof o === "string" ? o : undefined);
    }).catch(() => { setApplied(undefined); setOwner(undefined); });
  }, [ethersReadonlyProvider]);

  useEffect(() => { refreshApplied(); }, [refreshApplied]);

  const applyParameters = useCallback((fee: number, tick: number) => {
    if (busyRef.current) return;
    if (!amm.address || !ethersSigner) return;
    busyRef.current = true; setBusy(true); setMessage("👑 Applying new parameters as contract owner...");
    const run = async () => {
      try {
        const address = amm.address as string;
        const contract = new ethers.Contract(address, amm.abi, ethersSigner);
        const tx = await contract.applyParameters(fee, tick);
        setMessage(`⏳ Transaction submitted! Waiting for confirmation... (${tx.hash.substring(0, 10)}...)`);
        await tx.wait();
        setMessage("✅ Parameters successfully applied to the contract!");
        refreshApplied();
      } catch (err: any) { 
        setMessage(`❌ Failed to apply parameters: ${err?.message || "Unknown error. Are you the contract owner?"}`); 
      }
      finally { busyRef.current = false; setBusy(false); }
    };
    run();
  }, [amm.address, amm.abi, ethersSigner, refreshApplied]);

  return {
    contractAddress: amm.address,
    message,
    isDeployed,
    canSubmitPosition,
    canSubmitVolatility,
    submitPosition,
    submitVolatility,
    handles,
    clears,
    canReadAggregates,
    canDecryptAggregates,
    refreshAggregates,
    decryptAggregates,
    canApply,
    applyParameters,
    applied,
  } as const;
};


