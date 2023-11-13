/* eslint-disable no-console */
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as TE from "fp-ts/lib/TaskEither";
import * as T from "fp-ts/lib/Task";
import * as E from "fp-ts/lib/Either";
import * as redis from "redis";
import { pipe } from "fp-ts/lib/function";

const addRedisListener = (
  client: redis.RedisClientType | redis.RedisClusterType
): void => {
  client.on("error", (err) => {
    console.error("[REDIS Error] an error occurs on redis client: %s", err);
  });
  client.on(
    "reconnecting",
    ({
      delay,
      attempt,
    }: {
      readonly delay: number;
      readonly attempt: number;
    }) => {
      console.warn(
        "[REDIS reconnecting] a reconnection events occurs [delay %s] [attempt %s]",
        delay,
        attempt
      );
    }
  );
};

export const createSimpleRedisClient =
  (enableTls: boolean) =>
  async (
    redisUrl: string,
    password?: string,
    port?: string
  ): Promise<redis.RedisClientType> => {
    const DEFAULT_REDIS_PORT = enableTls ? "6380" : "6379";
    const prefixUrl = enableTls ? "rediss://" : "redis://";
    const completeRedisUrl = `${prefixUrl}:${password}@${redisUrl}`;

    const redisPort: number = parseInt(port || DEFAULT_REDIS_PORT, 10);
    const redisClient = redis.createClient<
      Record<string, never>,
      Record<string, never>,
      Record<string, never>
    >({
      url: `${completeRedisUrl}:${redisPort}`,
    });
    addRedisListener(redisClient);
    await redisClient.connect();
    return redisClient;
  };

export const createClusterRedisClient =
  (enableTls: boolean, useReplicas: boolean = true) =>
  async (
    redisUrl: string,
    password?: string,
    port?: string
  ): Promise<redis.RedisClusterType> => {
    const DEFAULT_REDIS_PORT = enableTls ? "6380" : "6379";
    const prefixUrl = enableTls ? "rediss://" : "redis://";
    const completeRedisUrl = `${prefixUrl}${redisUrl}`;

    const redisPort: number = parseInt(port || DEFAULT_REDIS_PORT, 10);

    const redisClient = redis.createCluster<
      Record<string, never>,
      Record<string, never>,
      Record<string, never>
    >({
      defaults: {
        legacyMode: false,
        password,
        socket: {
          // TODO: We can add a whitelist with all the IP addresses of the redis clsuter
          checkServerIdentity: (_hostname, _cert) => undefined,
          keepAlive: 2000,
          tls: enableTls,
        },
      },
      rootNodes: [
        {
          url: `${completeRedisUrl}:${redisPort}`,
        },
      ],
      useReplicas,
    });
    addRedisListener(redisClient);
    await redisClient.connect();
    return redisClient;
  };

export const getSimpleRedisClient = (
  redisUrl: NonEmptyString,
  redisPassword: string,
  redisPort: string
): T.Task<redis.RedisClientType> =>
  pipe(
    TE.tryCatch(
      () => createSimpleRedisClient(false)(redisUrl, redisPassword, redisPort),
      E.toError
    ),
    TE.mapLeft((e) => Error(`Cannot Get Redis Client|${String(e)}`)),
    TE.getOrElse((err) => {
      throw err;
    })
  );

export const getRedisClient =
  (redisUrl: NonEmptyString, redisPassword: string, redisPort: string) =>
  (
    subscribeFn: (
      subscriberClient: redis.RedisClientType,
      client: redis.RedisClientType
    ) => TE.TaskEither<Error, void>
  ): T.Task<redis.RedisClientType> =>
    pipe(
      TE.tryCatch(
        () =>
          createSimpleRedisClient(false)(redisUrl, redisPassword, redisPort),
        E.toError
      ),
      TE.mapLeft((e) => Error(`Cannot Get Redis Client|${String(e)}`)),
      TE.bindTo("redisClient"),
      TE.bind("subscriberClient", () =>
        pipe(
          TE.tryCatch(
            () =>
              createSimpleRedisClient(false)(
                redisUrl,
                redisPassword,
                redisPort
              ),
            E.toError
          ),
          TE.mapLeft((e) =>
            Error(`Cannot Get Subscriber Redis Client|${String(e)}`)
          )
        )
      ),
      TE.chain(({ redisClient, subscriberClient }) =>
        pipe(
          subscribeFn(subscriberClient, redisClient),
          TE.mapLeft((e) =>
            Error(`Error while subscribing Redis Client to PubSub|${String(e)}`)
          ),
          TE.map(() => redisClient)
        )
      ),
      TE.getOrElse((err) => {
        throw err;
      })
    );
