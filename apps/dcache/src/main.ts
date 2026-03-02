#!/usr/bin/env node

import { main } from '@dcache/cli';

const exitCode = await main(process.argv.slice(2));
process.exitCode = exitCode;
