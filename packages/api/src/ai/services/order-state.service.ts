import { Injectable } from '@nestjs/common';

export interface OrderState {
  items: any[];
  customerData: any;
  step: string;
  validatedOrderData?: any;
  pendingProductSelection?: {
    originalItems: any[];
    ambiguousIndex: number;
    options: any[];
  };
}

@Injectable()
export class OrderStateService {
  private orderState: Map<string, OrderState> = new Map();

  getState(conversationId: string): OrderState {
    return this.orderState.get(conversationId) || { items: [], customerData: {}, step: 'products' };
  }

  setState(conversationId: string, state: OrderState): void {
    this.orderState.set(conversationId, state);
  }

  updateState(conversationId: string, updates: Partial<OrderState>): void {
    const currentState = this.getState(conversationId);
    this.setState(conversationId, { ...currentState, ...updates });
  }

  deleteState(conversationId: string): void {
    this.orderState.delete(conversationId);
  }

  setValidatedOrderData(conversationId: string, orderData: any): void {
    const currentState = this.getState(conversationId);
    this.setState(conversationId, {
      ...currentState,
      validatedOrderData: orderData
    });
  }

  getValidatedOrderData(conversationId: string): any {
    const state = this.getState(conversationId);
    return state.validatedOrderData;
  }

  getPendingProductSelection(conversationId: string) {
    const state = this.getState(conversationId);
    return state.pendingProductSelection;
  }

  clearPendingProductSelection(conversationId: string) {
    const state = this.getState(conversationId);
    if (state.pendingProductSelection) {
      const { pendingProductSelection, ...rest } = state;
      this.setState(conversationId, rest);
    }
  }
} 