import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Include the exact working source used for this build, including uncommitted files.
let files;
try {
  files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n');
} catch {
  // Downloaded source archives have no .git directory; retain their file manifest.
  files = JSON.parse(readFileSync('.source-files.json', 'utf8'));
}
const temp = mkdtempSync(join(tmpdir(), 'pdf-source-'));
try {
  mkdirSync('public', { recursive: true });
  writeFileSync(join(temp, '.source-files.json'), JSON.stringify(files));
  writeFileSync(join(temp, 'files'), [...new Set(files)].join('\n') + '\n');
  execFileSync('tar', ['-czf', 'public/source.tar.gz', '-T', join(temp, 'files'), '-C', temp, '.source-files.json']);
} finally { rmSync(temp, { recursive: true, force: true }); }
