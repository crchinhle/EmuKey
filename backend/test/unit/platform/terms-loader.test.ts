import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { TermsLoader } from '../../../src/platform/terms/terms-loader.js';

describe('TermsLoader', () => {
  const root = join(tmpdir(), `emukey-terms-${process.pid}`);

  beforeAll(async () => {
    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'v1.md'), 'Điều khoản\r\n', 'utf8');
  });
  afterAll(() => rm(root, { recursive: true, force: true }));

  it('loads and normalizes the exact requested version', async () => {
    const terms = await new TermsLoader(root, 'test').load(1);
    expect(terms).toMatchObject({ content: 'Điều khoản\n', version: 1 });
    expect(terms.hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('fails closed for missing versions and unapproved production hashes', async () => {
    await expect(new TermsLoader(root, 'test').load(2)).rejects.toThrow(
      'Terms version 2 is unavailable',
    );
    await expect(new TermsLoader(root, 'production').load(1)).rejects.toThrow(
      'TERMS_APPROVED_HASH',
    );
    await expect(
      new TermsLoader(root, 'production', `0x${'00'.repeat(32)}`).load(1),
    ).rejects.toThrow('approved hash');
  });
});
