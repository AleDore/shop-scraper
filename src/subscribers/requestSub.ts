import { constVoid, pipe } from "fp-ts/lib/function";
import { RedisClientType } from "redis";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";
import { searchAllShop } from "../utils/search";
import { RequestMessagePayload } from "../utils/types";

const searchRequestListener =
  (redisClient: RedisClientType) =>
  async (_: unknown, message: unknown): Promise<void> =>
    await pipe(
      message,
      RequestMessagePayload.decode,
      E.mapLeft((errs) => Error(errorsToReadableMessages(errs).join("|"))),
      TE.fromEither,
      TE.chain(({ requestId, searchPayload }) =>
        pipe(
          searchAllShop(searchPayload),
          TE.chain((results) =>
            TE.tryCatch(
              () =>
                redisClient.set(
                  requestId,
                  JSON.stringify({ results, status: "OK" })
                ),
              E.toError
            )
          ),
          TE.orElse(() =>
            TE.tryCatch(
              () =>
                redisClient.set(requestId, JSON.stringify({ status: "KO" })),
              E.toError
            )
          )
        )
      ),
      TE.bimap(constVoid, constVoid),
      TE.toUnion
    )();

export const createRequestSubscriber = (
  redisClient: RedisClientType
): TE.TaskEither<Error, void> =>
  TE.tryCatch(
    () =>
      redisClient.subscribe(
        "searchRequest",
        searchRequestListener(redisClient)
      ),
    E.toError
  );
