import { Logger } from "@autonomous-workflows/core";
import "./config/env";
import { ApplyGuySource } from "./sources/applyguy";
import { SimplifySource } from "./sources/simplify";
import { SourceRunner } from "./sources/runner";

const logger = new Logger("internship-watcher");
const isDebug = process.argv.includes("--debug");

async function main() {
    console.log("==================================================");
    console.log("INTERNSHIP SOURCE CHECK");
    console.log("==================================================\n");

    const runner = new SourceRunner([new ApplyGuySource(), new SimplifySource()]);
    const result = await runner.runAll();
    
    for (const res of result.fetchResults) {
        logger.info(`Fetch started`, `Source:${res.source}`);
        logger.info(`HTTP ${res.httpStatus || "N/A"}`, `Source:${res.source}`);
        
        if (res.success) {
            logger.info(`JSON parsed`, `Source:${res.source}`);
            logger.info(`Raw records: ${res.rawRecordCount}`, `Source:${res.source}`);
            logger.info(`Valid records: ${res.validRecordCount}`, `Source:${res.source}`);
            logger.info(`Invalid records: ${res.invalidRecordCount}`, `Source:${res.source}`);
            logger.info(`Duration: ${res.durationMs} ms`, `Source:${res.source}`);
            if (res.etag || res.lastModified) {
                logger.info(`ETag: ${res.etag || "N/A"} | Last-Modified: ${res.lastModified || "N/A"}`, `Source:${res.source}`);
            }
            logger.info(`SUCCESS\n`, `Source:${res.source}`);
            
            if (isDebug && res.records.length > 0) {
                logger.info(`Debug: First 3 records:`, `Source:${res.source}`);
                console.log(JSON.stringify(res.records.slice(0, 3), null, 2), "\n");
            }
        } else {
            logger.error(`FAILED: ${res.error}`, `Source:${res.source}`);
            console.log();
        }
    }

    console.log("==================================================");
    console.log("RESULT");
    console.log("==================================================\n");
    
    console.log(`Sources attempted: ${result.totalAttempted}`);
    console.log(`Succeeded: ${result.totalSucceeded}`);
    console.log(`Failed: ${result.totalFailed}`);
    console.log(`Total valid records: ${result.totalValidRecords}\n`);
    
    console.log(`Status: ${result.status}\n`);
    
    if (result.status === "FAILED") {
        process.exit(1);
    }
}

main().catch(err => {
    logger.error("Fatal error running sources", "SourceRunner", err);
    process.exit(1);
});
