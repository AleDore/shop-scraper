/* eslint-disable no-console */
import * as redis from "redis";

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
    redisClient.on("error", (err) => {
      console.error("[REDIS Error] an error occurs on redis client: %s", err);
    });
    redisClient.on(
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
    await redisClient.connect();
    return redisClient;
  };

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type Selector<T, S> = {
  readonly select: (type: T) => ReadonlyArray<S>;
  readonly selectOne: (type: T) => S;
};

export type RedisClientSelectorType = Selector<
  RedisClientMode,
  redis.RedisClusterType
>;

export enum RedisClientMode {
  "ALL" = "ALL",
  "SAFE" = "SAFE",
  "FAST" = "FAST",
}

export const RedisClientSelector =
  (enableTls: boolean) =>
  async (
    redisUrl: string,
    password?: string,
    port?: string
  ): Promise<RedisClientSelectorType> => {
    const FAST_REDIS_CLIENT = await createClusterRedisClient(enableTls)(
      redisUrl,
      password,
      port
    );
    const SAFE_REDIS_CLIENT = await createClusterRedisClient(enableTls, false)(
      redisUrl,
      password,
      port
    );
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const select = (t: RedisClientMode) => {
      switch (t) {
        case RedisClientMode.ALL: {
          return [SAFE_REDIS_CLIENT, FAST_REDIS_CLIENT];
        }
        case RedisClientMode.SAFE: {
          return [SAFE_REDIS_CLIENT];
        }
        case RedisClientMode.FAST: {
          return [FAST_REDIS_CLIENT];
        }
        default: {
          throw new Error("Unexpected selector for redis client");
        }
      }
    };
    return {
      select,
      selectOne: (t) => select(t)[0],
    };
  };
