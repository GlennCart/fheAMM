// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint32, externalEuint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title FHEAMM — Privacy-preserving AMM parameter optimization using Zama FHEVM
/// @notice Stores user positions as encrypted values and computes encrypted aggregates and suggestions fully on-chain.
/// @dev Mirrors Zama's official FHEVM usage: FHE.fromExternal + FHE.add/sub + FHE.ge + FHE.select + FHE.allowThis + FHE.allow.
contract FHEAMM is ZamaEthereumConfig, Ownable {
    // ============================
    // Types
    // ============================
    struct Position {
        euint32 liquidity;      // enc(liquidity)
        euint32 priceLower;     // enc(price_lower)
        euint32 priceUpper;     // enc(price_upper)
        bool exists;            // clear flag (non-sensitive)
    }

    // ============================
    // Storage
    // ============================
    mapping(address => Position) private _positions;

    // Aggregates (encrypted)
    euint32 private _aggLiquidity;     // Σ enc(liquidity_i)
    euint32 private _sumPriceLower;    // Σ enc(price_lower_i)
    euint32 private _sumPriceUpper;    // Σ enc(price_upper_i)
    euint32 private _numPositions;     // Σ enc(1) for each unique address with a position
    euint32 private _twoTimesNumPositions; // enc(2 * number_of_positions), maintained to keep views pure

    // Suggestions (encrypted)
    euint32 private _suggestedFeeRatio;     // enc(fee_ratio)
    euint32 private _suggestedTickSpacing;  // enc(tick_spacing)

    // Applied parameters (clear, admin-governed)
    uint32 public appliedFeeRatio;
    uint32 public appliedTickSpacing;

    // Operation audit trail (hashes are public but do not reveal values)
    bytes32[] private _actionHashes;

    // ============================
    // Events
    // ============================
    event PositionSubmitted(address indexed user);
    event VolatilitySubmitted(address indexed user);
    event ParametersApplied(uint32 feeRatio, uint32 tickSpacing);

    constructor() Ownable(msg.sender) {
        // Initialize suggested encrypted values and allow contract to operate on them.
        _suggestedFeeRatio = FHE.asEuint32(0);
        _suggestedTickSpacing = FHE.asEuint32(0);
        FHE.allowThis(_suggestedFeeRatio);
        FHE.allowThis(_suggestedTickSpacing);
    }

    // ============================
    // Position Submit/Update (Encrypted)
    // ============================
    /// @notice Submit or update an encrypted AMM position.
    /// @param encLiquidity enc(liquidity)
    /// @param encPriceLower enc(price_lower)
    /// @param encPriceUpper enc(price_upper)
    /// @param inputProof FHE input proof covering the 3 encrypted inputs
    function submitPosition(
        externalEuint32 encLiquidity,
        externalEuint32 encPriceLower,
        externalEuint32 encPriceUpper,
        bytes calldata inputProof
    ) external {
        // Convert from external encrypted inputs
        euint32 liq = FHE.fromExternal(encLiquidity, inputProof);
        euint32 pl  = FHE.fromExternal(encPriceLower, inputProof);
        euint32 pu  = FHE.fromExternal(encPriceUpper, inputProof);

        Position storage p = _positions[msg.sender];

        // If user already had a position, remove its contribution from aggregates first
        if (p.exists) {
            _aggLiquidity = FHE.sub(_aggLiquidity, p.liquidity);
            _sumPriceLower = FHE.sub(_sumPriceLower, p.priceLower);
            _sumPriceUpper = FHE.sub(_sumPriceUpper, p.priceUpper);
        } else {
            // First time user: increment numPositions by 1 (encrypted)
            _numPositions = FHE.add(_numPositions, FHE.asEuint32(1));
            FHE.allowThis(_numPositions);
            FHE.allow(_numPositions, msg.sender);
            FHE.allow(_numPositions, owner());

            // Maintain 2 * numPositions to avoid FHE ops in view functions
            _twoTimesNumPositions = FHE.add(_twoTimesNumPositions, FHE.asEuint32(2));
            FHE.allowThis(_twoTimesNumPositions);
            FHE.allow(_twoTimesNumPositions, msg.sender);
            FHE.allow(_twoTimesNumPositions, owner());
        }

        // Update aggregates with new values
        _aggLiquidity = FHE.add(_aggLiquidity, liq);
        _sumPriceLower = FHE.add(_sumPriceLower, pl);
        _sumPriceUpper = FHE.add(_sumPriceUpper, pu);

        // Save the position
        p.liquidity = liq;
        p.priceLower = pl;
        p.priceUpper = pu;
        p.exists = true;

        // Allow decrypt (contract, sender, owner)
        FHE.allowThis(_aggLiquidity);
        FHE.allowThis(_sumPriceLower);
        FHE.allowThis(_sumPriceUpper);

        FHE.allow(_aggLiquidity, msg.sender);
        FHE.allow(_sumPriceLower, msg.sender);
        FHE.allow(_sumPriceUpper, msg.sender);

        FHE.allow(_aggLiquidity, owner());
        FHE.allow(_sumPriceLower, owner());
        FHE.allow(_sumPriceUpper, owner());

        FHE.allowThis(p.liquidity);
        FHE.allowThis(p.priceLower);
        FHE.allowThis(p.priceUpper);

        FHE.allow(p.liquidity, msg.sender);
        FHE.allow(p.priceLower, msg.sender);
        FHE.allow(p.priceUpper, msg.sender);

        FHE.allow(p.liquidity, owner());
        FHE.allow(p.priceLower, owner());
        FHE.allow(p.priceUpper, owner());

        // Audit trail (hash does not reveal values)
        _pushAction("SUBMIT_POSITION");
        emit PositionSubmitted(msg.sender);
    }

    // ============================
    // Volatility-driven suggestion update (Encrypted)
    // ============================
    /// @notice Submit encrypted volatility to adjust suggested parameters under FHE.
    /// @dev Illustrative rule: if enc(volatility) >= threshold then fee_ratio += delta; tick_spacing += delta
    function submitVolatility(
        externalEuint32 encVolatility,
        bytes calldata inputProof
    ) external {
        euint32 vol = FHE.fromExternal(encVolatility, inputProof);

        // Tunable constants (clear -> encrypted constants inside FHE circuit)
        euint32 threshold = FHE.asEuint32(50); // example threshold
        euint32 delta = FHE.asEuint32(1);      // example step

        ebool ge = FHE.ge(vol, threshold);

        // fee' = ge ? fee + delta : fee
        _suggestedFeeRatio = FHE.select(
            ge,
            FHE.add(_suggestedFeeRatio, delta),
            _suggestedFeeRatio
        );

        // tickSpacing' = ge ? tickSpacing + delta : tickSpacing
        _suggestedTickSpacing = FHE.select(
            ge,
            FHE.add(_suggestedTickSpacing, delta),
            _suggestedTickSpacing
        );

        // Allow decrypt (contract, sender, owner)
        FHE.allowThis(_suggestedFeeRatio);
        FHE.allowThis(_suggestedTickSpacing);
        FHE.allow(_suggestedFeeRatio, msg.sender);
        FHE.allow(_suggestedTickSpacing, msg.sender);
        FHE.allow(_suggestedFeeRatio, owner());
        FHE.allow(_suggestedTickSpacing, owner());

        _pushAction("SUBMIT_VOLATILITY");
        emit VolatilitySubmitted(msg.sender);
    }

    // ============================
    // Views (Encrypted handles)
    // ============================
    /// @notice Returns encrypted aggregates used to derive suggested parameters off-chain.
    /// @return aggLiquidity Σ enc(liquidity)
    /// @return sumLower Σ enc(price_lower)
    /// @return sumUpper Σ enc(price_upper)
    /// @return twoTimesNumPositions enc(2 * number_of_positions)
    function getAggregates()
        external
        view
        returns (
            euint32 aggLiquidity,
            euint32 sumLower,
            euint32 sumUpper,
            euint32 twoTimesNumPositions
        )
    {
        return (_aggLiquidity, _sumPriceLower, _sumPriceUpper, _twoTimesNumPositions);
    }

    /// @notice Returns encrypted suggestions: fee_ratio and tick_spacing
    function getSuggestions()
        external
        view
        returns (euint32 feeRatio, euint32 tickSpacing)
    {
        return (_suggestedFeeRatio, _suggestedTickSpacing);
    }

    /// @notice Returns caller position (encrypted values)
    function getMyPosition()
        external
        view
        returns (euint32 liquidity, euint32 priceLower, euint32 priceUpper, bool exists)
    {
        Position storage p = _positions[msg.sender];
        return (p.liquidity, p.priceLower, p.priceUpper, p.exists);
    }

    // ============================
    // Governance (clear)
    // ============================
    /// @notice Apply suggested parameters in clear after off-chain decryption/verification.
    function applyParameters(uint32 feeRatioClear, uint32 tickSpacingClear) external onlyOwner {
        appliedFeeRatio = feeRatioClear;
        appliedTickSpacing = tickSpacingClear;
        _pushAction("APPLY_PARAMETERS");
        emit ParametersApplied(feeRatioClear, tickSpacingClear);
    }

    // ============================
    // Audit trail helpers
    // ============================
    function _pushAction(string memory action) internal {
        bytes32 h = keccak256(abi.encodePacked(action, msg.sender, block.timestamp));
        _actionHashes.push(h);
    }

    function getActionsLength() external view returns (uint256) {
        return _actionHashes.length;
    }

    function getActionAt(uint256 index) external view returns (bytes32) {
        return _actionHashes[index];
    }
}


