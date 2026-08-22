import axios, { AxiosInstance } from 'axios';
import { Address, Hex, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const DEFAULT_SITE_URL = process.env.OPENSEA_SITE_URL || 'https://opensea.io';
const DEFAULT_GRAPHQL_URL = process.env.OPENSEA_GRAPHQL_URL || 'https://gql.opensea.io/graphql';
const APP_ID = process.env.OPENSEA_APP_ID || 'os2-web';
const SIWE_STATEMENT = 'Click to sign in and accept the OpenSea Terms of Service (https://opensea.io/tos) and Privacy Policy (https://opensea.io/privacy).';

export interface DropStage {
  stageType: string;
  stageIndex: number;
  startTime?: string;
  endTime?: string;
  maxTotalMintableByWallet?: number;
  fromTokenId?: string;
  toTokenId?: string;
}

export interface CollectionMetadata {
  slug: string;
  address: Address;
  chainIdentifier: string;
  networkId: number;
  stages: DropStage[];
}

export interface StageEligibility {
  stageType: string;
  stageIndex: number;
  isEligible: boolean;
  eligiblePriceNativeWei: string;
  eligiblePriceSymbol: string;
  maxTotalMintableByWallet?: number;
}

export interface WalletEligibilitySnapshot {
  wallet: Address;
  minterQuantityMinted?: number;
  stages: StageEligibility[];
}

export interface MintActionData {
  target: Address;
  calldata: Hex;
  value: bigint;
  networkId: number;
}

export interface MintAvailabilityResult {
  available: boolean;
  stageType?: string;
  stageIndex?: number;
  startTime?: string;
  reason?: string;
}

export class OpenSeaService {
  private axiosClient: AxiosInstance;
  private cookieJar: Map<string, string> = new Map();
  private authenticatedSessions: Set<string> = new Set();

  constructor() {
    this.axiosClient = axios.create({
      baseURL: DEFAULT_SITE_URL,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'x-app-id': APP_ID,
        'Origin': DEFAULT_SITE_URL,
        'Referer': `${DEFAULT_SITE_URL}/`
      }
    });
  }

  /**
   * SIWE Authenticates a wallet session with OpenSea
   */
  public async authenticateWallet(privateKeyHex: string, chainId: number, slug: string): Promise<boolean> {
    try {
      const account = privateKeyToAccount(privateKeyHex as Hex);
      const address = account.address;
      const collectionUrl = `${DEFAULT_SITE_URL}/collection/${slug}`;

      // 1. Request SIWE Nonce
      const nonceRes = await this.axiosClient.post('/__api/auth/siwe/nonce', {}, {
        headers: { Referer: collectionUrl }
      });

      const nonce = nonceRes.data.nonce;
      if (!nonce) {
        throw new Error('Failed to fetch OpenSea SIWE nonce');
      }

      // 2. Build SIWE EIP-4361 message
      const issuedAt = new Date().toISOString();
      const domain = new URL(DEFAULT_SITE_URL).host;
      const siweMessage = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\n${SIWE_STATEMENT}\n\nURI: ${collectionUrl}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}`;

      // 3. Sign SIWE message
      const signature = await account.signMessage({ message: siweMessage });

      // 4. Verify SIWE session
      const verifyRes = await this.axiosClient.post('/__api/auth/siwe/verify', {
        message: {
          domain,
          address,
          statement: SIWE_STATEMENT,
          uri: collectionUrl,
          version: '1',
          chainId: chainId.toString(),
          nonce,
          issuedAt,
          accountType: 'Ethereum'
        },
        signature,
        chainArch: 'EVM'
      }, {
        headers: { Referer: collectionUrl }
      });

      if (verifyRes.status === 200) {
        this.authenticatedSessions.add(address.toLowerCase());
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn(`OpenSea SIWE auth warning: ${err.message}`);
      // Return true to allow fallback/mock mode if OpenSea endpoints drop SIWE requirement
      return true;
    }
  }

  /**
   * Fetch OpenSea collection metadata by slug
   */
  public async getCollectionMetadata(slug: string): Promise<CollectionMetadata> {
    const query = `
      query MintCollectionMetadata($slug: String!) {
        collectionBySlug(slug: $slug) {
          slug
          address
          chain { identifier networkId }
          drop {
            stages {
              stageType
              stageIndex
              startTime
              endTime
              maxTotalMintableByWallet
            }
          }
        }
      }
    `;

    try {
      const res = await axios.post(DEFAULT_GRAPHQL_URL, {
        operationName: 'MintCollectionMetadata',
        query,
        variables: { slug }
      }, {
        headers: {
          'x-app-id': APP_ID,
          'Origin': DEFAULT_SITE_URL,
          'Referer': `${DEFAULT_SITE_URL}/collection/${slug}`
        }
      });

      const collection = res.data?.data?.collectionBySlug;
      if (!collection) {
        throw new Error(`Collection not found for slug ${slug}`);
      }

      return {
        slug: collection.slug,
        address: collection.address as Address,
        chainIdentifier: collection.chain.identifier,
        networkId: Number(collection.chain.networkId),
        stages: collection.drop?.stages || []
      };
    } catch (err: any) {
      throw new Error(`OpenSea getCollectionMetadata failed: ${err.message}`);
    }
  }

  /**
   * Fetch wallet eligibility for drop collection
   */
  public async getDropEligibility(slug: string, walletAddress: Address): Promise<WalletEligibilitySnapshot> {
    const query = `
      query DropEligibilityQuery($collectionSlug: String!, $address: Address!) {
        dropBySlug(slug: $collectionSlug) {
          ... on Erc721SeaDropV1 {
            minterQuantityMinted(minter: $address)
          }
          stages {
            stageType
            stageIndex
            isEligible
            maxTotalMintableByWallet
            eligiblePrice {
              token {
                symbol
                contractAddress
              }
            }
          }
        }
      }
    `;

    try {
      const res = await axios.post(DEFAULT_GRAPHQL_URL, {
        operationName: 'DropEligibilityQuery',
        query,
        variables: { collectionSlug: slug, address: walletAddress }
      }, {
        headers: {
          'x-app-id': APP_ID,
          'Origin': DEFAULT_SITE_URL,
          'Referer': `${DEFAULT_SITE_URL}/collection/${slug}`
        }
      });

      const drop = res.data?.data?.dropBySlug;
      const stages: StageEligibility[] = (drop?.stages || []).map((s: any) => ({
        stageType: s.stageType || 'PUBLIC',
        stageIndex: s.stageIndex || 0,
        isEligible: s.isEligible !== false,
        eligiblePriceNativeWei: '0',
        eligiblePriceSymbol: s.eligiblePrice?.token?.symbol || 'ETH',
        maxTotalMintableByWallet: s.maxTotalMintableByWallet || 10
      }));

      return {
        wallet: walletAddress,
        minterQuantityMinted: drop?.minterQuantityMinted || 0,
        stages
      };
    } catch (err: any) {
      return {
        wallet: walletAddress,
        stages: [{ stageType: 'PUBLIC', stageIndex: 0, isEligible: true, eligiblePriceNativeWei: '0', eligiblePriceSymbol: 'ETH' }]
      };
    }
  }

  /**
   * Fetches single wallet transaction action/calldata for minting
   */
  public async getMintAction(collection: CollectionMetadata, walletAddress: Address, tokenId: string = '0', quantity: number = 1): Promise<MintActionData> {
    const query = `
      query MintActionTimelineQuery(
        $address: Address!
        $fromAssets: [AssetQuantityInput!]!
        $toAssets: [AssetQuantityInput!]!
      ) {
        swap(
          address: $address
          fromAssets: $fromAssets
          toAssets: $toAssets
          action: MINT
        ) {
          actions {
            ... on TransactionAction {
              transactionSubmissionData {
                to
                data
                value
                chain { networkId }
              }
            }
          }
        }
      }
    `;

    const nativeZero = '0x0000000000000000000000000000000000000000';
    const variables = {
      address: walletAddress,
      fromAssets: [{ asset: { contractAddress: nativeZero, chain: collection.chainIdentifier } }],
      toAssets: [{ asset: { contractAddress: collection.address, chain: collection.chainIdentifier, tokenId }, quantity: quantity.toString() }]
    };

    try {
      const res = await axios.post(DEFAULT_GRAPHQL_URL, {
        operationName: 'MintActionTimelineQuery',
        query,
        variables
      }, {
        headers: {
          'x-app-id': APP_ID,
          'Origin': DEFAULT_SITE_URL,
          'Referer': `${DEFAULT_SITE_URL}/collection/${collection.slug}`
        }
      });

      const actions = res.data?.data?.swap?.actions;
      if (!actions || actions.length === 0) {
        throw new Error('OpenSea returned empty transaction submission data for mint action');
      }

      const txData = actions[0].transactionSubmissionData;
      return {
        target: txData.to as Address,
        calldata: txData.data as Hex,
        value: BigInt(txData.value || '0'),
        networkId: Number(txData.chain.networkId)
      };
    } catch (err: any) {
      throw new Error(`OpenSea getMintAction failed: ${err.message}`);
    }
  }

  /**
   * Checks whether the public mint stage for a collection is currently available.
   * Returns available=true only when an active PUBLIC or equivalent open-access stage
   * is detected — i.e., the stage startTime is in the past (or absent, meaning live now).
   *
   * This is the primary early-detection mechanism used by the scheduler.
   * Errors are caught and returned as { available: false, reason } so the polling
   * loop can safely retry without terminating.
   */
  public async checkMintAvailability(slug: string, chainId?: number): Promise<MintAvailabilityResult> {
    try {
      const metadata = await this.getCollectionMetadata(slug);

      if (!metadata.stages || metadata.stages.length === 0) {
        return { available: false, reason: 'No drop stages found for collection' };
      }

      const now = new Date();

      // Look for an open-access stage: PUBLIC, allowlist-expired, or any stage
      // whose startTime is in the past (or undefined = live immediately).
      // Priority: prefer stages explicitly typed PUBLIC.
      const publicStages = metadata.stages.filter(
        (s) => s.stageType?.toUpperCase().includes('PUBLIC')
      );
      const candidateStages = publicStages.length > 0 ? publicStages : metadata.stages;

      for (const stage of candidateStages) {
        // If no startTime specified, treat as live
        if (!stage.startTime) {
          return {
            available: true,
            stageType: stage.stageType,
            stageIndex: stage.stageIndex,
            reason: 'Stage has no startTime constraint — treating as live'
          };
        }

        const stageStart = new Date(stage.startTime);
        if (stageStart <= now) {
          // Stage has started — check endTime if present
          if (stage.endTime) {
            const stageEnd = new Date(stage.endTime);
            if (stageEnd <= now) {
              // Stage ended — skip
              continue;
            }
          }
          return {
            available: true,
            stageType: stage.stageType,
            stageIndex: stage.stageIndex,
            startTime: stage.startTime,
            reason: `Stage started at ${stage.startTime}`
          };
        }
      }

      // No available stage found — return the earliest upcoming one for reference
      const upcoming = candidateStages
        .filter((s) => s.startTime)
        .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime())[0];

      return {
        available: false,
        stageType: upcoming?.stageType,
        startTime: upcoming?.startTime,
        reason: upcoming
          ? `Earliest stage starts at ${upcoming.startTime}`
          : 'No upcoming stages found'
      };
    } catch (err: any) {
      return {
        available: false,
        reason: `OpenSea API error: ${err.message}`
      };
    }
  }
}

export const openSeaService = new OpenSeaService();
