let env = process.env.NODE_ENV || 'development';

const MONGO_HOST = process.env.MONGO_HOST || '192.168.0.1';
const MONGO_PORT = process.env.MONGO_HOST || 27017;
 
const REDIS_HOST = process.env.REDIS_HOST || '192.168.0.1';
const REDIS_PORT = process.env.REDIS_HOST || 6379;

export let settings = {
  name: 'openride-server',
  version: '2.0.0',
  port: 3000,
  env,
  mongoUrl: `mongodb://${ MONGO_HOST }:${ MONGO_PORT }`,
  dbName: 'openride',
  sessionTTL: 10000,
  redisOptions: {
    host: REDIS_HOST,
    port: REDIS_PORT
  }
};

if (env === 'production') {
  settings.env = 'prod';
  // other production settings
}
