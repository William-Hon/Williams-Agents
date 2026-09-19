export class NotImplementedError extends Error {
    constructor(message: string = "Not implemented yet") {
        super(message);
        this.name = "NotImplementedError";
    }
}
