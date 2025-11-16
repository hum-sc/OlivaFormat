// Generates TypeScript types from the Cornell Notebook JSON schema
import { compileFromFile } from 'json-schema-to-typescript';
import * as fs from 'fs';

const file = 'src/oli.schema.json';
const outputPath = 'dist/types/oli.d.ts';

compileFromFile(file  )
  .then(ts => fs.writeFileSync(outputPath, ts))

