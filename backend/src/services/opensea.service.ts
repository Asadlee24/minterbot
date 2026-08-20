import axios, { AxiosInstance } from 'axios';
import { Address, Hex } from 'viem';
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
  endTime?: string;
  reason?: string;
}

export class OpenSeaService {
  private axiosClient: AxiosInstance;
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

  public async authenticateWallet(privateKeyHex: string, chainId: number, slug: string): Promise<boolean> {
    try {
      const account = privateKeyToAccount(privateKeyHex as Hex);
      const address = account.address;
      const collectionUrl = `${DEFAULT_SITE_URL}/collection/${slug}`;

      const nonceRes = await this.axiosClient.post('/__api/auth/siwe/nonce', {}, { headers: { Referer: collectionUrl } });
      const nonce = nonceRes.data.nonce;
      if (!nonce) throw new Error('Failed to fetch OpenSea SIWE nonce');

      const issuedAt = new Date().toISOString();
      const domain = new URL(DEFAULT_SITE_URL).host;
      const siweMessage = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\n${SIWE_STATEMENT}\n\nURI: ${collectionUrl}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}`;
      const signature = await account.signMessage({ message: siweMessage });

      const verifyRes = await this.axiosClient.post('/__api/auth/siwe/verify', {
        message: { domain, address, statement: SIWE_STATEMENT, uri: collectionUrl, version: '1', chainId: chainId.toString(), nonce, issuedAt, accountType: 'Ethereum' },
        signature,
        chainArch: 'EVM'
      }, { headers: { Referer: collectionUrl } });

      if (verifyRes.status === 200) {
        this.authenticatedSessions.add(address.toLowerCase());
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn(`OpenSea SIWE auth warning: ${err.message}`);
      return true;
    }
  }

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
        headers: { 'x-app-id': APP_ID, 'Origin': DEFAULT_SITE_URL, 'Referer': `${DEFAULT_SITE_URL}/collection/${slug}` }
      });

      const collection = res.data?.data?.collectionBySlug;
      if (!collection) throw new Error(`Collection not found for slug ${slug}`);

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
   * Determines whether the public mint/drop stage is actually live.
   * A collection merely existing is never treated as mint availability.
   */
  public async checkMintAvailability(slug: string, expectedChainId?: number): Promise<MintAvailabilityResult> {
    try {
      const metadata = await this.getCollectionMetadata(slug);
      if (expectedChainId !== undefined && metadata.networkId !== expectedChainId) {
        return { available: false, reason: `OpenSea collection is on chain ${metadata.networkId}, expected ${expectedChainId}` };
      }

      const now = Date.now();
      const publicStages = metadata.stages
        .filter((stage) => /public/i.test(stage.stageType || ''))
        .sort((a, b) => a.stageIndex - b.stageIndex);

      if (publicStages.length === 0) {
        return { available: false, reason: 'No public mint stage reported by OpenSea' };
      }

      for (const stage of publicStages) {
        const start = stage.startTime ? Date.parse(stage.startTime) : NaN;
        const end = stage.endTime ? Date.parse(stage.endTime) : NaN;
        if (!Number.isFinite(start)) continue;

        const started = start <= now;
        const active = started && (!Number.isFinite(end) || end > now);
        if (active) {
          return {
            available: true,
            stageType: stage.stageType,
            stageIndex: stage.stageIndex,
            startTime: stage.startTime,
            endTime: stage.endTime,
            reason: 'OpenSea public stage is active'
          };
        }
      }

      const next = publicStages.find((stage) => stage.startTime && Date.parse(stage.startTime) > now);
      return {
        available: false,
        stageType: next?.stageType,
        stageIndex: next?.stageIndex,
        startTime: next?.startTime,
        reason: next ? `Public stage has not started; OpenSea reports ${next.startTime}` : 'Public stage is not currently active'
      };
    } catch (err: any) {
      throw new Error(`OpenSea availability check failed: ${err.message}`);
    }
  }

  public async getDropEligibility(slug: string, walletAddress: Address): Promise<WalletEligibilitySnapshot> {
    const query = `
      query DropEligibilityQuery($collectionSlug: String!, $address: Address!) {
        dropBySlug(slug: $collectionSlug) {
          ... on Erc721SeaDropV1 { minterQuantityMinted(minter: $address) }
          stages {
            stageType
            stageIndex
            isEligible
            maxTotalMintableByWallet
            eligiblePrice { token { symbol contractAddress } }
          }
        }
      }
    `;

    try {
      const res = await axios.post(DEFAULT_GRAPHQL_URL, {
        operationName: 'DropEligibilityQuery', query, variables: { collectionSlug: slug, address: walletAddress }
      }, { headers: { 'x-app-id': APP_ID, 'Origin': DEFAULT_SITE_URL, 'Referer': `${DEFAULT_SITE_URL}/collection/${slug}` } });

      const drop = res.data?.data?.dropBySlug;
      const stages: StageEligibility[] = (drop?.stages || []).map((s: any) => ({
        stageType: s.stageType || 'PUBLIC',
        stageIndex: s.stageIndex || 0,
        isEligible: s.isEligible !== false,
        eligiblePriceNativeWei: '0',
        eligiblePriceSymbol: s.eligiblePrice?.token?.symbol || 'ETH',
        maxTotalMintableByWallet: s.maxTotalMintableByWallet || 10
      }));
      return { wallet: walletAddress, minterQuantityMinted: drop?.minterQuantityMinted || 0, stages };
    } catch (err: any) {
      return { wallet: walletAddress, stages: [{ stageType: 'PUBLIC', stageIndex: 0, isEligible: true, eligiblePriceNativeWei: '0', eligiblePriceSymbol: 'ETH' }] };
    }
  }

  public async getMintAction(collection: CollectionMetadata, walletAddress: Address, tokenId: string = '0', quantity: number = 1): Promise<MintActionData> {
    const query = `
      query MintActionTimelineQuery($address: Address!, $fromAssets: [AssetQuantityInput!]!, $toAssets: [AssetQuantityInput!]!) {
        swap(address: $address, fromAssets: $fromAssets, toAssets: $toAssets, action: MINT) {
          actions { ... on TransactionAction { transactionSubmissionData { to data value chain { networkId } } } }
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
      const res = await axios.post(DEFAULT_GRAPHQL_URL, { operationName: 'MintActionTimelineQuery', query, variables }, {
        headers: { 'x-app-id': APP_ID, 'Origin': DEFAULT_SITE_URL, 'Referer': `${DEFAULT_SITE_URL}/collection/${collection.slug}` }
      });
      const actions = res.data?.data?.swap?.actions;
      if (!actions || actions.length === 0) throw new Error('OpenSea returned empty transaction submission data for mint action');
      const txData = actions[0].transactionSubmissionData;
      return { target: txData.to as Address, calldata: txData.data as Hex, value: BigInt(txData.value || '0'), networkId: Number(txData.chain.networkId) };
    } catch (err: any) {
      throw new Error(`OpenSea getMintAction failed: ${err.message}`);
    }
  }
}

export const openSeaService = new OpenSeaService();
