import { DataSource } from 'typeorm';

const postgresPort = Number(process.env.POSTGRES_PORT ?? 5432);

export const appDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number.isFinite(postgresPort) ? postgresPort : 5432,
  username: process.env.POSTGRES_USER_SERVICE ?? process.env.POSTGRES_USER ?? 'postgres',
  password: process.env.POSTGRES_PASSWORD_SERVICE ?? process.env.POSTGRES_PASSWORD ?? 'postgres',
  database: process.env.POSTGRES_DB_SERVICE ?? process.env.POSTGRES_DB ?? 'betting_engine',
  schema: 'odds_engine',
  entities: [],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
});

export default appDataSource;
