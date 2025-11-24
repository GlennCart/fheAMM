import * as fs from "fs";
import * as path from "path";

const CONTRACT_NAME = "FHEAMM";

// backend path relative to frontend folder
const rel = "../backend";

// output dir
const outdir = path.resolve("./abi");

if (!fs.existsSync(outdir)) {
  fs.mkdirSync(outdir);
}

const dir = path.resolve(rel);
const dirname = path.basename(dir);

const line =
  "\n===================================================================\n";

if (!fs.existsSync(dir)) {
  console.error(
    `${line}Unable to locate ${rel}. Expecting <root>/fheAMM/${dirname}${line}`
  );
  process.exit(1);
}

if (!fs.existsSync(outdir)) {
  console.error(`${line}Unable to locate ${outdir}.${line}`);
  process.exit(1);
}

const deploymentsDir = path.join(dir, "deployments");

function readDeployment(chainName, chainId, contractName, optional) {
  const chainDeploymentDir = path.join(deploymentsDir, chainName);

  if (!fs.existsSync(chainDeploymentDir)) {
    console.warn(
      `${line}Missing '${chainDeploymentDir}'. Skipping network '${chainName}'.${line}`
    );
    return undefined;
  }

  const jsonString = fs.readFileSync(
    path.join(chainDeploymentDir, `${contractName}.json`),
    "utf-8"
  );

  const obj = JSON.parse(jsonString);
  obj.chainId = chainId;

  return obj;
}
// Try to load known networks; skip absent ones
const knownNetworks = [
  { name: "localhost", chainId: 31337 },
  { name: "sepolia", chainId: 11155111 },
];

const foundDeployments = [];
for (const n of knownNetworks) {
  const d = readDeployment(n.name, n.chainId, CONTRACT_NAME, true /* optional */);
  if (d && d.address) {
    foundDeployments.push({ ...d, chainName: n.name, chainId: n.chainId });
  }
}

// Select ABI from the first available deployment; warn if multiple ABIs differ
let selectedAbi = [];
if (foundDeployments.length > 0) {
  selectedAbi = foundDeployments[0].abi;
  for (let i = 1; i < foundDeployments.length; i++) {
    if (JSON.stringify(foundDeployments[i].abi) !== JSON.stringify(selectedAbi)) {
      console.warn(
        `${line}Warning: ABI differs between networks. Using ABI from '${foundDeployments[0].chainName}'.${line}`
      );
      break;
    }
  }
}

const tsCode = `
/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const ${CONTRACT_NAME}ABI = ${JSON.stringify({ abi: selectedAbi }, null, 2)} as const;
`;
const tsAddresses = `
/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const ${CONTRACT_NAME}Addresses = {
${foundDeployments
  .map(
    (d) => `  "${d.chainId}": { address: "${d.address}", chainId: ${d.chainId}, chainName: "${d.chainName}" },`
  )
  .join("\n")}
} as const;
`;

fs.writeFileSync(path.join(outdir, `${CONTRACT_NAME}ABI.ts`), tsCode, "utf-8");
fs.writeFileSync(
  path.join(outdir, `${CONTRACT_NAME}Addresses.ts`),
  tsAddresses,
  "utf-8"
);

console.log(`Generated ${path.join(outdir, `${CONTRACT_NAME}ABI.ts`)}`);
console.log(`Generated ${path.join(outdir, `${CONTRACT_NAME}Addresses.ts`)}`);


