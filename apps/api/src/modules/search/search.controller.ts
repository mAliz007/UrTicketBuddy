import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import {
  ErrorCode,
  SearchEventsQuerySchema,
  SearchEventsResponse,
  SearchSuggestQuerySchema,
  SearchSuggestResponse,
} from "@urticketbuddy/contracts";
import { Public } from "../auth/decorators/public.decorator";
import { SearchService } from "./search.service";

@Controller("search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get("events")
  async searchEvents(
    @Query() rawQuery: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SearchEventsResponse> {
    const parsed = SearchEventsQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid search events query parameters",
        details: parsed.error.issues,
      });
    }

    const { result, backend } = await this.searchService.searchEvents(
      parsed.data,
    );
    res.setHeader("X-Search-Backend", backend);
    return result;
  }

  @Public()
  @Get("suggest")
  async suggestEvents(
    @Query() rawQuery: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SearchSuggestResponse> {
    const parsed = SearchSuggestQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid search suggest query parameters",
        details: parsed.error.issues,
      });
    }

    const { result, backend } = await this.searchService.suggestEvents(
      parsed.data,
    );
    res.setHeader("X-Search-Backend", backend);
    return result;
  }
}
