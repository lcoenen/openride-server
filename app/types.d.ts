export interface Config {
  name: string;
  port: number;
  env: string;
  version: string;
  mongoUrl: string;
  dbName: string;
	sessionTTL: number;
}

declare module 'catnapify';
