export function getEnvVar(key: string, required: boolean = true): string {
    const val = process.env[key];
    if (required && !val) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return val || "";
}
