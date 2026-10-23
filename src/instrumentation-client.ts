import { config } from "zod";

// Runs before the app on the client. Zod 4 probes for `new Function` to compile its parsers; our CSP has no
// 'unsafe-eval', so the probe would log a violation on every page. Jitless parsing is plenty for our schemas.
config({ jitless: true });
