import { Global, Module } from "@nestjs/common";
import { BloomService } from "./bloom.service";

@Global()
@Module({
  providers: [BloomService],
  exports: [BloomService],
})
export class BloomModule {}
