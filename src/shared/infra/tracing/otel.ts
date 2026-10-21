// Must stay the first import wherever it's loaded (see server.ts) — patches
// http/express before they're required elsewhere.
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';

const otelSDK = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [new HttpInstrumentation(), new ExpressInstrumentation()],
});

otelSDK.start();

export { otelSDK };
