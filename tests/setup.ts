// Property tests run 100 cases by default. For a deep one-off run:  FC_RUNS=5000 npm test
import fc from "fast-check";

const runs = Number(process.env.FC_RUNS);
if (Number.isInteger(runs) && runs > 0) fc.configureGlobal({ numRuns: runs });
