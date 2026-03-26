import Airtable from "airtable";
import { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } from "./env.js";

let base;
if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
  base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
} else {
  console.warn("⚠️ AIRTABLE_API_KEY or AIRTABLE_BASE_ID is missing. Airtable operations will fail.");
}

export { base };
