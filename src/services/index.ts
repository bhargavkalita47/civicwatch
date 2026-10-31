import { config } from "../config";
import type { CivicService } from "../domain/types";
import { apiService } from "./api";
import { mockService } from "./mock";
export const civicService: CivicService =
  config.serviceMode === "api" ? apiService : mockService;
