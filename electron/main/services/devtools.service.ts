import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import type { DevToolInfo } from '../../shared/types/devtools';

const exec = promisify(execCallback);

const TOOL_COMMANDS: Array<{
  id: string;
  label: string;
  command: string;
}> = [
  { id: 'python', label: 'Python', command: 'python3 --version || python --version' },
  { id: 'node', label: 'Node.js', command: 'node --version' },
  { id: 'npm', label: 'npm', command: 'npm --version' },
  { id: 'yarn', label: 'Yarn', command: 'yarn --version' },
  { id: 'pnpm', label: 'pnpm', command: 'pnpm --version' },
  { id: 'git', label: 'Git', command: 'git --version' },
  { id: 'docker', label: 'Docker', command: 'docker --version' },
  { id: 'docker-compose', label: 'Docker Compose', command: 'docker compose version || docker-compose --version' },
  { id: 'go', label: 'Go', command: 'go version' },
  { id: 'rust', label: 'Rust', command: 'rustc --version' },
  { id: 'cargo', label: 'Cargo', command: 'cargo --version' },
  { id: 'java', label: 'Java', command: 'java --version' },
  { id: 'ruby', label: 'Ruby', command: 'ruby --version' },
  { id: 'pip', label: 'pip', command: 'pip --version' },
  { id: 'pip3', label: 'pip3', command: 'pip3 --version' }
];

const normalizeVersion = (output: string) => {
  return output.replace(/\s+/g, ' ').trim();
};

export const getDevToolsInfo = async (): Promise<DevToolInfo[]> => {
  const results: DevToolInfo[] = [];

  for (const tool of TOOL_COMMANDS) {
    try {
      const { stdout, stderr } = await exec(tool.command, { shell: '/bin/zsh' });
      const raw = stdout || stderr || '';
      results.push({
        id: tool.id,
        label: tool.label,
        version: normalizeVersion(raw) || 'Unknown',
        available: true
      });
    } catch (error) {
      results.push({
        id: tool.id,
        label: tool.label,
        version: 'Not installed',
        available: false
      });
    }
  }

  return results;
};
