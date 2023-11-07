import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";

export const SearchPayload = t.type({
  numberOfPages: NonNegativeInteger,
  toSearch: NonEmptyString,
});

export type SearchPayload = t.TypeOf<typeof SearchPayload>;
