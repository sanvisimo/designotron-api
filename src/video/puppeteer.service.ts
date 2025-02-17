import { Injectable, StreamableFile } from '@nestjs/common';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { join } from 'path';

const basePath = join(process.cwd(), 'puppeteer');

@Injectable()
export class PuppeteerService {
  async exportVideo(opts) {
    const {
      output = join(basePath, 'tmp_video.mp4'),
      type = 'png',
      animationData,
      path: animationPath = undefined,
      jpegQuality = 90,
      quiet = false,
      deviceScaleFactor = 1,
      renderer = 'svg',
      rendererSettings = {},
      style = {},
      inject = {},
      puppeteerOptions = {},
      ffmpegOptions = {
        crf: 20,
        profileVideo: 'main',
        preset: 'medium',
      },
      gifskiOptions = {
        quality: 80,
        fast: false,
      },
      progress = (f: number, t: number) => {
        console.log('create', f, '/', t);
      },
      frameNumber = 70,
    } = opts;

    const start = new Date().getTime();
    console.log('inizio', process.cwd());

    const browser = await puppeteer.launch({
      headless: 'shell',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...puppeteerOptions,
    });

    const genBrowser = new Date().getTime();
    console.log('genero il browser', (genBrowser - start) / 1000);

    let { width = undefined, height = undefined } = opts;

    const lottieData = animationData;
    const fps = ~~lottieData.fr;
    const { w = 640, h = 480 } = lottieData;
    const aR = w / h;

    console.log('fps', fps, animationData.fr);

    if (!(width && height)) {
      if (width) {
        height = width / aR;
      } else if (height) {
        width = height * aR;
      } else {
        width = w;
        height = h;
      }
    }

    width = width | 0;
    height = height | 0;

    const lottieScript = fs.readFileSync(
      require.resolve('lottie-web/build/player/lottie.min'),
      'utf8',
    );
    const injectLottie = `
<script>
  ${lottieScript}
</script>
`;

    const animation = null;

    const html = `
<html>
<head>
  <meta charset="UTF-8">

  ${inject.head || ''}
 ${injectLottie}

  <style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

@font-face {
 font-family: "Field Gothic";
  src:
    local("Field Gothic No. 46");
}

body {
  background: transparent;

  ${width ? 'width: ' + width + 'px;' : ''}
  ${height ? 'height: ' + height + 'px;' : ''}

  overflow: hidden;
}


#root {
  ${style}
}

  ${inject.style || ''}
  </style>
</head>

<body>
${inject.body || ''}

<div id="root"></div>

<script>
  const animationData = ${JSON.stringify(animationData)}
  
  let duration
  let numFrames

  function onReady () {
    animation = lottie.loadAnimation({
      container: document.getElementById('root'),
      renderer: '${renderer}',
      loop: false,
      autoplay: false,
      rendererSettings: ${JSON.stringify(rendererSettings)},
      animationData
    })

    duration = animation.getDuration()
    numFrames = animation.getDuration(true)

    const div = document.createElement('div')
    div.className = 'ready'
    document.body.appendChild(div)
  }

  document.addEventListener('DOMContentLoaded', onReady)
</script>

</body>
</html>
`;

    const page = await browser.newPage();

    const openTime = new Date().getTime();
    console.log('apro il browser', (openTime - start) / 1000);

    await page.setContent(html);

    const readTime = new Date().getTime();
    console.log('leggo', (readTime - start) / 1000);

    await page.waitForSelector('.ready');

    const pageReadyTime = new Date().getTime();
    console.log('pagina pronta', (pageReadyTime - start) / 1000);

    const duration = await page.evaluate(() => duration);
    const numFrames = await page.evaluate(() => numFrames);
    console.log('numFrames', numFrames);

    const pageFrame = page.mainFrame();
    const rootHandle = await pageFrame.$('#root');

    if (type === 'png') {
      const frameTime = new Date().getTime();
      console.log('frame richiesto', frameNumber, (frameTime - start) / 1000);

      await page.evaluate(
        (frame) => animation.goToAndStop(frame, true),
        frameNumber,
      );

      const name = `test_${frameNumber}.png`;
      const tmpFile = join(basePath, name);

      console.log('tmp', tmpFile);

      await rootHandle.screenshot({
        path: tmpFile,
        omitBackground: true,
        type: 'png',
      });

      await rootHandle.dispose();
      if (opts.browser) {
        await page.close();
      } else {
        await browser.close();
      }
      const file = fs.createReadStream(tmpFile);

      const end = new Date().getTime();
      console.log('end', (end - start) / 1000);
      return new StreamableFile(file, {
        type: 'image/png',
        disposition: `attachment; filename="${name}"`,
        // If you want to define the Content-Length value to another value instead of file's length:
        // length: 123,
      });
    } else {
      const dir = join(basePath, 'video');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }

      for (let frame = 0; frame < numFrames; ++frame) {
        await page.evaluate(
          (frame) => animation.goToAndStop(frame, true),
          frame,
        );

        await rootHandle.screenshot({
          path: join(dir, `frame${('00' + frame).slice(-3)}.png`),
          omitBackground: true,
          type: 'png',
        });

        if (progress) {
          progress(frame, numFrames);
        }
      }

      await rootHandle.dispose();
      if (opts.browser) {
        await page.close();
      } else {
        await browser.close();
      }

      console.log('egu', output);
      // const stream = fs.createWriteStream(output);

      const ehi = await new Promise<string>((resolve, reject) => {
        const command = ffmpeg()
          .addInput(`${dir}/frame%03d.png`)
          .fps(fps)
          // .size(`${width}x${height}`)
          .frames(numFrames)
          // .videoCodec('libx264')
          // .addOutputOptions('-pix_fmts yuv420p')
          .on('start', () => {
            console.log('inizio la codifica');
          })
          .on('progress', function (info) {
            console.log('progress ' + info.percent + '%');
          })
          .on('end', function () {
            console.log('file has been converted succesfully');
            fs.rmSync(dir, { recursive: true, force: true });
            resolve('fatto!');
          })
          .on('error', function (err) {
            console.log('an error happened: ' + err.message);
            reject(err);
          })
          // .format('mp4')
          .output(output);

        const audioAsset = animationData.assets.filter((a) =>
          'p' in a ? a.p.includes('audio') : false,
        );

        if (audioAsset[0]) {
          command.addInput(audioAsset[0].p);
        } else {
          command.noAudio();
        }

        // save to file
        command.run();
      });

      console.log(ehi);

      const file = fs.createReadStream(output);
      const end = new Date().getTime();
      console.log('end', (end - start) / 1000);
      return new StreamableFile(file, {
        type: 'video/mp4',
        disposition: 'attachment; filename="video.mp4"',
        // If you want to define the Content-Length value to another value instead of file's length:
        // length: 123,
      });
    }
  }
}
