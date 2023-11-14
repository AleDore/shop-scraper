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

export const scrapeAmazonHandler =
  (url: NonEmptyString, searchPayload: SearchPayload, pageNumber: number) =>
  (browser: Browser): TE.TaskEither<Error, ReadonlyArray<unknown>> =>
    pipe(
      TE.of(browser),
      TE.chain(
        loadPage(
          `${url}/s?k=${encodeURIComponent(
            searchPayload.toSearch
          )}&page=${pageNumber}`
        )
      ),
      TE.chain(awaitForSelector("div.s-main-slot.s-result-list")),
      TE.chain(autoScroll(400)),
      TE.chain(awaitForSelector("span[class*='s-pagination-item']")),
      TE.chain((page) =>
        pipe(
          evaluatePageElements(() => {
            const pageResults = document.querySelectorAll(
              "div[cel_widget_id*='MAIN-SEARCH_RESULT']"
            );
            const re = new RegExp("<.*>");
            return Array.from(pageResults).map((res) => ({
              description: res.querySelector("span[class*='a-text-normal']")
                ?.innerHTML,
              imageUrl: res.getElementsByTagName("img")[0].src,
              price: res
                .querySelector("span[class='a-price-whole']")
                ?.innerHTML.replace(re, ""),
            }));
          })(page),
          TE.chain((results) =>
            pipe(
              closePage(page),
              TE.map(() => results)
            )
          )
        )
      )
    );
