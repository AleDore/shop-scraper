import { constVoid, pipe } from "fp-ts/lib/function";
import { RedisClientType } from "redis";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { RequestMessagePayload } from "../utils/types";
import { searchAllShop } from "../utils/search";

export const requestMessageHandler =
  (redisClient: RedisClientType) =>
  (item: RequestMessagePayload): TE.TaskEither<Error, void> =>
    pipe(
      // eslint-disable-next-line no-console
      console.log(`requestMessagehandler => ${JSON.stringify(item)}`),
      () => searchAllShop(redisClient, item.requestId, item.searchPayload),
      TE.chain(() =>
        TE.tryCatch(
          () =>
            redisClient.set(
              item.requestId,
              JSON.stringify({
                numOfPages: item.searchPayload.numberOfPages,
                status: "OK",
              })
            ),
          E.toError
        )
      ),
      TE.orElse((err) =>
        TE.tryCatch(
          () =>
            redisClient.set(
              item.requestId,
              JSON.stringify({ error: String(err), status: "KO" })
            ),
          E.toError
        )
      ),
      TE.map(constVoid)
    );
