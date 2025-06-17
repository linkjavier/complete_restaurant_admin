export const adminAssistantFunctions = [
  {
    name: 'get_sales_report',
    description: 'Get a detailed sales report for a specific time period',
    parameters: {
      type: 'object',
      properties: {
        locationId: {
          type: 'string',
          description: 'ID of the location to get the sales report for',
        },
        startDate: {
          type: 'string',
          description: 'Start date for the report period (ISO format)',
        },
        endDate: {
          type: 'string',
          description: 'End date for the report period (ISO format)',
        },
        reportType: {
          type: 'string',
          description: 'Type of sales report to generate',
          enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'],
        },
        includeMetrics: {
          type: 'array',
          description: 'Specific metrics to include in the report',
          items: {
            type: 'string',
            enum: ['TOTAL_SALES', 'AVERAGE_ORDER_VALUE', 'TOP_PRODUCTS', 'PAYMENT_METHODS', 'CUSTOMER_COUNT'],
          },
        },
      },
      required: ['locationId', 'startDate', 'endDate', 'reportType'],
    },
  },
  {
    name: 'get_inventory_status',
    description: 'Get current inventory status and alerts',
    parameters: {
      type: 'object',
      properties: {
        locationId: {
          type: 'string',
          description: 'ID of the location to get inventory status for',
        },
        includeLowStock: {
          type: 'boolean',
          description: 'Whether to include low stock alerts',
        },
        includeExpiring: {
          type: 'boolean',
          description: 'Whether to include expiring items alerts',
        },
        category: {
          type: 'string',
          description: 'Optional category filter for inventory items',
        },
      },
      required: ['locationId'],
    },
  },
  {
    name: 'get_staff_performance',
    description: 'Get staff performance metrics and reports',
    parameters: {
      type: 'object',
      properties: {
        locationId: {
          type: 'string',
          description: 'ID of the location to get staff performance for',
        },
        startDate: {
          type: 'string',
          description: 'Start date for the performance period (ISO format)',
        },
        endDate: {
          type: 'string',
          description: 'End date for the performance period (ISO format)',
        },
        metrics: {
          type: 'array',
          description: 'Specific performance metrics to include',
          items: {
            type: 'string',
            enum: ['ORDERS_HANDLED', 'AVERAGE_ORDER_TIME', 'CUSTOMER_RATINGS', 'SALES_AMOUNT'],
          },
        },
      },
      required: ['locationId', 'startDate', 'endDate'],
    },
  },
]; 