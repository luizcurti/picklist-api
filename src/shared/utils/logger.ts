import { trace } from '@opentelemetry/api';
import { getRequestId } from '@shared/infra/http/context/requestContext';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const requestId = getRequestId();
    // Reads OTel's active span directly — undefined (safe) when the SDK hasn't started (e.g. tests).
    const traceId = trace.getActiveSpan()?.spanContext().traceId;

    const logEntry = {
      timestamp: this.formatTimestamp(),
      level: level.toUpperCase(),
      message,
      ...(requestId && { requestId }),
      ...(traceId && { traceId }),
      ...(context && { context }),
    };

    const output = JSON.stringify(logEntry);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'debug':
        if (process.env.NODE_ENV !== 'production') {
          console.debug(output);
        }
        break;
      default:
        console.log(output);
    }
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }
}

export const logger = new Logger();
