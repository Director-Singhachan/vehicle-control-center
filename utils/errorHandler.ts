// Error Handler Utilities - Standardized error handling for services

export interface ServiceError {
  message: string;
  code?: string;
  details?: any;
}

/**
 * Standardized error handler for service functions
 * Logs error and throws a consistent error format
 */
export function handleServiceError(
  error: any,
  context: string,
  operation?: string
): never {
  const errorMessage = error?.message || 'Unknown error occurred';
  const errorCode = error?.code || 'UNKNOWN_ERROR';
  
  console.error(`[${context}]${operation ? ` Error in ${operation}:` : ' Error:'}`, {
    message: errorMessage,
    code: errorCode,
    error,
  });

  const serviceError: ServiceError = {
    message: errorMessage,
    code: errorCode,
    details: error?.details || error,
  };

  throw serviceError;
}

/**
 * Wraps async service functions with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: string
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleServiceError(error, context, fn.name);
    }
  }) as T;
}
