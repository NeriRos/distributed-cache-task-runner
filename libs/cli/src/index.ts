import { logger } from '@dcache/config';
import { runCommand } from './commands/run.js';
import { clearCommand } from './commands/clear.js';

export type ParsedCommand =
  | { command: 'run'; mode: 'glob'; taskCommand: string; glob: string; extraArgs: string[] }
  | { command: 'run'; mode: 'nx'; task: string; project: string; extraArgs: string[] }
  | { command: 'clear' }
  | { command: 'help' };

const HELP_TEXT = `Usage: dcache <command> [options]

Commands:
  run <command> --glob <pattern>    Run with glob mode
  run <task> --project <name>       Run with nx mode
  clear                             Clear the cache

Options:
  --glob <pattern>      Glob pattern for source files
  --project <name>      Nx project name
  --help, -h            Show help
`;

export function parseArgs(argv: string[]): ParsedCommand {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    return { command: 'help' };
  }

  const command = argv[0];

  if (command === 'clear') {
    return { command: 'clear' };
  }

  if (command === 'run') {
    const rest = argv.slice(1);
    const globIdx = rest.indexOf('--glob');
    const projectIdx = rest.indexOf('--project');

    if (globIdx !== -1 && globIdx + 1 < rest.length) {
      const taskCommand = rest.slice(0, globIdx).join(' ');
      const glob = rest[globIdx + 1];
      const extraArgs = rest.slice(globIdx + 2);
      return { command: 'run', mode: 'glob', taskCommand, glob, extraArgs };
    }

    if (projectIdx !== -1 && projectIdx + 1 < rest.length) {
      const task = rest.slice(0, projectIdx).join(' ');
      const project = rest[projectIdx + 1];
      const extraArgs = rest.slice(projectIdx + 2);
      return { command: 'run', mode: 'nx', task, project, extraArgs };
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
    case 'help':
      process.stderr.write(HELP_TEXT);
      return 0;
  }
}
