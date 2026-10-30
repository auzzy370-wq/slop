import { createRequire } from "module";
import fs from "fs";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Use tsx via child-like dynamic: write JSON by spawning tsx is easier
console.log("use tsx file instead");
