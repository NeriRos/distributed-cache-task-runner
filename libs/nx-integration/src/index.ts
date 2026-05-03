import path from 'node:path';
import { createProjectGraphAsync } from 'nx/src/project-graph/project-graph.js';
import { createProjectFileMapUsingProjectGraph } from 'nx/src/project-graph/file-map-utils.js';

export interface ProjectFiles {
  projectName: string;
  projectRoot: string;
  files: string[];
}

export async function getProjectFiles(projectName: string): Promise<ProjectFiles> {
  const graph = await createProjectGraphAsync({ exitOnError: false });
  const node = graph.nodes[projectName];
  if (!node) {
    throw new Error(`Nx project not found: ${projectName}`);
  }
  const fileMap = await createProjectFileMapUsingProjectGraph(graph);
  const projectFiles = fileMap[projectName] ?? [];
  const cwd = process.cwd();
  const files = projectFiles.map((f) => path.resolve(cwd, f.file));
  return { projectName, projectRoot: node.data.root, files };
}
