import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";

export const AmazonSearch = t.type({
  numberOfPages: NonNegativeInteger,
  toSearch: NonEmptyString,
});

export type AmazonSearch = t.TypeOf<typeof AmazonSearch>;
