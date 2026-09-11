const productSchema = {
  type: 'object',
  properties: {
    product_code: { type: 'string', example: 'SKU-001' },
    quantity: { type: 'integer', example: 10 },
    pick_location: { type: 'string', example: 'A1' },
  },
  required: ['product_code', 'quantity', 'pick_location'],
};

const productInputSchema = {
  type: 'object',
  properties: {
    product_code: { type: 'string', example: 'SKU-001' },
    quantity: { type: 'integer', example: 10 },
    pick_location: { type: 'string', example: 'A1' },
  },
  required: ['product_code', 'quantity', 'pick_location'],
};

const editInputSchema = {
  type: 'object',
  description:
    'Provide exactly one of quantity (absolute) or quantity_delta (relative, positive or negative).',
  properties: {
    quantity: {
      type: 'integer',
      example: 10,
      description: 'Sets the absolute stock quantity.',
    },
    quantity_delta: {
      type: 'integer',
      example: -3,
      description:
        'Adjusts the current stock by this amount. Rejected with 409 if it would result in negative stock.',
    },
    pick_location: { type: 'string', example: 'A1' },
  },
  required: ['pick_location'],
};

const errorSchema = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    type: { type: 'string' },
  },
};

const pickInputSchema = {
  type: 'object',
  properties: {
    product_code: { type: 'string', example: 'SKU-001' },
    quantity: { type: 'integer', example: 2 },
    pick_location: { type: 'string', example: 'A1' },
  },
  required: ['product_code', 'quantity', 'pick_location'],
};

const pickAcceptedSchema = {
  type: 'object',
  properties: {
    pickId: { type: 'string', format: 'uuid' },
    status: { type: 'string', example: 'accepted' },
  },
};

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Picklist API',
    version: '1.0.0',
    description:
      'REST API for warehouse product data and asynchronous picking, built with Clean Architecture.',
  },
  servers: [{ url: '/api/v1', description: 'v1 endpoints' }],
  tags: [{ name: 'Products' }, { name: 'Picks' }, { name: 'Health' }],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    '/products': {
      get: {
        tags: ['Products'],
        summary: 'List products (paginated)',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 100, maximum: 1000 },
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', default: 0, minimum: 0 },
          },
        ],
        responses: {
          '200': {
            description: 'Paginated list of products',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: productSchema },
                    pagination: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer' },
                        limit: { type: 'integer' },
                        offset: { type: 'integer' },
                        hasMore: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Products'],
        summary: 'Create a product',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: productInputSchema } },
        },
        responses: {
          '201': {
            description: 'Product created',
            content: { 'application/json': { schema: productSchema } },
          },
          '400': {
            description: 'Validation error',
            content: { 'application/json': { schema: errorSchema } },
          },
          '409': {
            description: 'Product already exists',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
    },
    '/products/{product_code}': {
      get: {
        tags: ['Products'],
        summary: 'Find a product by code',
        parameters: [
          {
            name: 'product_code',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Product found',
            content: { 'application/json': { schema: productSchema } },
          },
          '404': {
            description: 'Product not found',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
      put: {
        tags: ['Products'],
        summary: 'Update a product',
        description:
          'Set quantity for an absolute replacement, or quantity_delta for a relative adjustment (e.g. -3 to decrement, +10 to increment) — exactly one of the two is required.',
        parameters: [
          {
            name: 'product_code',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: editInputSchema } },
        },
        responses: {
          '200': {
            description: 'Product updated',
            content: { 'application/json': { schema: productSchema } },
          },
          '400': {
            description:
              'Validation error (e.g. both or neither of quantity/quantity_delta provided)',
            content: { 'application/json': { schema: errorSchema } },
          },
          '404': {
            description: 'Product not found',
            content: { 'application/json': { schema: errorSchema } },
          },
          '409': {
            description: 'quantity_delta would result in negative stock',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
      delete: {
        tags: ['Products'],
        summary: 'Delete a product',
        parameters: [
          {
            name: 'product_code',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'Product deleted' },
          '404': {
            description: 'Product not found',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
    },
    '/picks': {
      post: {
        tags: ['Picks'],
        summary: 'Request an asynchronous pick',
        description:
          'Publishes a pick.created event to RabbitMQ and returns immediately; the inventory worker processes it asynchronously, decrementing stock and publishing pick.completed or pick.failed.',
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: false,
            schema: { type: 'string' },
            description:
              'A repeated key within the TTL window returns the same pickId instead of publishing a duplicate event.',
          },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: pickInputSchema } },
        },
        responses: {
          '202': {
            description: 'Pick accepted for asynchronous processing',
            content: { 'application/json': { schema: pickAcceptedSchema } },
          },
          '400': {
            description: 'Validation error',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
    },
  },
};
