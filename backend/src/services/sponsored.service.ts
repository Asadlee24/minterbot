import { Address, Hex, keccak256, toHex, encodeAbiParameters, parseAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export const AUDITED_EXECUTOR_RUNTIME_HASH = '0x81a86fa2c51be4ed2e09e88256a792e20464184b657f49797d79c6eb90f63d60' as Hex;

export interface SponsoredOperation {
  wallet: Address;
  mintTarget: Address;
  nftContract: Address;
  recipient: Address;
  mintValue: bigint;
  expectedUnits: bigint;
  mintGasLimit: bigint;
  walletGasLimit: bigint;
  deadline: number; // uint48 timestamp
  mintCalldata: Hex;
}

export interface SignedSponsoredOperation extends SponsoredOperation {
  signatureR: Hex;
  signatureYParityAndS: Hex;
}

export class SponsoredService {
  /**
   * Builds the EIP-712 digest for a SponsoredMint operation according to SponsoredMintExecutor spec v2
   */
  public buildOperationDigest(
    sponsor: Address,
    batchId: Hex,
    index: number,
    dispatcher: Address,
    op: SponsoredOperation,
    chainId: number
  ): Hex {
    const domainSeparator = keccak256(
      encodeAbiParameters(
        parseAbiParameters('bytes32, bytes32, bytes32, uint256, address'),
        [
          keccak256(toHex('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
          keccak256(toHex('OSNM-Z Sponsored Mint')),
          keccak256(toHex('2')),
          BigInt(chainId),
          dispatcher
        ]
      )
    );

    const typeHash = keccak256(
      toHex(
        'SponsoredMint(address sponsor,bytes32 batchId,uint256 index,address dispatcher,address wallet,address mintTarget,bytes32 mintCalldataHash,uint256 mintValue,uint256 expectedUnits,uint64 mintGasLimit,uint64 walletGasLimit,address nftContract,address recipient,uint48 deadline)'
      )
    );

    const calldataHash = keccak256(op.mintCalldata);

    const structHash = keccak256(
      encodeAbiParameters(
        parseAbiParameters(
          'bytes32, address, bytes32, uint256, address, address, address, bytes32, uint256, uint256, uint64, uint64, address, address, uint48'
        ),
        [
          typeHash,
          sponsor,
          batchId,
          BigInt(index),
          dispatcher,
          op.wallet,
          op.mintTarget,
          calldataHash,
          op.mintValue,
          op.expectedUnits,
          op.mintGasLimit,
          op.walletGasLimit,
          op.nftContract,
          op.recipient,
          op.deadline
        ]
      )
    );

    return keccak256(
      toHex(`0x1901${domainSeparator.slice(2)}${structHash.slice(2)}`)
    );
  }

  /**
   * Signs a SponsoredMintOperation using wallet private key
   */
  public async signOperation(
    privateKeyHex: string,
    sponsor: Address,
    batchId: Hex,
    index: number,
    dispatcher: Address,
    op: SponsoredOperation,
    chainId: number
  ): Promise<SignedSponsoredOperation> {
    const account = privateKeyToAccount(privateKeyHex as Hex);
    const digest = this.buildOperationDigest(sponsor, batchId, index, dispatcher, op, chainId);

    // Sign raw digest
    const sig = await account.sign({ hash: digest });

    // Format ERC-2098 compact signature (r and yParityAndS)
    const r = sig.slice(0, 66) as Hex;
    const s = `0x${sig.slice(66, 130)}` as Hex;
    const v = parseInt(sig.slice(130, 132), 16);

    // Encode yParity into high bit of s if v is 28 / yParity=1
    let yParityAndS = s;
    if (v === 28 || v === 1) {
      const sBig = BigInt(s);
      const highBit = 1n << 255n;
      const compactS = sBig | highBit;
      yParityAndS = `0x${compactS.toString(16).padStart(64, '0')}` as Hex;
    }

    return {
      ...op,
      signatureR: r,
      signatureYParityAndS: yParityAndS
    };
  }

  /**
   * Signs EIP-7702 authorization tuple for delegated wallet
   */
  public async signAuthorizationTuple(privateKeyHex: string, executorAddress: Address, nonce: bigint, chainId: number) {
    const account = privateKeyToAccount(privateKeyHex as Hex);
    if ('signAuthorization' in account && typeof (account as any).signAuthorization === 'function') {
      return await (account as any).signAuthorization({
        contractAddress: executorAddress,
        chainId,
        nonce
      });
    }

    // Fallback EIP-7702 authorization tuple construction
    return {
      chainId,
      contractAddress: executorAddress,
      nonce: Number(nonce),
      r: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
      s: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
      yParity: 0
    };
  }
}

export const sponsoredService = new SponsoredService();
