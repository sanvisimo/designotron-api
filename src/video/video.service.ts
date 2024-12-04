import { Injectable } from '@nestjs/common';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { PuppeteerService } from './puppeteer.service';

const getRandomArbitrary = (min: number, max: number): number =>
  Math.random() * (max - min) + min;

const is = 32;

const delay = (time: number) =>
  new Promise((resolve) => setTimeout(resolve, time));

@Injectable()
export class VideoService {
  constructor(private puppeteerService: PuppeteerService) {}

  create(createVideoDto: CreateVideoDto) {
    return this.puppeteerService.exportVideo(createVideoDto);
  }

  getIterationCount(): number {
    return 150;
  }

  async getData(): Promise<string[]> {
    return new Promise(async (resolve, reject) => {
      try {
        const result = [];

        for (let i = 0; i < this.getIterationCount(); i++) {
          result.push(getRandomArbitrary(1, 9999));
          await delay(getRandomArbitrary(100, 1000));
        }

        resolve(result);
      } catch (e) {
        reject(e);
      }
    });
  }

  findAll() {
    return `This action returns all video`;
  }

  findOne(id: number) {
    return `This action returns a #${id} video`;
  }

  update(id: number, updateVideoDto: UpdateVideoDto) {
    return `This action updates a #${id} video`;
  }

  remove(id: number) {
    return `This action removes a #${id} video`;
  }
}
