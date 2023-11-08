import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as AR from "fp-ts/NonEmptyArray";
import {
  autoScroll,
  awaitForSelector,
  evaluatePageElements,
  launchBrowser,
  loadPage,
} from "../utils/puppeteer";
import { SearchPayload } from "../utils/types";

export const scrapeEbayHandler = (
  url: NonEmptyString,
  searchPayload: SearchPayload
): TE.TaskEither<Error, ReadonlyArray<unknown>> =>
  pipe(
    launchBrowser(),
    // loading landing page
    TE.chain((browser) =>
      pipe(
        AR.range(1, searchPayload.numberOfPages),
        AR.map((resPage) =>
          pipe(
            browser,
            loadPage(
              `${url}/s?_nkw=${encodeURIComponent(
                searchPayload.toSearch
              )}&_pgn=${resPage}`
            ),
            TE.chain(awaitForSelector("div[class*='srp-river-results']")),
            TE.chain(autoScroll(200)),
            TE.chain(
              evaluatePageElements(() => {
                const pageResults = document.querySelectorAll(
                  "div[class*='s-item__wrapper']"
                );
                // eslint-disable-next-line no-useless-escape
                const re = /<\!--.*?-->/g;
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const [_, ...results] = Array.from(pageResults);
                return results.map((res) => ({
                  description: res
                    .querySelector(
                      "div[class*='s-item__title'] > span[role='heading']"
                    )
                    ?.innerHTML.replace(re, "")
                    .replace(/<.*>/, ""),
                  imageUrl: res
                    .querySelector("div[class*='s-item__image-wrapper']")
                    .getElementsByTagName("img")[0].src,
                  price: res
                    .querySelector("span[class*='s-item__price']")
                    ?.innerHTML.replace(re, "")
                    .replace(/<.*>/, ""),
                }));
              })
            ),
            TE.map((r) => r.filter((e) => e.price !== ""))
          )
        ),
        AR.sequence(TE.ApplicativeSeq)
      )
    ),
    TE.map(AR.flatten)
  );
