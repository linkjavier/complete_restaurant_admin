export const restaurantAssistantFunctions = [
  {
    name: 'create_order',
    description: 'Create a new delivery order with specified items',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'List of items to order',
          items: {
            type: 'object',
            properties: {
              productId: {
                type: 'string',
                description: 'ID of the product to order',
              },
              quantity: {
                type: 'integer',
                description: 'Quantity of the product',
                minimum: 1,
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
]; 