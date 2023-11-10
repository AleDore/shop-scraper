import { QueueClient, QueueServiceClient } from "@azure/storage-queue";

import { constVoid, flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as AR from "fp-ts/lib/Array";
import * as J from "fp-ts/lib/Json";
import * as t from "io-ts";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";

export const enqueue =
  (queueClient: QueueClient) =>
  (textMessage: string): TE.TaskEither<Error, void> =>
    pipe(
      TE.tryCatch(() => queueClient.createIfNotExists(), E.toError),
      TE.chain(() =>
        TE.tryCatch(() => queueClient.sendMessage(textMessage, {}), E.toError)
      ),
      TE.map(constVoid)
    );

export const dequeue = <A, S>(
  queueClient: QueueClient,
  decoder: t.Type<S, A>
): TE.TaskEither<Error, ReadonlyArray<S>> =>
  pipe(
    TE.tryCatch(() => queueClient.createIfNotExists(), E.toError),
    TE.chain(() => TE.tryCatch(() => queueClient.receiveMessages(), E.toError)),
    TE.map((response) => response.receivedMessageItems),
    TE.chain((items) =>
      pipe(
        items.map((i) =>
          pipe(
            i.messageText,
            J.parse,
            E.mapLeft(E.toError),
            E.chain(
              flow(
                decoder.decode,
                E.mapLeft((errs) =>
                  Error(errorsToReadableMessages(errs).join("|"))
                )
              )
            ),
            TE.fromEither,
            TE.bindTo("item"),
            TE.bind("deleteResponse", () =>
              TE.tryCatch(
                () => queueClient.deleteMessage(i.messageId, i.popReceipt),
                E.toError
              )
            ),
            TE.map(({ item }) => item)
          )
        ),
        AR.sequence(TE.ApplicativePar)
      )
    )
  );

export const getQueueClient = (
  connectionUrl: string,
  queueName: string
): QueueClient =>
  pipe(new QueueServiceClient(connectionUrl), (queueServiceClient) =>
    queueServiceClient.getQueueClient(queueName)
  );
