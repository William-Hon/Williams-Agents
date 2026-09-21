export function getEnvVar(key: string, required: boolean = true): string {
    // @ts-ignore
    const val = typeof Deno !== 'undefined' ? Deno.env.get(key) : process.env[key];
    if (required && !val) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return val || "";
}
