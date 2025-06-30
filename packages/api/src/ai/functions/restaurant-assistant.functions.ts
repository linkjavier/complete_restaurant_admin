export const restaurantAssistantFunctions = [
  {
    name: 'search_products_by_name',
    description: 'Search for products by name to get the correct product ID',
    parameters: {
      type: 'object',
      properties: {
        productName: {
          type: 'string',
          description: 'Name or partial name of the product to search for',
        },
        locationId: {
          type: 'string',
          description: 'ID of the location to search products in',
        },
      },
      required: ['productName', 'locationId'],
    },
  },
  {
    name: 'calculate_order_subtotal',
    description: 'Calculate the subtotal for a list of items with their quantities. If a product has variant groups, the variants field is required for that item.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'List of items with product names, quantities, and (if applicable) variants per group.',
          items: {
            type: 'object',
            properties: {
              productName: {
                type: 'string',
                description: 'Name of the product (will be matched to get correct ID)',
              },
              quantity: {
                type: 'integer',
                description: 'Quantity of the product',
                minimum: 1,
              },
              variants: {
                type: 'array',
                description: 'List of selected variants per group. Each item: { groupName: string, variantName: string }',
                items: {
                  type: 'object',
                  properties: {
                    groupName: { type: 'string', description: 'Name of the variant group' },
                    variantName: { type: 'string', description: 'Name of the selected variant' },
                  },
                  required: ['groupName', 'variantName'],
                },
              },
              notes: {
                type: 'string',
                description: 'Optional notes for the order item',
              },
            },
            required: ['productName', 'quantity'],
          },
        },
        locationId: {
          type: 'string',
          description: 'ID of the location to get product prices from',
        },
      },
      required: ['items', 'locationId'],
    },
  },
  {
    name: 'validate_order_before_creation',
    description: 'Validate the complete order with customer information and calculated totals before creating it. If a product has variant groups, the variants field is required for that item.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'List of validated items with correct product IDs, calculated subtotals, and (if applicable) variants per group.',
          items: {
            type: 'object',
            properties: {
              productId: {
                type: 'string',
                description: 'Validated product ID',
              },
              productName: {
                type: 'string',
                description: 'Name of the product for display',
              },
              quantity: {
                type: 'integer',
                description: 'Quantity of the product',
                minimum: 1,
              },
              unitPrice: {
                type: 'number',
                description: 'Unit price of the product',
              },
              subtotal: {
                type: 'number',
                description: 'Calculated subtotal for this item',
              },
              variants: {
                type: 'array',
                description: 'List of selected variants per group. Each item: { groupName: string, variantName: string }',
                items: {
                  type: 'object',
                  properties: {
                    groupName: { type: 'string', description: 'Name of the variant group' },
                    variantName: { type: 'string', description: 'Name of the selected variant' },
                  },
                  required: ['groupName', 'variantName'],
                },
              },
              notes: {
                type: 'string',
                description: 'Optional notes for the order item',
              },
            },
            required: ['productId', 'productName', 'quantity', 'unitPrice', 'subtotal'],
          },
        },
        totalAmount: {
          type: 'number',
          description: 'Total calculated amount for the entire order',
        },
        customerName: {
          type: 'string',
          description: 'Name of the customer',
        },
        deliveryAddress: {
          type: 'string',
          description: 'Delivery address for the order',
        },
        phone: {
          type: 'string',
          description: 'Customer phone number',
        },
        neighborhood: {
          type: 'string',
          description: 'Customer neighborhood',
        },
        paymentMethod: {
          type: 'string',
          description: 'Payment method for the order',
          enum: ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER'],
        },
        locationId: {
          type: 'string',
          description: 'ID of the location where the order is being placed',
        },
        chatId: {
          type: 'string',
          description: 'Chat ID to identify the customer in the database',
        },
      },
      required: ['items', 'totalAmount', 'customerName', 'deliveryAddress', 'phone', 'neighborhood', 'paymentMethod', 'locationId'],
    },
  },
  {
    name: 'create_order',
    description: 'Create a new delivery order with validated items and calculated totals. If a product has variant groups, the variants field is required for that item.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'List of validated items with correct product IDs and (if applicable) variants per group.',
          items: {
            type: 'object',
            properties: {
              productId: {
                type: 'string',
                description: 'Validated product ID',
              },
              quantity: {
                type: 'integer',
                description: 'Quantity of the product',
                minimum: 1,
              },
              variants: {
                type: 'array',
                description: 'List of selected variants per group. Each item: { groupName: string, variantName: string }',
                items: {
                  type: 'object',
                  properties: {
                    groupName: { type: 'string', description: 'Name of the variant group' },
                    variantName: { type: 'string', description: 'Name of the selected variant' },
                  },
                  required: ['groupName', 'variantName'],
                },
              },
              notes: {
                type: 'string',
                description: 'Optional notes for the order item',
              },
            },
            required: ['productId', 'quantity'],
          },
        },
        locationId: {
          type: 'string',
          description: 'ID of the location where the order is being placed',
        },
        customerName: {
          type: 'string',
          description: 'Name of the customer',
        },
        deliveryAddress: {
          type: 'string',
          description: 'Delivery address for the order',
        },
        phone: {
          type: 'string',
          description: 'Customer phone number',
        },
        neighborhood: {
          type: 'string',
          description: 'Customer neighborhood',
        },
        paymentMethod: {
          type: 'string',
          description: 'Payment method for the order',
          enum: ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER'],
        },
      },
      required: ['items', 'locationId', 'customerName', 'deliveryAddress', 'phone', 'neighborhood', 'paymentMethod'],
    },
  },
  {
    name: 'get_menu',
    description: 'Devuelve el menú completo del restaurante, con productos enumerados, nombre y precio, agrupados por categoría. El formato debe ser bonito y fácil de leer para el cliente.',
    parameters: {
      type: 'object',
      properties: {
        locationId: {
          type: 'string',
          description: 'ID de la ubicación para obtener el menú',
        },
      },
      required: ['locationId'],
    },
  },
]; 