declare module 'passport-google-oauth20' {
  import { Strategy } from 'passport';
  export class Strategy extends Strategy {
    constructor(options: any, verify: any);
  }
  export interface VerifyCallback {
    (error: any, user?: any, info?: any): void;
  }
}

declare module 'passport-facebook' {
  import { Strategy } from 'passport';
  export class Strategy extends Strategy {
    constructor(options: any, verify: any);
  }
  export interface VerifyCallback {
    (error: any, user?: any, info?: any): void;
  }
} 