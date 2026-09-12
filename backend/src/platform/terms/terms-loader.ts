import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { Hex } from 'viem';

import { normalizeTerms, termsHash } from '../crypto/license-crypto.js';

export interface LicenseTerms {
  content: string;
  hash: Hex;
  version: number;
}

export class TermsLoader {
  constructor(
    private readonly root = resolve(process.cwd(), 'config', 'license-terms'),
    private readonly environment = process.env.NODE_ENV ?? 'development',
    private readonly approvedHash = process.env.TERMS_APPROVED_HASH,
  ) {}

  async load(version: number): Promise<LicenseTerms> {
    if (!Number.isSafeInteger(version) || version <= 0) {
      throw new Error('Terms version must be a positive integer');
    }
    let source: string;
    try {
      source = await readFile(resolve(this.root, `v${version}.md`), 'utf8');
    } catch (error) {
      throw new Error(`Terms version ${version} is unavailable`, { cause: error });
    }
    const content = normalizeTerms(source);
    const hash = termsHash(content);
    if (this.environment === 'production') {
      if (!this.approvedHash) {
        throw new Error('TERMS_APPROVED_HASH is required in production');
      }
      if (this.approvedHash.toLowerCase() !== hash.toLowerCase()) {
        throw new Error('Terms artefact does not match its approved hash');
      }
    }
    return { content, hash, version };
  }
}
