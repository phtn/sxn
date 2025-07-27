#!/usr/bin/env bun
import { build, type BuildConfig } from "bun";
import plugin from "bun-plugin-tailwind";
import { existsSync } from "fs";
import { rm } from "fs/promises";
import path from "path";

// Print help text if requested
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
🏗️  Bun Build Script

Usage: bun run build.ts [options]

Common Options:
  --outdir <path>          Output directory (default: "dist")
  --minify                 Enable minification (or --minify.whitespace, --minify.syntax, etc)
  --source-map <type>      Sourcemap type: none|linked|inline|external
  --target <target>        Build target: browser|bun|node
  --format <format>        Output format: esm|cjs|iife
  --splitting              Enable code splitting
  --packages <type>        Package handling: bundle|external
  --public-path <path>     Public path for assets
  --env <mode>             Environment handling: inline|disable|prefix*
  --conditions <list>      Package.json export conditions (comma separated)
  --external <list>        External packages (comma separated)
  --banner <text>          Add banner text to output
  --footer <text>          Add footer text to output
  --define <obj>           Define global constants (e.g. --define.VERSION=1.0.0)
  --help, -h               Show this help message

Example:
  bun run build.ts --outdir=dist --minify --source-map=linked --external=react,react-dom
`);
  process.exit(0);
}

// Helper function to convert kebab-case to camelCase
const toCamelCase = (str: string): string => {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
};

// Helper function to parse a value into appropriate type
const parseValue = (value: string): any => {
  // Handle true/false strings
  if (value === "true") return true;
  if (value === "false") return false;

  // Handle numbers
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d*\.\d+$/.test(value)) return parseFloat(value);

  // Handle arrays (comma-separated)
  if (value.includes(",")) return value.split(",").map((v) => v.trim());

  // Default to string
  return value;
};

// Magical argument parser that converts CLI args to BuildConfig
function parseArgs(): Partial<BuildConfig> {
  const config: Record<string, any> = {};
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;

    // Handle --no-* flags
    if (arg.startsWith("--no-")) {
      const key = toCamelCase(arg.slice(5));
      config[key] = false;
      continue;
    }

    // Handle --flag (boolean true)
    if (
      !arg.includes("=") &&
      (i === args.length - 1 || args[i + 1].startsWith("--"))
    ) {
      const key = toCamelCase(arg.slice(2));
      config[key] = true;
      continue;
    }

    // Handle --key=value or --key value
    let key: string;
    let value: string;

    if (arg.includes("=")) {
      [key, value] = arg.slice(2).split("=", 2);
    } else {
      key = arg.slice(2);
      value = args[++i];
    }

    // Convert kebab-case key to camelCase
    key = toCamelCase(key);

    // Handle nested properties (e.g. --minify.whitespace)
    if (key.includes(".")) {
      const [parentKey, childKey] = key.split(".");
      config[parentKey] = config[parentKey] ?? {};
      config[parentKey][childKey] = parseValue(value);
    } else {
      config[key] = parseValue(value);
    }
  }

  return config as Partial<BuildConfig>;
}

// Helper function to format file sizes
const formatFileSize = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

console.log("\n🚀 Starting build process...\n");

// Parse CLI arguments with our magical parser
const cliConfig = parseArgs();
const outdir = cliConfig.outdir ?? path.join(process.cwd(), "dist");

if (existsSync(outdir)) {
  console.log(`🗑️ Cleaning previous build at ${outdir}`);
  await rm(outdir, { recursive: true, force: true });
}

const start = performance.now();

const core = [
  "src/core/content.ts",
  "src/core/injected.ts",
  "src/core/background.ts",
];

// Scan for all HTML files in the project
const entrypoints = [...new Bun.Glob("**.html").scanSync("src")]
  .map((a) => path.resolve("src", a))
  .filter((dir) => !dir.includes("node_modules"));
console.log(
  `📄 Found ${entrypoints.length} HTML ${entrypoints.length === 1 ? "file" : "files"} to process\n`,
);

// Build all the HTML files
const result = await build({
  entrypoints: [...entrypoints, ...core],
  plugins: [plugin],
  target: "browser",
  outdir: "dist",
  format: "esm",
  // sourcemap: "linked",
  // minify: true,
  // define: {
  //   "process.env.NODE_ENV": JSON.stringify("production"),
  // },
  // ...cliConfig, // Merge in any CLI-provided options
});

// Copy the core files to the root directory for Chrome extension
console.log("📋 Copying core files to root directory for Chrome extension...");

// Clean up old chunk files from root directory
console.log("🧹 Cleaning up old chunk files...");
try {
  const oldChunkFiles = [...new Bun.Glob("chunk-*").scanSync()];
  for (const file of oldChunkFiles) {
    await rm(file, { force: true });
  }
  if (oldChunkFiles.length > 0) {
    console.log(`✅ Removed ${oldChunkFiles.length} old chunk files`);
  }
} catch (error) {
  console.error(`❌ Error cleaning up old chunk files:`, error);
}

// Helper function to safely copy a file
const safeCopyFile = async (src: string, dest: string) => {
  try {
    const file = Bun.file(src);
    if (await file.exists()) {
      await Bun.write(dest, await file.text());
      console.log(`✅ Copied ${src} to ${dest}`);
    } else {
      console.error(`❌ Source file not found: ${src}`);
    }
  } catch (error) {
    console.error(`❌ Error copying ${src} to ${dest}:`, error);
  }
};

// Copy each file individually with error handling
await safeCopyFile("dist/src/core/injected.js", "injected.js");
await safeCopyFile("dist/src/core/content.js", "content.js");
await safeCopyFile("dist/src/core/background.js", "background.js");

// Find and copy all chunk files
try {
  const distFiles = [...new Bun.Glob("dist/chunk-*").scanSync()];
  const chunkFiles = [];
  
  for (const file of distFiles) {
    const fileName = path.basename(file);
    await safeCopyFile(`dist/${fileName}`, fileName);
    chunkFiles.push(fileName);
  }
  
  console.log(`✅ Copied ${chunkFiles.length} chunk files to root directory`);
  
  // Copy and fix the index.html file
  const indexFile = Bun.file("dist/src/index.html");
  if (await indexFile.exists()) {
    let indexContent = await indexFile.text();
    
    // Fix all relative paths in the HTML file
    // This regex matches any path that starts with "../" and is inside quotes or href/src attributes
    indexContent = indexContent.replace(
      /(href|src)=["']\.\.\/([^"']+)["']/g, 
      (match, attr, filePath) => `${attr}="${filePath}"`
    );
    
    await Bun.write("index.html", indexContent);
    console.log(`✅ Copied and fixed paths in index.html`);
  } else {
    console.error(`❌ Source file not found: dist/src/index.html`);
  }
} catch (error) {
  console.error(`❌ Error processing files:`, error);
}

// Print the results
const end = performance.now();

const outputTable = result.outputs.map((output) => ({
  File: path.relative(process.cwd(), output.path),
  Type: output.kind,
  Size: formatFileSize(output.size),
}));

console.table(outputTable);
const buildTime = (end - start).toFixed(2);

console.log(`\n✅ Build completed in ${buildTime}ms\n`);