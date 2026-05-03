import { logger } from '@dcache/config';
import { runCommand } from './commands/run.js';
import { clearCommand } from './commands/clear.js';
import { pruneCommand } from './commands/prune.js';

export type ParsedCommand =
  | {
      command: 'run';
      mode: 'glob';
      taskCommand: string;
      glob: string;
      ignore: string[];
      outputs: string[];
      extraArgs: string[];
    }
  | { command: 'run'; mode: 'nx'; task: string; project: string; outputs: string[]; extraArgs: string[] }
  | { command: 'clear' }
  | { command: 'prune' }
  | { command: 'help' };

const HELP_TEXT = `Usage: dcache <command> [options]

Commands:
  run <command> --glob <pattern>    Run with glob mode
  run <task> --project <name>       Run with nx mode
  clear                             Clear the cache
  prune                             Remove expired entries (requires provider.ttlSeconds)

Options:
  --glob <pattern>      Glob pattern for source files
  --ignore <pattern>    Exclude files matching this pattern from the hash (glob mode, repeatable)
  --project <name>      Nx project name
  --output <pattern>    Capture this path/glob as a cached output (repeatable)
  --help, -h            Show help
`;

interface ExtractedRepeatable {
  values: string[];
  rest: string[];
}

function extractRepeatable(args: string[], flag: string): ExtractedRepeatable {
  const values: string[] = [];
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag && i + 1 < args.length) {
      values.push(args[i + 1]);
      i++;
      continue;
    }
    rest.push(args[i]);
  }
  return { values, rest };
}

export function parseArgs(argv: string[]): ParsedCommand {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    return { command: 'help' };
  }

  const command = argv[0];

  if (command === 'clear') {
    return { command: 'clear' };
  }

  if (command === 'prune') {
    return { command: 'prune' };
  }

  if (command === 'run') {
    const { values: outputs, rest: afterOutputs } = extractRepeatable(argv.slice(1), '--output');
    const { values: ignore, rest } = extractRepeatable(afterOutputs, '--ignore');
    const globIdx = rest.indexOf('--glob');
    const projectIdx = rest.indexOf('--project');

    if (globIdx !== -1 && globIdx + 1 < rest.length) {
      const taskCommand = rest.slice(0, globIdx).join(' ');
      const glob = rest[globIdx + 1];
      const extraArgs = rest.slice(globIdx + 2);
      return { command: 'run', mode: 'glob', taskCommand, glob, ignore, outputs, extraArgs };
    }

    if (projectIdx !== -1 && projectIdx + 1 < rest.length) {
      if (ignore.length > 0) {
        logger.warn('--ignore is only supported in glob mode; flag is ignored');
      }
      const task = rest.slice(0, projectIdx).join(' ');
      const project = rest[projectIdx + 1];
      const extraArgs = rest.slice(projectIdx + 2);
      return { command: 'run', mode: 'nx', task, project, outputs, extraArgs };
    }

    logger.error('run command requires --glob <pattern> or --project <name>');
    return { command: 'help' };
  }

  logger.error(`Unknown command: ${command}`);
  return { command: 'help' };
}

export async function main(argv: string[]): Promise<number> {
  const parsed = parseArgs(argv);

  switch (parsed.command) {
    case 'run':
      return runCommand(parsed);
    case 'clear':
      return clearCommand();
    case 'prune':
      return pruneCommand();
    case 'help':
      process.stderr.write(HELP_TEXT);
      return 0;
  }
}
