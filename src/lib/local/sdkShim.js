// LOCAL ONLY. In Base44 backend functions this line is replaced by:
//   import { createClientFromRequest } from "npm:@base44/sdk";
import { localBase44 } from "./localBase44.js";
export const createClientFromRequest = (_req) => localBase44;
