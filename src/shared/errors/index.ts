export class AppError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, public readonly code: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'AppError';
    this.cause = options?.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InitializationError extends AppError {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message, 'INITIALIZATION_ERROR', { cause: originalError });
    this.name = 'InitializationError';
  }
}

export class MigrationError extends AppError {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message, 'MIGRATION_ERROR', { cause: originalError });
    this.name = 'MigrationError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message, 'DATABASE_ERROR', { cause: originalError });
    this.name = 'DatabaseError';
  }
}
