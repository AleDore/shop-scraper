import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { constVoid, pipe } from "fp-ts/lib/function";
import {
  autoScroll,
  awaitForSelector,
  evaluatePageElements,
  launchBrowser,
  loadPage,
} from "../utils/puppeteer";
import * as TE from "fp-ts/TaskEither";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";

export const scrapeAmazonHandler = (
  url: NonEmptyString,
  toSearch: NonEmptyString,
  _: NonNegativeInteger = 1 as NonNegativeInteger
): TE.TaskEither<Error, any[]> =>
  pipe(
    launchBrowser(),
    // loading landing page
    TE.chain(loadPage(`${url}/s?k=${encodeURIComponent(toSearch)}`)),
    TE.chain(awaitForSelector("div.s-main-slot.s-result-list")),
    TE.chain(autoScroll(200)),
    TE.chain(awaitForSelector("span[class*='s-pagination-item']")),
    TE.chain(
      evaluatePageElements(() => {
        const pageResults = document.querySelectorAll("div[cel_widget_id*='MAIN-SEARCH_RESULT']");
        const results = [];
        pageResults.forEach((res) => {
          var resJson = {};
          resJson["imageUrl"] = res.getElementsByTagName("img")[0].src;
          resJson["description"] = res.querySelector("span[class*='a-text']")?.innerHTML;
          resJson["price"] = res.querySelector("span[class='a-price-whole']")?.innerHTML;
          results.push(resJson);
        });
        return results;
      })
    )
  );
