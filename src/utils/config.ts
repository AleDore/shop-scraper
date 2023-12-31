/**
 * Config module
 *
 * Single point of access for the application confguration. Handles validation on required environment variables.
 * The configuration is evaluate eagerly at the first access to the module. The module exposes convenient methods to access such value.
 */

import * as t from "io-ts";

import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { readableReport } from "./logging";

export const IRedisConfig = t.type({
  REDIS_PASSWORD: t.string,
  REDIS_PORT: t.string,
  REDIS_URL: NonEmptyString,
});
export type IRedisConfig = t.TypeOf<typeof IRedisConfig>;

export const IStorageAccountConfig = t.type({
  PAGE_SEARCH_REQUEST_QUEUE_NAME: NonEmptyString,
  SEARCH_REQUEST_QUEUE_NAME: NonEmptyString,
  STORAGE_CONN_STRING: NonEmptyString,
});
export type IStorageAccountConfig = t.TypeOf<typeof IStorageAccountConfig>;

// global app configuration
export type IConfig = t.TypeOf<typeof IConfig>;
export const IConfig = t.intersection([
  t.type({
    ALIEXPRESS_SEARCH_URL: NonEmptyString,
    AMAZON_SEARCH_URL: NonEmptyString,
    EBAY_SEARCH_URL: NonEmptyString,
    ENABLE_PROXIES: t.boolean,
    isProduction: t.boolean,
  }),
  IRedisConfig,
  IStorageAccountConfig,
]);

// No need to re-evaluate this object for each call
const errorOrConfig: t.Validation<IConfig> = IConfig.decode({
  ...process.env,
  ENABLE_PROXIES: process.env.ENABLE_PROXIES === "true",
  isProduction: process.env.NODE_ENV === "production",
});

/**
 * Read the application configuration and check for invalid values.
 * Configuration is eagerly evalued when the application starts.
 *
 * @returns either the configuration values or a list of validation errors
 */
export const getConfig = (): t.Validation<IConfig> => errorOrConfig;

/**
 * Read the application configuration and check for invalid values.
 * If the application is not valid, raises an exception.
 *
 * @returns the configuration values
 * @throws validation errors found while parsing the application configuration
 */
export const getConfigOrThrow = (): IConfig =>
  pipe(
    errorOrConfig,
    E.getOrElse((errors) => {
      throw new Error(`Invalid configuration: ${readableReport(errors)}`);
    })
  );
