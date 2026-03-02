import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

export function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export async function hashFiles(filePaths: string[]): Promise<string> {
  const sorted = [...filePaths].sort();
  const hashes: string[] = [];

  for (const filePath of sorted) {
    hashes.push(await hashFile(filePath));
  }

  const combined = createHash('sha256');
  for (const h of hashes) {
    combined.update(h);
  }
  return combined.digest('hex');
}
