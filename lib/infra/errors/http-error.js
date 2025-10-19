export class HttpError extends Error {
    constructor(statusCode, message) {
        super(message || 'Http error');
        this.statusCode = statusCode;
        this.name = 'HttpError';
    }
}
//# sourceMappingURL=http-error.js.map