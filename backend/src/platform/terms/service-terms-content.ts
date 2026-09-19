import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Platform-wide legal content. Orders only record the DB acceptance time. */
export class ServiceTermsContent {
  constructor(
    private readonly path = resolve(
      process.cwd(),
      'config',
      'service-terms.md',
    ),
  ) {}

  async loadServiceTerms(): Promise<string> {
    const content = await readFile(this.path, 'utf8');
    if (!content.trim()) throw new Error('SERVICE_TERMS_EMPTY');
    return content;
  }
}
