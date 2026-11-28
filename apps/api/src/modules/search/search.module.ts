import { Inject, Module, OnModuleDestroy } from "@nestjs/common";
import { Client, ClientOptions } from "@elastic/elasticsearch";
import { loadEnv } from "@urticketbuddy/config";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";
import { ELASTICSEARCH_CLIENT } from "./search.tokens";

export function createElasticsearchClient(): Client {
  const env = loadEnv();
  const options: ClientOptions = {
    node: env.ELASTICSEARCH_NODE,
  };

  if (env.ELASTICSEARCH_API_KEY) {
    options.auth = { apiKey: env.ELASTICSEARCH_API_KEY };
  } else if (env.ELASTICSEARCH_USERNAME && env.ELASTICSEARCH_PASSWORD) {
    options.auth = {
      username: env.ELASTICSEARCH_USERNAME,
      password: env.ELASTICSEARCH_PASSWORD,
    };
  }

  return new Client(options);
}

@Module({
  controllers: [SearchController],
  providers: [
    {
      provide: ELASTICSEARCH_CLIENT,
      useFactory: createElasticsearchClient,
    },
    SearchService,
  ],
  exports: [ELASTICSEARCH_CLIENT, SearchService],
})
export class SearchModule implements OnModuleDestroy {
  constructor(
    @Inject(ELASTICSEARCH_CLIENT)
    private readonly esClient: Client,
  ) {}

  async onModuleDestroy(): Promise<void> {
    if (this.esClient && typeof this.esClient.close === "function") {
      await this.esClient.close().catch(() => undefined);
    }
  }
}
