import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/Either";
import * as RA from "fp-ts/ReadonlyArray";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/lib/function";
import * as t from "io-ts";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";

export const ProxyServerList = t.readonlyArray(NonEmptyString);
export type ProxyServerList = t.TypeOf<typeof ProxyServerList>;

export const initializeAndGetProxies = (): Promise<ProxyServerList> =>
  pipe(
    TE.tryCatch(
      () =>
        fetch(
          "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt",
          { method: "get" }
        ),
      E.toError
    ),
    TE.chain((response) => TE.tryCatch(() => response.text(), E.toError)),
    TE.map((listString) => listString.split("\n")),
    TE.chain(
      flow(
        ProxyServerList.decode,
        E.mapLeft((errs) => Error(errorsToReadableMessages(errs).join("|"))),
        TE.fromEither
      )
    ),
    TE.getOrElse((e) => {
      throw e;
    })
  )();

export const getRandomProxy = (proxyList: ProxyServerList): NonEmptyString =>
  pipe(
    proxyList,
    RA.head,
    O.map(() => proxyList[Math.floor(Math.random() * proxyList.length)]),
    O.toUndefined
  );
