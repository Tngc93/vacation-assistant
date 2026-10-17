// The sample responses filled for one trip (14–18 Nov 2026), for tests.
import { fillFixture } from "../fixtureData";
import esbAms from "./ESB-AMS-month.json";
import istBcn from "./IST-BCN.json";
import sawBcn from "./SAW-BCN.json";

const trip = { depart: "2026-11-14", return: "2026-11-18" };

export const IST_BCN = { ...istBcn, data: fillFixture(istBcn.data, trip) };
export const SAW_BCN = { ...sawBcn, data: fillFixture(sawBcn.data, trip) };
export const ESB_AMS_NOVEMBER = { ...esbAms, data: fillFixture(esbAms.data, { month: "2026-11", returnMonth: "2026-11" }) };
