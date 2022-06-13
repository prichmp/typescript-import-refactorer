# Typescript Import Refactorer

Easily refactor relative imports in TypeScript files via the CLI.

Ever move a bunch of Typescript files to new folders, but the imports did not get rewritten to point to the new file locations? This tool works by searching the Typescript project to find files with the same name as the previous import. Only rewrites relative imports. 

## Installation

```
npm install typescript-import-refactorer -g
```

## Usage

```
Options:
  --source 
  -s
      REQUIRED
      A glob containing all of the files with imports that need refactoring.
      Example: C:/Users/Me/Repos/my-project/src/**/@(*.ts)
  --imports
  -i
      REQUIRED
      All of the files that could possibly be imported by a source file.
      Example: C:/Users/Me/Repos/my-project/src/**/@(*.ts)
  --ts-config
  -t
      REQUIRED
      The absolute path to the tsconfig.json file for the Typescript project
      Example: C:/Users/Me/Repos/my-project/tsconfig.json
  --dry-run
  -d
      Optional
      This flag prevents any file from being edited.
  --verbose
  -v
      Optional
      Prints additional debugging information. 
```

### Example

You need to pass the `path` (`-p`) to the files that should be refactored, the `current-import-sources` (`-s`) and the `target-import-source` (`-t`).

```bash
 typescript-import-refactorer -t \"C:/Users/Me/Repos/my-project/tsconfig.json\" -s \"C:/Users/Me/Repos/my-project/src/**/@(*.ts)\" -i \"C:/Users/Me/Repos/my-project/src/**/@(*.ts)\"
```

```ts
// before
import foo from '../../some/old/folder/foo';

// after
import foo from '../new/folder/foo';
```
