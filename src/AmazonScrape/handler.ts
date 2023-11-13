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

export const scrapeAmazonHandler = (
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
              `${url}/s?k=${encodeURIComponent(
                searchPayload.toSearch
              )}&page=${resPage}`
            ),
            TE.chain(awaitForSelector("div.s-main-slot.s-result-list")),
            TE.chain(autoScroll(400)),
            TE.chain(awaitForSelector("span[class*='s-pagination-item']")),
            TE.chain(
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
              })
            )
          )
        ),
        AR.sequence(TE.ApplicativeSeq)
      )
    ),
    TE.map(AR.flatten)
  );
