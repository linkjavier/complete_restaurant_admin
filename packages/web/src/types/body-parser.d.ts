declare module 'body-parser' {
  import { RequestHandler } from 'express';
  
  export function json(options?: unknown): RequestHandler;
  export function urlencoded(options?: unknown): RequestHandler;
  export function raw(options?: unknown): RequestHandler;
  export function text(options?: unknown): RequestHandler;
} 