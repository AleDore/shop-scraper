import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { Browser } from "puppeteer";
import {
  autoScroll,
  awaitForSelector,
  closePage,
  evaluatePageElements,
  loadPage,
} from "../utils/puppeteer";
import { SearchPayload } from "../utils/types";

export const scrapeEbayHandler =
  (url: NonEmptyString, searchPayload: SearchPayload, pageNumber: number) =>
  (browser: Browser): TE.TaskEither<Error, ReadonlyArray<unknown>> =>
    pipe(
      browser,
      TE.of,
      TE.chain(
        loadPage(
          `${url}/s?_nkw=${encodeURIComponent(
            searchPayload.toSearch
          )}&_pgn=${pageNumber}`
        )
      ),
      TE.chain(awaitForSelector("div[class*='srp-river-results']")),
      TE.chain(autoScroll(200)),
      TE.chain((page) =>
        pipe(
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
          })(page),
          TE.chain((results) =>
            pipe(
              closePage(page),
              TE.map(() => results)
            )
          )
        )
      ),

      TE.map((r) => r.filter((e) => e.price !== ""))
    );
