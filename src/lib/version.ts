import type { BuildInfo } from './types.ts';

/** Version and build metadata, injected at build time (see vite.config.ts). */
export const BUILD: BuildInfo = __SHIFTNEST_BUILD__;

export const VERSION_LABEL = `v${BUILD.version} (build ${BUILD.buildNumber})`;

export const REPO_URL = 'https://github.com/lobojoel2003/Shiftnest';
